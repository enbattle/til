---
title: Design Cloud File Storage (like Google Drive or Dropbox)
summary: Keeping every device's copy of your files in step by storing metadata apart from bytes, uploading files as hashed chunks straight to object storage, and syncing each device from a change log kept for each user's files and each shared folder.
date: 2026-09-28
order: 6
---

A cloud file storage service keeps a folder of files in step across every
device a person uses. Save a database file on your laptop and, a few seconds
later, the new version is on your desktop at work, visible in a browser, and
available to the colleague you shared the folder with. The piece of software on
each laptop or desktop that watches the local folder, uploads what changed and
downloads what changed elsewhere is the **sync client**.

Two very different kinds of data are involved. The **contents** of the files
are large, opaque bytes: a 2 MB PDF, a 4 GB video. The **metadata** is
everything the service knows _about_ them: names, which folder each file sits
in, who may open it, which version is current, when it changed. Metadata is
small, heavily queried and has to stay consistent (two files can't share one
name in the same folder); contents are huge, written once and read whole. The
design keeps them in different systems built for each job, and most of its
decisions follow from that split.

This is one plausible design for a service like Google Drive or Dropbox, not a
description of how either company built theirs.

## At a glance

**Requirements.**

- Upload files of up to 50 GB, resuming after interruptions, and sync changes
  to every device, including offline edits.
- Share folders with viewers and editors, checked on every read and write.
- Keep replaced versions and deleted files for 30 days; never lose either of
  two conflicting edits.
- 50 million users, 10 million active a day, each storing 4 GB in 2,000 files.
- Eleven nines of durability; changes reach other online devices within 10
  seconds and metadata calls take under 200 ms, both at p99.

**Key numbers.** From the estimates:

- About 4,600 commits a second at peak (40 million saves a day ÷ 86,400 ≈ 460,
  × 10).
- 200 PB of file contents (50 million users × 4 GB).
- About 56 Gbit/s of uploads at peak (60 TB a day ≈ 5.6 Gbit/s, × 10), and
  110 Gbit/s of downloads (twice the uploads).
- About 230,000 metadata reads a second at peak (20 million sync clients × 100
  requests a day ÷ 86,400 ≈ 23,000, × 10).
- About 80 TB of metadata, 63 TB of it split by namespace over 32 shards of
  about 2 TB.

**Key decisions.**

- Content-addressed 4 MB chunks, uploaded straight to the object store:
  resuming, editing and version history all become "upload the missing chunks"
  ([chunked uploads](#deep-dive-chunked-uploads-and-deduplication)).
- Notify, then pull from the journal: every change is applied one way, so a
  lost notification only delays it ([the sync protocol](#deep-dive-the-sync-protocol)).
- Conflicted copies over last writer wins: the service can't merge arbitrary
  bytes, and neither edit may be lost
  ([conflicting edits](#deep-dive-conflicting-edits)).

**Likely follow-ups.**

- Why not deduplicate across all users? Saying a chunk exists anywhere leaks
  what others store, so clients see only their namespace's chunks, though
  storage keeps one copy ([deduplication](#deep-dive-chunked-uploads-and-deduplication)).
- Why not poll? Polling every 30 seconds misses the 10-second target and costs
  about 333,000 requests a second
  ([the sync protocol](#deep-dive-the-sync-protocol)).
- When are a chunk's bytes deleted? Once no namespace uses it and 7 days pass
  with no new reference ([deleting the bytes](#deep-dive-versions-trash-and-storage-tiers)).
- What does cold storage save? Moving the 80% of bytes unread for 90 days cuts
  $4,000,000 a month to about $1,490,000
  ([storage tiers](#deep-dive-versions-trash-and-storage-tiers)).
- What about a shared folder with 5,000 members? One commit means 10,000
  notifications, so API servers cache journal pages and notifications go out
  with a random delay ([failure modes](#failure-modes-and-bottlenecks)).

The [high-level architecture](#high-level-architecture) follows one edit from a laptop to a desktop.

## Requirements

Functional requirements:

- **Upload and download.** Add a file of up to 50 GB from any device, and get
  any file back. A large upload that is interrupted resumes where it stopped.
- **Sync.** Every device running the sync client ends up with the same files.
  A change made on one device reaches the others without anyone asking for it,
  including changes made while a device was offline.
- **Folders.** Create, rename, move and delete files and folders.
- **Sharing.** Share a folder with other users as a viewer (can read) or an
  editor (can change). Every read and write is checked against those
  permissions.
- **Version history.** Keep each replaced version of a file for 30 days after
  it was replaced, and let the user restore any of them.
- **Trash.** A deleted file goes to the trash and can be restored for 30 days,
  after which it is gone for good.
- **Conflicting edits.** When the same file is edited on two devices before
  either sees the other's change, neither edit is lost.

Out of scope: real-time co-editing inside a document (a document editor's
problem, not a file store's), full-text search, previews and thumbnails,
public "anyone with the link" sharing, sharing a single file rather than a
folder, and sign-up, quotas and billing. Search and previews would read from
this design without changing it.

Non-functional requirements:

- **Scale:** 50 million registered users, 10 million of them active on a given
  day. The average user stores 4 GB in 2,000 files, and each active user saves
  (creates or changes) 4 files a day. Each user runs the sync client on 2
  devices on average, each holding a full copy of their files.
- **Durability:** a file whose upload was confirmed is never lost. The target is
  eleven nines (99.999999999%) per object per year, the figure large object
  stores are designed for.
- **Sync latency:** a change on one device shows up on the user's other online
  devices within 10 seconds at the 99th percentile, not counting the time to
  transfer the bytes themselves. (The 99th percentile, p99, is the time 99% of
  cases beat.)
- **Metadata latency:** listing a folder or committing a change takes under
  200 ms at p99.
- **Availability:** 99.9% for sync and metadata (about 43 minutes of downtime
  in a 30-day month, since 30 × 24 × 60 = 43,200 minutes and 0.1% of that is
  43.2). Durability is the hard line; a sync that runs a few minutes late is an
  annoyance, and a lost file is not recoverable.

## Back-of-the-envelope estimates

The rules of thumb used here come from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
plan for a peak about ten times the average. The rest is arithmetic on a day of
86,400 seconds. MB, GB, TB and PB are decimal (a GB is 1,000 MB), and figures are rounded.

**Saves (metadata commits).** Every save, new file or changed one, ends in one
metadata write.

- Per day: 10,000,000 active users × 4 saves = 40,000,000 saves.
- Average: 40,000,000 ÷ 86,400 ≈ 463, so **about 460 commits a second**.
- Peak: **about 4,600 commits a second**.

**Upload bandwidth.** Assume a save uploads 1.5 MB on average once unchanged
parts of a file are skipped (the first deep dive shows how).

- Per day: 40,000,000 × 1.5 MB = 60,000,000 MB = **60 TB a day**.
- Average: 60 TB ÷ 86,400 ≈ 694 MB a second, which is about 5.6 Gbit/s
  (× 8 bits per byte).
- Peak: **about 56 Gbit/s** of uploads.

**Download bandwidth.** Each save is downloaded by the user's other synced
device, and browser downloads and shared-folder members add to that; call
downloads **twice the uploads**, 120 TB a day, about 11 Gbit/s on average and
110 Gbit/s at peak.

**File contents stored.**

- Today: 50,000,000 users × 4 GB = 200,000,000 GB = **200 PB**.
- Growth: 60 TB × 365 ≈ 21.9 PB a year before deletions, about 11% of what is
  stored today.
- Version history: at most 30 days × 60 TB = 1.8 PB of replaced bytes kept for
  restores, under 1% of the total, because a new version stores only the parts
  that changed.

**Metadata stored.** Files are cut into 4 MB chunks (the data model explains
them). Most files are smaller than one chunk and a few are much larger; assume
1.2 chunks per file on average.

- Files: 50,000,000 users × 2,000 files = **100 billion files** (4 GB ÷ 2,000
  is 2 MB, the average file size), so about 120 billion chunks.
- A file's row plus its current version's row, with indexes, about 500 bytes:
  100,000,000,000 × 500 bytes = 50 TB.
- Each version's list of chunk hashes, about 40 bytes per entry: 120 billion ×
  40 bytes = 4.8 TB.
- Older versions kept for 30 days: 40,000,000 saves × 30 = 1.2 billion extra
  version rows × 500 bytes = 0.6 TB.
- The change log: about 100 bytes per save, 40,000,000 × 100 bytes = 4 GB a
  day, kept 90 days = 0.36 TB.
- Each namespace's record of the chunks it holds, about 60 bytes a row with
  its index, at most one row per chunk entry: 120 billion × 60 bytes = 7.2 TB.
- The global chunk index (where each chunk's bytes live, its tier, when it was
  last read), about 100 bytes a row: 120 billion × 100 bytes = 12 TB.
- Which namespaces use each chunk, about 40 bytes a row: 120 billion × 40 bytes
  = 4.8 TB.
- Total: 50 + 4.8 + 0.6 + 0.36 + 7.2 + 12 + 4.8 ≈ **80 TB of metadata**, of
  which about 63 TB is kept per namespace and about 17 TB per chunk.

**Metadata reads.** 10 million active users × 2 devices = 20 million active
sync clients. Assume each is online about 8 hours a day and, as a backstop,
asks for changes every 10 minutes (the sync deep dive): 8 × 6 = 48 requests.
Add about 50 more for catching up at start-up, fetching changes and listing
folders, and call it 100 a day:

- 20,000,000 × 100 = 2,000,000,000 requests a day.
- Average: 2,000,000,000 ÷ 86,400 ≈ 23,148, **about 23,000 a second**; peak
  **about 230,000 a second**.

**Open notification connections.** Assume half of the 20 million active clients
are online at the busiest time: **10 million open connections**. At a
conservative 100,000 mostly idle connections per server, that is 100 servers.

What the estimates say: the bytes are the big number (200 PB, peaks near
60 Gbit/s in and 110 Gbit/s out) and the metadata is the delicate one (80 TB,
too much for one database server, with 230,000 reads a second and a
consistency requirement on every write). The design should never push file
bytes through the servers that handle metadata, and should split metadata
across machines along a line that keeps each commit on one of them.

## Data model

**Contents** go to an **object store**: a storage service that keeps blobs of
bytes under string keys, with operations like put, get and delete but no
editing in place, no queries and no transactions. S3 is the best-known
example. It is cheap per byte and scales to exabytes, which is what 200 PB
needs. For durability it keeps several copies of each object, or uses
**erasure coding**: splitting the object into fragments plus extra parity
fragments, spread across machines and buildings, so that any large enough
subset of them rebuilds it.

Files are not stored as one object each. Each file is cut into **chunks** of
up to 4 MB, and each chunk is identified by its **SHA-256 hash**: a 32-byte
fingerprint computed from the chunk's bytes, which is the same for the same
bytes and, in practice, different for different bytes. A version of a file is
then an ordered list of chunk hashes, and naming data by a hash of its
contents is called **content addressing**. Each chunk's bytes sit in the
object store once, under an object key recorded against its hash. The first
deep dive covers why.

**Metadata** goes to a relational database. The unit that groups it is a
**namespace**: a tree of folders and files with its own members. A user's own
files form one namespace, and each shared folder is a namespace of its own,
which appears inside each member's tree.

```text
split by namespace_id:
namespaces        namespace_id PK, owner_id, kind (home | shared), next_seq
members           namespace_id, user_id, role (owner | editor | viewer)
files             file_id PK, namespace_id, parent_id, name, is_folder,
                  current_version, deleted_at (set while in the trash)
                  UNIQUE (namespace_id, parent_id, name) among non-deleted rows
versions          file_id, version, size, chunk_hashes (ordered list),
                  device_id, created_by, created_at      PK (file_id, version)
journal           namespace_id, seq, file_id, version, op, device_id, created_at
                  PK (namespace_id, seq)
namespace_chunks  namespace_id, hash, ref_count          PK (namespace_id, hash)
ref_changes       namespace_id, seq, hash, added | removed

split by hash:
chunks            hash PK, object_key, size, tier, last_read, unreferenced_since
chunk_refs        hash, namespace_id                     PK (hash, namespace_id)
pending_uploads   hash, upload_id, user_id, object_key, expires_at, claimed
```

A file records its `parent_id` and `name` rather than its full path, so
renaming a folder with 10,000 files in it updates one row, not 10,000.

The **journal** is the change log sync runs on. Every commit in a namespace
takes the next number from `namespaces.next_seq` and appends one journal row
with it, so the journal is a gap-free, ordered history of the namespace. The
primary key `(namespace_id, seq)` is also an index that answers "everything in
this namespace after seq 1041" with one range read, and the unique
`(namespace_id, parent_id, name)` index both stops two files from taking one
name in a folder and serves folder listings;
[database indexing](/systems-and-infrastructure/database-indexing) covers why
one composite index can do both.

`chunks` says where each chunk's bytes live, its storage tier and when it was
last read, and `pending_uploads` records upload URLs issued but not yet
committed. `namespace_chunks` counts how many of a namespace's versions use
each chunk, and `ref_changes` and `chunk_refs` carry that across to the
per-chunk tables for the **garbage collector**, the background job that
deletes chunk bytes nothing refers to any more; the last deep dive walks
through them.

A relational database fits because a commit is a small transaction over several
rows: check the file's current version, insert a version row, move
`current_version`, update the chunk counts, take a `seq` and append the journal
row, all or nothing. [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)
covers that trade; here the transactions are worth more than the flexible
schema a document store would give. The 63 TB kept per namespace is split by
`namespace_id` across many databases, each holding one slice of the data,
called a **shard**. Every row a commit touches carries the
same `namespace_id`, so a commit never spans two databases. At about 2 TB per
database that is 63 ÷ 2 ≈ 31.5, rounded up to **32 shards** of about 2 TB,
each taking about 4,600 ÷ 32 ≈ 144 commits and 230,000 ÷ 32 ≈ 7,200 reads a
second at peak;
[partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers the split. The 17 TB of per-chunk tables is shared by every namespace,
so it is split by hash instead, over 9 databases of about 1.9 TB. Each database
is a **primary**, the copy that takes writes, with **replicas**: copies kept
in step that serve reads and can be **promoted** to primary if it fails, as
[read replicas](/systems-and-infrastructure/read-replicas) describes. One small
lookup follows neither split: "which namespaces can this user see" is a copy
of `members` keyed by `user_id`.

Moving a file into a shared folder crosses namespaces and possibly shards, so
the server does it as two commits. It checks that the caller can edit both the
source and the destination, commits a new file in the destination listing the
same chunk hashes, then moves the source to the trash. The destination's
commit is an exception to the rule, in the first deep dive, that a version may
list only chunks its namespace holds or its caller uploaded; it is allowed
because the server has just confirmed the caller could read them. The two
commits are not one transaction, but the copy goes first, so a crash between
them leaves the file in both places rather than neither, and the retried move
(same idempotency key) finishes the job. No bytes move. A folder is moved by a
background job that repeats those two steps for each file inside it, recording
which files are done so a retry skips them; the folder shows as moving until
the job finishes. Sharing an existing folder works the same way: it creates a
new namespace and moves the folder's contents into it.

## API design

A client talks to the API servers for metadata and to the object store for
bytes. Uploading one file is three calls.

**1. Ask which chunks are needed.** The client has split the file into chunks
and hashed each one.

```http
POST /chunks/check
Authorization: Bearer <session-token>

{ "namespace_id": "ns_81", "hashes": ["9f2c…", "41ab…", "e07d…"] }
```

`Bearer` is the standard word in front of a token and means the request is
allowed for whoever holds (bears) it.

```json
{
  "missing": [
    {
      "hash": "41ab…",
      "upload_id": "up_77c1",
      "upload_url": "https://objects.example/blobs/up_77c1?X-Expires=900&X-Signature=…"
    }
  ]
}
```

Only chunks this namespace doesn't already hold, and that this user hasn't
already uploaded for a commit still to come, come back, each with a
**presigned URL**: an object-store address carrying a signature the API server
made with a secret key the object store also knows. The signature covers the
method (`PUT`), a fresh object key (`blobs/up_77c1`), an expiry (15 minutes)
and the chunk's SHA-256 as a required checksum, so the object store can check
the request on its own without calling back to the API servers, and the URL
can't be reused for any other object. The API server also records the pending
upload: this user, this hash, this key.

**2. Upload the missing chunks straight to the object store.**

```http
PUT https://objects.example/blobs/up_77c1?X-Expires=900&X-Signature=…
x-checksum-sha256: <the chunk's SHA-256>

<4 MB of bytes>
```

The object store recomputes the SHA-256 of what arrived and rejects the upload
if it doesn't match, so an object under that key holds exactly the bytes its
hash says. This design requires a store that can do that; some accept a
SHA-256 checksum as part of a signed upload, while others verify only MD5 or
CRC-based checksums. With one of those, a worker would instead read each new
chunk back and hash it before the commit may record it, which reads every
uploaded byte a second time (60 TB a day) and holds up a large file's commit
until all its chunks are checked.

**3. Commit the new version.**

```http
POST /files/commit
Authorization: Bearer <session-token>
Idempotency-Key: 5b1e0c2a-…

{
  "namespace_id": "ns_81",
  "file_id": "f_3302",
  "base_version": 7,
  "size": 11534336,
  "chunks": ["9f2c…", "41ab…", "e07d…"],
  "uploads": ["up_77c1"],
  "device_id": "laptop-a"
}
```

- `200 OK` with `{ "file_id": "f_3302", "version": 8, "seq": 1042 }`.
- `409 Conflict` with `{ "current_version": 8 }` if another commit, from
  another person or another of this user's devices, reached version 8 first
  (the conflicts deep dive).
- `403 Forbidden` if the caller is a viewer, not an editor, of the namespace.

A new file has no `file_id` or `base_version` yet and names its `parent_id`
and `name` instead. `base_version` is the version the client's edit started
from, which is how the server notices two edits made from the same starting
point. `uploads` names the uploads that supplied chunks the namespace didn't
already hold.

The `Idempotency-Key` matters more here than usual. If the commit succeeds but
the response is lost, the client retries with `base_version: 7`, finds the
current version is now 8 (its own), and without the key would report a
conflict with itself. With it, the server recognizes the retry and returns
the original `200`; [idempotency](/systems-and-infrastructure/idempotency)
covers the mechanism.

**Sync and download:**

```http
GET  /notifications                      a stream of "namespace ns_81 is at seq 1042"
GET  /changes?cursor=<cursor>            journal entries after the cursor, and a new cursor
GET  /files/f_3302/versions/8            the version's size and ordered chunk list
POST /files/f_3302/versions/8/downloads  { "hashes": ["41ab…"] } → one GET URL per hash
```

A **cursor** is an opaque token the server hands out, encoding the last `seq`
the device has seen in each namespace it can read. A journal entry says only
that a file changed ("`f_3302` is at version 8"); the client then fetches that
version's chunk list and asks for URLs for just the chunks it lacks. The server
signs presigned `GET` URLs, valid for 5 minutes, only for hashes in that
version and only after checking the caller can read the file.

**Everything else** is small. Moves and deletes carry what the client last
saw, so one made from stale information gets `409` instead of overwriting a
newer change, and a restore is a commit, so it carries a `base_version` too:

```http
POST   /files/f_3302/move      { "parent_id": …, "name": …, "expected_parent_id": …, "expected_name": … }
DELETE /files/f_3302?base_version=8
POST   /files/f_3302/restore   { "version": 5, "base_version": 8 }
POST   /namespaces/ns_81/members   { "user": …, "role": "editor" }
```

A rename is a move that keeps `parent_id`, a restore with no `version` takes a
file out of the trash, and a move into another namespace is the two-commit move
from the data model.

## High-level architecture

![Architecture of the file storage service. Sync clients send check, commit and change requests to the API servers, open a notification stream to the notification servers, and send and fetch chunk bytes directly to and from the object store using presigned URLs. The API servers read memberships from a permission cache, send commits and reads to the namespace database of 32 shards, where a nightly purge also runs, and send chunk lookups and new chunk records to the chunk index, which is split by hash. Journal rows flow from the namespace database to a journal relay, which publishes them to a change queue that the notification servers consume. Chunk reference changes flow from the namespace database to the garbage-collection and tiering workers, which update references and tiers in the chunk index, and read access logs from the object store, delete chunks there and move them between tiers.](/diagrams/file-storage/architecture.svg)

Arrows point from the side that starts a request (clients open the
notification stream, and notification servers consume the queue), except the
two leaving the namespace database, which show journal rows and chunk
reference changes flowing out to the relay and the workers. The pieces:

- **Sync clients** keep a local database of each file's version and chunk
  hashes, plus their cursor. A browser is a client too, one that downloads on
  demand instead of keeping a copy.
- **API servers** are stateless and handle every metadata request: permission
  checks, chunk checks, commits, change fetches. A load balancer in front of
  them and of the notification servers, left out of the diagram, spreads
  connections across them.
- The **permission cache** holds namespace memberships, so the check that runs
  on every request rarely reaches a database.
- The **namespace database** (32 shards) and the **chunk index** (9 shards,
  split by hash) are the metadata tables from the data model. A nightly purge
  job runs on each namespace shard, deleting expired versions and trash.
- The **object store** holds chunk bytes, and bytes move only between it and
  clients.
- The **journal relay** **tails** the journal, reading new rows as they are
  appended, and publishes each to the **change queue**; **notification
  servers** hold the clients' open connections and tell them when a namespace
  they can read has moved on (the sync deep dive).
- **GC and tiering workers** keep the chunk index's reference records current,
  delete chunks nothing uses, and move chunks between storage tiers (the last
  deep dive).

The bytes and the metadata take separate roads. At peak 56 Gbit/s of uploads
and 110 Gbit/s of downloads flow between clients and the object store, while
the API servers see small JSON requests. Routing the bytes through the API
servers would need that network capacity twice over (in from the client, out
to storage), and a slow upload from a phone on a train would hold a connection
for minutes. Presigned URLs let the API server decide who may upload what and
then step aside.

Following one edit, a user saving `inventory.db`, an 11.5 MB database file
that an inventory app updates in place, on their laptop:

1. The client notices the file changed, splits it into three chunks, hashes
   them, and finds that only the middle one differs from version 7.
2. `POST /chunks/check` goes to an API server, which checks in the permission
   cache that the user is an editor of the namespace, then looks up the hashes
   in `namespace_chunks`. One is missing; it returns a presigned `PUT` URL for
   it.
3. The client uploads that chunk to the object store directly.
4. `POST /files/commit` goes to an API server, which checks permissions again
   and confirms each listed chunk is either already in the namespace or came
   from an upload this caller was given and completed. It records the new
   chunk in the chunk index (the last deep dive gives the exact order), then
   runs the commit transaction on the namespace's shard. The file is now at
   version 8, journal seq 1042.
5. The journal relay picks up seq 1042 and publishes it to the change queue.
   The notification servers holding connections for the namespace's members
   pass it on.
6. The user's desktop receives the notification, calls `/changes` with its
   cursor, and sees `inventory.db` is at version 8. It fetches version 8's
   chunk list, compares it with its own, asks for a URL for the one chunk it
   lacks, and downloads it.

Every read path re-checks permissions: `/changes` returns entries only for
namespaces the caller is a member of, and the download call checks membership
before it signs any URL. Nobody gets a chunk by knowing
its hash; they get a URL for it only by being allowed to read a file that
contains it. The permission cache is what makes checking on every request
affordable at 230,000 requests a second: a membership entry is cached for 60
seconds and deleted from the cache whenever the membership changes, with the
TTL (time to live) as a backstop if that delete is missed, as
[cache invalidation](/systems-and-infrastructure/cache-invalidation) describes.

## Deep dive: chunked uploads and deduplication

Three ways to get a file's bytes into storage, from simplest:

**Upload the whole file through the API servers.** One request, one object per
file. It is easy to build, and every cost above lands on it: the API servers
carry all 56 Gbit/s at peak, a dropped connection 40 GB into a 50 GB upload
starts again from zero, and changing a few pages of a 2 GB database file
re-uploads 2 GB.

**Upload the whole file directly to the object store with a presigned URL.**
This takes the bytes off the API servers. Object stores offer multipart
uploads that make a single large upload resumable, which fixes the dropped
connection. But every version is still a complete copy, so the 2 GB edit still
uploads and stores 2 GB, and the 30-day history of a file edited daily costs
30 copies.

**Upload content-addressed chunks directly.** Cut the file into 4 MB chunks,
name each by its hash, and upload only the hashes the server doesn't have. A
50 GB file is 50,000 ÷ 4 = 12,500 chunks. If the connection drops after
9,000 of them, the client calls `/chunks/check` again, is told 3,500 are
missing, and carries on: resuming needs no special protocol, because "which
chunks are missing" is the same question whether this is a resume, an edit or
a brand-new file. An edit that rewrites a few regions of a 2 GB database file
in place touches, say, 3 of its 500 chunks and uploads 12 MB; version 8 shares
the other 497 chunks with version 7. That is why version history costs under
1% in the estimates.

This design uses content-addressed chunks, uploaded directly. Chunks cost
metadata and requests: about 29 TB of the metadata estimate is chunk lists and
chunk bookkeeping, and each chunk is a separate upload request. Smaller chunks
catch smaller edits but multiply both: at 1 MB, a 1 GB video is 1,000 uploads
and 1,000 list entries instead of 250. 4 MB is a middle ground.

Chunking also does little for some formats. An `.xlsx` spreadsheet is a zip
archive whose parts are compressed separately, and a typical one is under
4 MB, a single chunk, so any change uploads all of it. In a larger one,
changing one cell rewrites the part holding that sheet, which changes its
length, and every byte after it shifts, so with fixed 4 MB boundaries most
chunks from the edit onwards change.

**Fixed-size or content-defined boundaries.** That shifting is the weak spot of
cutting at every 4 MB: insert one line at the start of a 100 MB uncompressed
log and all 25 chunks change. **Content-defined chunking** places boundaries
where a rolling hash of the last few dozen bytes matches a pattern, so
boundaries move with the content and only the chunk around the insertion
changes. It costs variable-size chunks and more CPU on every client. This
design starts with fixed-size chunks, which handle appends and in-place edits
well, and would switch if measurements showed many uploads were
middle-of-file insertions.

**Deduplication, and who it is scoped to.** Content addressing means identical
bytes get identical hashes, so the same chunk can be stored once no matter how
many files contain it. The question is whether the client is told. If
`/chunks/check` answered "already have it" for a chunk that exists anywhere in
the service, clients would skip uploading any popular file (the same installer
or PDF that thousands of people have). But the answer would then leak
information about other people's files through a response never meant to
carry it, which is called a **side channel**. Someone who guesses a document's
contents, a standard offer-letter template with only the salary line varying,
say, can build each candidate, ask about it, and learn which one some other
user has stored. Worse, if "you already have it" let a client commit a version
listing that hash, then knowing a file's hash would be enough to download the
file.

Three scopes:

- **Global, visible to the client:** the most bandwidth saved, and the leak
  above.
- **Per namespace, visible to the client; global in storage, invisible:**
  `/chunks/check` only answers from `namespace_chunks`, so a client learns
  nothing about other namespaces. Copies, moves and re-uploads within your own
  files still skip the upload. A chunk someone else also has is uploaded again,
  and at commit the server finds its hash already in the chunk index, points
  the new version at the existing object and deletes the duplicate. The store
  keeps one copy, and the client sees the same responses whether or not the
  chunk existed.
- **None:** every upload stored separately. No leak and no savings, and 200 PB
  paid for in full.

This design takes the middle scope: it spends some upload bandwidth to close
the side channel, and keeps storage deduplicated. The commit enforces the other
half: a version may only list a hash that its namespace already holds, or one
this caller uploaded, proved by naming an upload the server issued to them
whose object now exists.

That rule is why uploads go to a fresh key like `blobs/up_77c1` rather than to
a key made from the hash. If every chunk lived at `chunks/<hash>`, the object's
existence would say nothing about who put it there, and "upload" would be
indistinguishable from "claim a hash someone else uploaded". The fresh key
costs a lookup from hash to key in the chunk index on every download. The
SHA-256 check on the `PUT` closes the other hole: without it, a client could
upload garbage while claiming the hash of a popular chunk, and if its upload
were recorded first, every file using that hash would be corrupted.

The estimates assumed no dedup savings, so whatever it saves is headroom.

## Deep dive: the sync protocol

A client has two jobs: find out that something changed, and fetch what
changed. They are handled separately. The sequence below is the `inventory.db`
edit from the architecture walkthrough, from device A's upload to device B's
download. The arrow from the namespace database to the notifier stands for
the journal relay and the change queue between them, and the chunk-index
writes are left out.

![Sequence of one edit syncing from device A to device B. Device A sends POST /chunks/check with hashes 9f2c, 41ab and e07d to the API server, which asks the namespace database which of them namespace ns_81 already holds, and answers that 41ab is missing, with an upload URL. Device A PUTs chunk 41ab's bytes to the object store, then sends a commit with base version 7. The API server writes version 8 and journal seq 1042 to the namespace database in one transaction and answers 200, version 8. The database's new journal row reaches the notifier, which tells device B that ns_81 is at seq 1042. Device B calls GET /changes and learns that f_3302, inventory.db, is at version 8. It fetches version 8's chunk list, 9f2c, 41ab and e07d, asks for a URL for 41ab, the only chunk it lacks, receives a signed URL, then GETs those bytes from the object store.](/diagrams/file-storage/edit-sync-sequence.svg)

**Fetching what changed** always goes through the journal. `/changes?cursor=…`
returns journal entries after the cursor's `seq` for each namespace, in order,
and a new cursor. The client applies them in order: for a modified file, it
fetches the new version's chunk list, compares it with its local list, and
downloads only the missing chunks. Entries whose `device_id` is the client's
own are its own commits, already applied. A laptop that was closed for a week
makes the same call as one that was offline for a second; it just gets more
entries back, a page at a time. The journal is kept 90 days. A client offline
longer gets "cursor expired" and does a full comparison of its local files
against the server's metadata, which is slow but rare.

Because the journal row is written in the same transaction as the version it
describes, the journal can't miss a commit or announce one that rolled back.
That makes it an outbox, in the sense of the
[outbox pattern](/systems-and-infrastructure/outbox-pattern): the relay reads
committed rows and publishes them to a
[message queue](/systems-and-infrastructure/message-queues), and if it
publishes one twice after a crash, a client asked to catch up to a `seq` it has
already reached does nothing.

**Finding out that something changed** has three options, which
[WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
compares in general. Here are their numbers:

- **Poll `/changes` every 30 seconds.** Simplest, and it misses the 10-second
  target outright, since a change can wait up to 30 seconds for the next poll.
  It is also mostly wasted work: 10 million online clients polling every 30
  seconds is about 333,000 requests a second. If each of the 4,600 commits a
  second at peak is news to one or two other devices, at most 9,200 of those
  polls have anything to report, so about 97–99% answer "nothing new". Polling
  every 5 seconds to meet the target would make it 2 million a second.
- **Long polling:** each client asks `/notifications`, and the server holds the
  request until something changes or 60 seconds pass. Changes arrive within
  about a second, but 10 million clients whose requests time out every minute
  still send 10,000,000 ÷ 60 ≈ 167,000 empty requests a second.
- **A persistent stream** (server-sent events or a WebSocket): one connection
  per client, held open, carrying a small message only when a namespace moves
  on. Changes arrive within about a second, and an idle connection costs a
  little memory and an occasional **heartbeat**, a tiny message sent every so
  often to show the connection is still alive. 10 million of them need about
  100 notification servers, and the servers have to track which client is
  connected where.

This design uses a server-sent events stream, since messages only flow from
server to client, and falls back to long polling on networks that break
long-lived streams. The notification carries only "namespace ns_81 is at seq
1042", never the change itself. That keeps one path for applying changes (the
journal), and it means a lost notification costs nothing worse than a delay.
When a client reconnects, it calls `/changes` straight away, and it also calls
it every 10 minutes regardless, in case a notification went missing. That
backstop is 10,000,000 ÷ 600 ≈ 17,000 requests a second at peak, a twentieth of
30-second polling, and it is part of the 100 requests a day in the estimates.

One commit notifies every online device of every member of its namespace. For
a user's own files that is one or two devices; for a shared folder with 5,000
members it is up to 10,000, which the failure modes come back to.

## Deep dive: conflicting edits

A user edits `inventory.db` on a laptop on a plane, and edits it on a desktop
at home before the laptop lands. Both edits started from version 7. The
desktop commits first, creating version 8. When the laptop reconnects and
commits with `base_version: 7`, the server sees the file is at 8. Rejecting a
commit whose base is stale is optimistic concurrency control, the technique
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
describes: the version check and the update run in one transaction, so two
commits racing from the same base can't both succeed, the failure
[race conditions](/systems-and-infrastructure/race-conditions) describes. A
pessimistic lock ("check the file out before editing") would not work here at
all: an offline device can't take a lock, and people edit on planes.

Detecting the conflict is the easy half. What to do with the losing edit has
three answers:

**Last writer wins.** The laptop's commit simply becomes version 9. Nobody is
interrupted, but the desktop's edit has silently vanished from the current
file, surviving only in version history. "Last" also means last to reach the
server, which says nothing about which edit the user cares about more.

**Merge the two edits automatically.** This works when the format's structure
is known. Two edits to different lines of a plain-text file can be combined
with a three-way merge, which compares each side against the common ancestor,
version 7, the way version control tools do; applications built for
collaborative editing go further by recording each edit as an operation that
can be combined with others. A file store sees arbitrary bytes. For a database
file, a spreadsheet or a Photoshop file, combining changed byte ranges from
two versions produces a file that is at best one of the two edits and at worst
corrupt, and there is no generic way to tell which.

**Keep both.** The laptop's edit is saved as a new file next to the original,
`inventory (conflicted copy, laptop-a, 2026-09-28).db`, and version 8 stays
current. Nothing is lost and nothing is guessed. The cost is that the user has
to notice the copy and reconcile the two by hand, and a careless client that
kept conflicting would fill the folder with copies.

This design keeps both, because the requirement is that neither edit is lost
and the service can't understand the contents well enough to merge them. On a
`409`, the client commits its version as a new file with the conflicted-copy
name (its chunks are uploaded and the failed commit kept their pending
records, so this is a metadata-only commit),
then downloads version 8 as usual.

The same checks settle the other combinations:

- **Edit on one device, delete on another.** If the delete arrives second, its
  `base_version` is stale, so it gets `409` and the client downloads the newer
  version instead of deleting it. If the edit arrives second, its
  `base_version` matches the version that was deleted, so the server takes the
  file out of the trash and commits the edit. Either way the edit survives: a
  delete can be redone in a click, and a lost edit can't.
- **Two renames.** The second arrives with an `expected_name` that no longer
  matches, gets `409`, and the client takes the server's name. The first
  rename wins, since a name carries no work that can be lost.
- **Two new files with the same name.** A new file has no base to check, so
  the second to commit hits the unique name index instead, gets `409`, and is
  committed as a conflicted copy.
- **A folder deleted while a file inside is edited.** The edit's commit finds
  the file in the trash with its folder; the server restores the file and each
  trashed folder on its path, so the edit reappears where the user left it.

## Deep dive: versions, trash and storage tiers

**How versions are stored.** Storing each version as a full copy is simple and
makes old versions independent, but a 2 GB file edited daily would hold 60 GB
of history for 30 days. Storing each version as a binary diff against the
previous one is compact, but restoring version 3 means reading version 1 and
applying every diff after it, and one damaged diff breaks every later version.
Chunk lists do neither: every version is a complete list of chunks, so any
version can be read directly, and unchanged chunks are shared, so a version
costs only its new chunks plus a row. Restoring version 5 is a new commit whose
chunk list is version 5's; nothing is copied.

**Trash and retention.** Deleting a file sets `deleted_at` and appends a journal
entry, which removes it from every device. The row and its versions stay for 30
days, and restoring clears `deleted_at`. A nightly purge then permanently
deletes versions replaced more than 30 days ago (the current version is never
expired) and files whose `deleted_at` is more than 30 days old. Clients never hear about
this purge: the file already left their devices when it was deleted.

**Deleting the bytes.** Removing metadata rows doesn't free storage. A chunk's
object can be deleted only when no version in any namespace refers to it, and
since chunks are shared across namespaces, that is a global question, answered
by the per-chunk tables on the hash-split databases. Two ways to keep them
current:

- **Update them inside each commit.** Exact and immediate, but the commit runs
  on the namespace's shard and `chunk_refs` lives on the hash-split databases,
  so every commit that starts or stops a namespace's use of a chunk would
  become a transaction across several databases.
- **Update them asynchronously, and wait before deleting.** Each namespace
  shard records its changes locally, workers carry them over, and nothing is
  deleted until a chunk has gone unused for 7 days.

This design updates asynchronously. Step by step:

1. **Record the change where it happens.** Anything that changes
   `namespace_chunks` (a commit, the nightly purge of old versions and the
   trash, a move) does so in one transaction on the namespace's shard. When a
   chunk's count goes from 0 to 1 or from 1 to 0, the same transaction appends
   an `added` or `removed` row to `ref_changes`. This is a second outbox,
   separate from the journal, because clients have no use for it and the
   purge writes no journal rows.
2. **Carry it over.** Workers read each namespace's `ref_changes` in order.
   For `added`, they insert the `(hash, namespace_id)` row into `chunk_refs`
   and clear the chunk's `unreferenced_since`, in one transaction, since
   `chunk_refs` and `chunks` are split by the same hash and live on the same
   database. For `removed`, they delete that row and, if the chunk has no rows
   left, set `unreferenced_since` to now. Replaying a change after a crash is
   harmless: inserting a row that exists or deleting one that is gone changes
   nothing.
3. **Collect.** The collector deletes a `chunks` row, in one transaction, only
   if `unreferenced_since` is more than 7 days old _and_ the chunk has no
   `chunk_refs` rows. Only then does it delete the object.
4. **Claim before committing.** Every commit that takes a namespace's count for
   a chunk from 0 to 1, whether the chunk came from this upload, another user's
   or the namespace's own past, first writes to that chunk's hash-split
   database, in one transaction. If the hash has no `chunks` row, it inserts
   one pointing at the caller's upload, with `unreferenced_since` set to now,
   and marks the pending-upload record `claimed`, so the object now belongs to
   `chunks`. If the row exists and `unreferenced_since` is set, it resets it to
   now. Only then does the namespace commit run, and only after that succeeds
   do the caller's pending records for those hashes go, each with its object
   unless it was claimed. A commit that fails, or loses to a conflict, keeps
   them, so its retry can still prove the upload. If the row is gone and the
   caller has no upload for it, the commit is refused with that hash listed as
   missing.

The reset timer is what makes lagging workers and failed commits safe. A chunk
that was just claimed can't be collected for 7 days; if its commit succeeded,
the `added` row clears the timer long before then, and if the commit failed,
nothing clears it, so the chunk is collected as it should be. A live chunk can
be lost only if an `added` row waits more than 7 days to be carried over. A
worked timeline, for chunk H:

- **Day 0.** The nightly purge removes the last version in namespace A that
  uses H. A worker carries A's `removed` row over; H has no `chunk_refs` rows,
  so its timer starts.
- **Day 6.** A user in namespace B uploads a file containing H. At commit the
  server finds H in `chunks`, resets its timer to day 6, commits, and then
  deletes B's duplicate upload.
- **Day 6, 3 minutes later.** The worker carries B's `added` row over, inserts
  `(H, B)` and clears the timer. On day 7 the collector sees a row for H and
  leaves it. Had B's commit failed, nothing would clear the timer, and on day
  13 the collector would delete H.

An occasional slow full scan compares `chunk_refs` with every namespace's
`namespace_chunks` to catch drift. Uploads that were never committed (the
client crashed between steps 2 and 3 of an upload) never reach `chunks`; their
pending-upload records expire after 7 days and their objects are deleted with
them. A `claimed` record expires alone, since its object belongs to `chunks`
and leaves through the collector.

**Hot and cold storage.** Most stored bytes are rarely read: photos from three
years ago, finished projects. Object stores sell tiers at very different
prices. Roughly, at public cloud list prices in 2026:

- A **hot** tier costs about $0.02 per GB-month with no retrieval fee.
- A **cold** tier that still answers reads in milliseconds costs about $0.004
  per GB-month, charges a few cents per GB to read, bills a minimum storage
  period (often 30 to 90 days), and at some providers bills any object under
  128 KB as if it were 128 KB.
- An **archive** tier costs about $0.001 per GB-month. Some archive tiers take
  hours to return a read; others answer quickly but charge far more per read
  and bill minimum periods of up to a year. Neither fits files a user expects
  to open on demand, or may delete next month.

With 200 PB, 200,000,000 GB:

- All hot: 200,000,000 × $0.02 = **$4,000,000 a month**.
- Assume 80% of bytes haven't been read for 90 days and move to cold:
  160,000,000 GB × $0.004 = $640,000, plus the remaining 40,000,000 GB hot ×
  $0.02 = $800,000, for **$1,440,000 a month**.
- If 1% of the cold bytes are read in a month at $0.03 a GB:
  1,600,000 × $0.03 = $48,000.
- Tiered total: about $1,490,000, **about 63% less**, saving about $2,500,000
  a month.
- Moving objects between tiers is billed per object too, around $0.02 per
  1,000. Moving 80% of 120 billion chunks is at most 96 billion transitions,
  **at most about $1,900,000 once**, up to three-quarters of one month's
  saving, and a chunk moved back costs a transition again.

Where the 128 KB minimum applies, it matters because many files are small, so
the tiering worker leaves chunks under 128 KB hot: they are a large share of
the objects but a small share of the bytes, which keeps most of the saving and
brings the transition bill below that upper bound. For the rest, it moves a
chunk to cold once its last read is more than 90 days old. A chunk is shared,
so it is cold only if every file using it has gone unread; the worker tracks
reads per chunk, in `last_read`, filled in batches from the object store's
access logs (its record of every request it served), so only real downloads
count. The cost is on the rare read: the service pays the retrieval fee, and a
file that turns out to be read often is moved back.

One cost the tiers don't change is **egress**, the charge for bytes leaving
the provider's network, billed on every tier: 120 TB of downloads a day is
3.6 PB a month, about $180,000 at roughly $0.05 per GB.

## Failure modes and bottlenecks

**A large shared folder.** A namespace with 5,000 members, each with two
devices online, turns one commit into 10,000 notifications and 10,000
`/changes` calls to one shard within a second or two. A burst of edits there
makes that a sustained load on one database, the shape of the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).
Two measures take most of it: the page of journal entries after a given `seq`
is the same for every member, so API servers keep recent pages in a
[cache](/systems-and-infrastructure/caching) and serve thousands of identical
requests from one read; and notification servers add a random delay of up to a
few seconds before telling each client, spreading the fetches out. A namespace
that is still too busy gets a shard of its own.

**The object store is slow or unavailable.** Uploads and downloads fail, while
browsing, renaming and sharing keep working because they need only metadata.
Clients retry chunk transfers with
[exponential backoff](/systems-and-infrastructure/exponential-backoff), so that
thousands of clients don't retry in lockstep. A save made meanwhile stays on
the device until its chunks upload, and the commit waits for them.

**A metadata shard fails.** The namespaces on that shard can't commit or sync
until a replica is promoted to primary; the other 31 shards are unaffected. The
replicas are kept in step synchronously, so a promoted replica has every
commit the primary acknowledged. The journal's `seq` makes recovery simple for
clients: their cursors still name a position in the same history. A failed
chunk-index shard blocks commits that bring new chunks and downloads of
chunks on it until its replica takes over.

**The relay or the queue falls behind.** Notifications arrive late, but commits
and the journal are unaffected, and clients still catch up on their 10-minute
check. The gap between the newest `seq` stored and the newest published is
worth alerting on, since it eats into the 10-second target.

**A revoked share.** Removing a member deletes their cached membership, so their
next request is refused. A download URL signed in the last 5 minutes keeps
working until it expires, and files already synced to their devices stay there:
revoking access stops future reads, and it can't reach back into a disk the
service doesn't control.

**An abandoned upload.** A phone that uploads 3,000 chunks and is then thrown
in a drawer leaves 12 GB with no commit. The chunks cost storage until their
pending-upload records expire after 7 days and the objects are deleted; if the
phone comes back sooner, `/chunks/check` finds them already there and the
upload resumes.

## Trade-offs

- **Metadata and contents apart.** Each store does what it's good at, with
  transactions over 80 TB in one and cheap durable bytes over 200 PB in the
  other. The price is that they can disagree, which is why a commit checks that
  its chunks exist and why garbage collection needs a grace period.
- **Chunks over whole files.** Resumable uploads, small uploads for edits and
  cheap version history, paid for with about 29 TB of chunk lists and
  bookkeeping, a request per chunk and a garbage collector. Small files and
  compressed formats get little of the benefit.
- **Per-namespace dedup visible to clients.** No side channel, and copies within
  your own files still skip the upload; a popular file is uploaded again by each
  user who adds it, though stored once.
- **Presigned URLs.** The API servers handle requests, not bytes, and
  permissions are still checked for every URL issued. A URL that has been handed
  out can't be recalled before it expires, and the design depends on an object
  store that verifies SHA-256 on upload.
- **Notify, then pull from the journal.** One way to apply changes and a
  notification channel that can drop messages safely, at the cost of an extra
  round trip per change and 100 servers holding 10 million connections.
- **Conflicted copies over last writer wins.** No edit is lost, in exchange for
  asking the user to reconcile two files by hand.
- **Tiered storage.** About 63% off the storage bill, paid for with a one-time
  transition fee of up to three-quarters of a month's saving, fees on reads of old files, and a
  worker to move chunks around.

What would change the design: if most usage moved to documents edited in the
browser, the unit of change would become an operation inside a document rather
than a file version, and that part would be a collaborative editor's problem
rather than a sync client's. If users required that the service can't read
their files, encryption with keys only the users hold would make cross-user
deduplication impossible, since the same file would encrypt to different bytes
for different users, and the storage estimate would no longer have any dedup
headroom.
