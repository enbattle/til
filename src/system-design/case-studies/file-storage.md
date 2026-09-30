---
title: Design Cloud File Storage (like Google Drive or Dropbox)
summary: Keeping every device's copy of your files in step by storing metadata apart from bytes, uploading files as hashed chunks straight to object storage, and syncing each device from a change log kept for each user's files and each shared folder.
date: 2026-09-28
order: 6
---

A cloud file storage service keeps a folder of files in step across every
device a person uses. Save a database file on your laptop and, a few seconds
later, the new version is on your desktop at work, in a browser, and with the
colleague you shared the folder with. The software on each laptop or desktop
that watches the local folder, uploads what changed and downloads what changed
elsewhere is the **sync client**.

Two very different kinds of data are involved. The **contents** of the files
are large, opaque bytes: a 2 MB PDF, a 4 GB video. The **metadata** is
everything the service knows _about_ them: names, which folder each file sits
in, who may open it, which version is current. Metadata is small, heavily
queried and has to stay consistent (two files can't share one name in the same
folder); contents are huge, written once and read whole. The design keeps them
in different systems built for each job, and most of its decisions follow from
that split.

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
  with no new reference ([deleting the bytes](#deep-dive-chunked-uploads-and-deduplication)).
- What does cold storage save? Moving the 80% of bytes unread for 90 days cuts
  $4,000,000 a month to about $1,490,000
  ([storage cost](#back-of-the-envelope-estimates)).
- What about a shared folder with 5,000 members? One commit means 10,000
  notifications, so API servers cache journal pages and notifications go out
  with a random delay ([failure modes](#failure-modes-and-bottlenecks)).

The [high-level architecture](#high-level-architecture) follows one edit from a laptop to a desktop.

## Requirements

Functional requirements:

- **Upload and download.** Add a file of up to 50 GB from any device, and get
  any file back. An interrupted upload resumes where it stopped.
- **Sync.** Every device running the sync client ends up with the same files,
  without anyone asking, including changes made while a device was offline.
- **Folders.** Create, rename, move and delete files and folders.
- **Sharing.** Share a folder with other users as a viewer (can read) or an
  editor (can change). Every read and write is checked against those
  permissions.
- **Version history and trash.** Keep each replaced version for 30 days, and
  each deleted file in the trash for 30 days, and let the user restore either.
- **Conflicting edits.** When the same file is edited on two devices before
  either sees the other's change, neither edit is lost.

Out of scope: real-time co-editing inside a document (a document editor's
problem), full-text search, previews, public link sharing, sharing a single
file rather than a folder, and sign-up, quotas and billing.

Non-functional requirements:

- **Scale:** 50 million registered users, 10 million active on a given day.
  The average user stores 4 GB in 2,000 files, and each active user saves
  (creates or changes) 4 files a day. Each user runs the sync client on 2
  devices, each holding a full copy of their files.
- **Durability:** a file whose upload was confirmed is never lost: eleven
  nines (99.999999999%) per object per year, the figure large object stores
  are designed for.
- **Sync latency:** a change reaches the user's other online devices within 10
  seconds at the 99th percentile (p99, the time 99% of cases beat), not
  counting the byte transfer itself.
- **Metadata latency:** listing a folder or committing a change takes under
  200 ms at p99.
- **Availability:** 99.9% for sync and metadata, about 43 minutes of downtime
  in a 30-day month. A late sync is an annoyance; a lost file is not.

## Back-of-the-envelope estimates

The rules of thumb come from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know):
plan for a peak about ten times the average, on a day of 86,400 seconds. Units
are decimal (a GB is 1,000 MB), and figures are rounded.

**Saves (metadata commits).** Every save ends in one metadata write:
10,000,000 users × 4 = 40,000,000 a day, 40,000,000 ÷ 86,400 ≈ 463, so
**about 460 commits a second**, and **about 4,600 a second** at peak.

**Bandwidth.** Assume a save uploads 1.5 MB on average once unchanged parts of
a file are skipped (the first deep dive shows how).

- Uploads: 40,000,000 × 1.5 MB = **60 TB a day**, 60 TB ÷ 86,400 ≈ 694 MB a
  second, about 5.6 Gbit/s, and **about 56 Gbit/s** at peak.
- Downloads: the user's other device fetches each save, and browsers and
  shared-folder members add more; call it **twice the uploads**, 120 TB a
  day, 11 Gbit/s on average and 110 Gbit/s at peak.

**File contents stored.** 50,000,000 users × 4 GB = **200 PB**, growing by
60 TB × 365 ≈ 21.9 PB a year before deletions. Version history adds at most
30 days × 60 TB = 1.8 PB, under 1%, because a new version stores only the
parts that changed.

**Metadata stored.** Files are cut into 4 MB chunks (the data model explains
them). Most files fit in one chunk and a few are much larger; assume 1.2
chunks per file. 50,000,000 users × 2,000 files = **100 billion files** (the
average is 4 GB ÷ 2,000 = 2 MB), so about 120 billion chunks.

- File row plus current version row, with indexes, about 500 bytes:
  100 billion × 500 bytes = 50 TB.
- Chunk lists, about 40 bytes per entry: 120 billion × 40 bytes = 4.8 TB.
- Older versions kept 30 days: 40,000,000 × 30 = 1.2 billion rows × 500 bytes
  = 0.6 TB.
- The change log: 100 bytes per save, 4 GB a day, kept 90 days = 0.36 TB.
- Each namespace's chunk counts, about 60 bytes a row: 120 billion × 60 bytes
  = 7.2 TB.
- The global chunk index, about 100 bytes a row: 12 TB; and which namespaces
  use each chunk, about 40 bytes a row: 4.8 TB.
- Total: 50 + 4.8 + 0.6 + 0.36 + 7.2 + 12 + 4.8 ≈ **80 TB of metadata**, about
  63 TB kept per namespace and 17 TB per chunk.

**Metadata reads.** 10 million active users × 2 devices = 20 million active
sync clients. Each is online about 8 hours and checks for changes every 10
minutes as a backstop (the sync deep dive), 48 requests; add about 50 for
start-up, change fetches and folder listings, and call it 100 a day. That is
2 billion a day ÷ 86,400 ≈ 23,148, **about 23,000 a second**, and **about
230,000 a second** at peak.

**Open notification connections.** Half the 20 million clients online at the
busiest time: **10 million connections**, 100 servers at a conservative
100,000 idle connections each.

**Storage cost.** Most stored bytes are rarely read. At rough 2026 public
cloud list prices, a **hot** object tier costs about $0.02 per GB-month; a
**cold** tier still answers in milliseconds for about $0.004, but charges a
few cents per GB read, bills a minimum storage period (often 30 to 90 days)
and, at some providers, bills any object under 128 KB as 128 KB. **Archive**
tiers are cheaper but slow to read or billed for up to a year, which doesn't
fit files opened on demand. For 200,000,000 GB:

- All hot: 200,000,000 × $0.02 = **$4,000,000 a month**.
- Move the 80% of bytes unread for 90 days to cold: 160,000,000 GB × $0.004 =
  $640,000, plus 40,000,000 GB hot × $0.02 = $800,000, **$1,440,000**.
- If 1% of the cold bytes are read in a month at $0.03 a GB: 1,600,000 ×
  $0.03 = $48,000, for about **$1,490,000**, **about 63% less**.
- Transitions cost around $0.02 per 1,000 objects: at most 96 billion of the
  120 billion chunks, **at most about $1,900,000 once**, up to three-quarters
  of a month's saving.

This design tiers, leaving chunks under 128 KB hot (many objects, few bytes).
A shared chunk moves to cold only when its `last_read`, filled from the object
store's access logs, is over 90 days old, and moves back if it turns out to be
read often.

Tiers don't change **egress**, the charge for bytes leaving the provider's
network: 120 TB of downloads a day is 3.6 PB a month, about $180,000 at
roughly $0.05 per GB.

What the estimates say: the bytes are the big number, and the metadata is the
delicate one: 80 TB, too much for one server, with 230,000 reads a second and
consistency required on every write. File bytes should never pass through the
metadata servers, and metadata should be split so each commit stays on one
machine.

## Data model

**Contents** go to an **object store** such as S3: a service that keeps blobs
of bytes under string keys, with put, get and delete but no editing in place,
queries or transactions. It is cheap per byte, scales to exabytes, and keeps
several copies of each object or uses **erasure coding**: fragments plus
parity fragments spread across buildings, any large enough subset of which
rebuilds it.

Each file is cut into **chunks** of up to 4 MB, each identified by its
**SHA-256 hash**: a 32-byte fingerprint computed from the bytes, the same for
the same bytes and, in practice, different for different bytes. A version of
a file is an ordered list of chunk hashes; naming data by a hash of its
contents is **content addressing**. Each chunk's bytes sit in the object store
once, under an object key recorded against its hash.

**Metadata** goes to a relational database, grouped by **namespace**: a tree
of folders and files with its own members. A user's own files form one
namespace, and each shared folder is another, which appears inside each
member's tree.

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
renaming a folder with 10,000 files in it updates one row.

The **journal** is the change log sync runs on. Every commit takes the next
number from `namespaces.next_seq` and appends one journal row, so the journal
is a gap-free, ordered history of the namespace, and its primary key answers
"everything in this namespace after seq 1041" with one range read. The unique
`(namespace_id, parent_id, name)` index both enforces one name per folder and
serves folder listings, as
[database indexing](/systems-and-infrastructure/database-indexing) explains.
The remaining tables track where chunks live and who uses them, for the
**garbage collector** that deletes unused chunk bytes (the first deep dive).

**Versions and trash.** Every version is a complete chunk list sharing
unchanged chunks, so any version reads directly and costs only its new chunks
plus a row; full copies would hold 60 GB of history for a 2 GB file edited
daily, and binary diffs would make a restore replay every diff since. Restoring
version 5 is a new commit listing version 5's chunks. Deleting sets
`deleted_at` and appends a journal entry, removing the file from every device.
A nightly purge deletes versions replaced, and files trashed, more than 30
days ago.

A relational database fits because a commit is a small all-or-nothing
transaction over several rows (version check, version row, chunk counts,
`seq`, journal row); [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)
covers the trade. The 63 TB kept per namespace is split by `namespace_id` into
**shards**, separate databases each holding one slice of the data. Every row a
commit touches carries the same `namespace_id`, so a commit never spans two
databases. At about 2 TB each, 63 ÷ 2 ≈ 31.5 rounds up to **32 shards**, each
taking about 4,600 ÷ 32 ≈ 144 commits and 230,000 ÷ 32 ≈ 7,200 reads a second
at peak ([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)).
The 17 TB of per-chunk tables is shared by every namespace, so it is split by
hash instead, over 9 databases of about 1.9 TB. Each database is a
**primary**, the copy that takes writes, with **replicas**: copies kept in
step that serve reads and can be **promoted** to primary if it fails
([read replicas](/systems-and-infrastructure/read-replicas)). "Which
namespaces can this user see" is a copy of `members` keyed by `user_id`.

Moving a file into a shared folder crosses namespaces and possibly shards, so
it is two commits, after checking the caller can edit both sides: a new file
in the destination listing the same chunks, then the source moved to the
trash. The copy goes first, so a crash leaves the file in both places rather
than neither, and the retried move (same idempotency key) finishes it. A
folder moves file by file in a background job that records its progress, and
sharing an existing folder creates a namespace and moves its contents in.

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

`Bearer` means the request is allowed for whoever holds (bears) the token.

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

Only chunks this namespace doesn't hold (and this user hasn't already uploaded
for a pending commit) come back, each with a **presigned URL**: an
object-store address signed with a secret the object store also knows,
covering the method (`PUT`), a fresh object key (`blobs/up_77c1`), a 15-minute
expiry and the chunk's SHA-256 as a required checksum. The object store checks
it without calling the API servers, and the API server records the pending
upload: this user, this hash, this key.

**2. Upload the missing chunks straight to the object store.**

```http
PUT https://objects.example/blobs/up_77c1?X-Expires=900&X-Signature=…
x-checksum-sha256: <the chunk's SHA-256>

<4 MB of bytes>
```

The object store recomputes the SHA-256 and rejects a mismatch. Some stores
verify only MD5 or CRC checksums; with those, a worker would have to read back
and hash every new chunk (60 TB a day) before a commit could record it.

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
- `409 Conflict` with `{ "current_version": 8 }` if another commit reached
  version 8 first (the conflicts deep dive).
- `403 Forbidden` if the caller is a viewer, not an editor.

`base_version` is the version the edit started from (a new file names its
`parent_id` and `name` instead), and `uploads` names the uploads that supplied
new chunks. The `Idempotency-Key` matters more than usual: if the commit succeeds but the response is lost, the retry finds
version 8 (its own) and, without the key, would report a conflict with
itself. With it, the server returns the original `200`
([idempotency](/systems-and-infrastructure/idempotency)).

**Sync and download:**

```http
GET  /notifications                      a stream of "namespace ns_81 is at seq 1042"
GET  /changes?cursor=<cursor>            journal entries after the cursor, and a new cursor
GET  /files/f_3302/versions/8            the version's size and ordered chunk list
POST /files/f_3302/versions/8/downloads  { "hashes": ["41ab…"] } → one GET URL per hash
```

A **cursor** is an opaque token encoding the last `seq` the device has seen in
each namespace it can read. A journal entry says only "`f_3302` is at version
8"; the server signs 5-minute `GET` URLs only for hashes in that version,
after checking the caller can read the file.

**Everything else** is small. Moves, deletes and restores carry what the
client last saw, so one made from stale information gets `409`:

```http
POST   /files/f_3302/move      { "parent_id": …, "name": …, "expected_parent_id": …, "expected_name": … }
DELETE /files/f_3302?base_version=8
POST   /files/f_3302/restore   { "version": 5, "base_version": 8 }
POST   /namespaces/ns_81/members   { "user": …, "role": "editor" }
```

A rename is a move that keeps `parent_id`, and a restore with no `version`
takes a file out of the trash.

## High-level architecture

![Architecture of the file storage service. Sync clients send check, commit and change requests to the API servers, open a notification stream to the notification servers, and send and fetch chunk bytes directly to and from the object store using presigned URLs. The API servers read memberships from a permission cache, send commits and reads to the namespace database of 32 shards, where a nightly purge also runs, and send chunk lookups and new chunk records to the chunk index, which is split by hash. Journal rows flow from the namespace database to a journal relay, which publishes them to a change queue that the notification servers consume. Chunk reference changes flow from the namespace database to the garbage-collection and tiering workers, which update references and tiers in the chunk index, and read access logs from the object store, delete chunks there and move them between tiers.](/diagrams/file-storage/architecture.svg)

Arrows point from the side that starts a request, except the two leaving the
namespace database, which show journal rows and chunk reference changes
flowing out. **Sync clients** keep a local record of each file's version,
chunk hashes and their cursor; a browser is a client that downloads on demand.
**API servers** are stateless, behind a load balancer left out of the diagram,
and a **permission cache** keeps the check on every request off the
databases. The **journal relay** **tails** the journal, reading rows as they
are appended, and publishes each to the **change queue**, from which
**notification servers** tell connected clients a namespace moved on. **GC and
tiering workers** delete unused chunks and move chunks between tiers.

Bytes and metadata take separate roads. Routing 56 Gbit/s of uploads and
110 Gbit/s of downloads through the API servers would need that capacity twice
over (in from the client, out to storage), and a slow upload from a phone
would hold a connection for minutes. Presigned URLs let the API server decide
who may upload what and then step aside.

Following one edit, a user saving `inventory.db`, an 11.5 MB database file an
app updates in place:

1. The client splits the file into three chunks and finds only the middle one
   differs from version 7.
2. `POST /chunks/check`: the API server confirms the user is an editor, looks
   up the hashes in `namespace_chunks`, and returns a `PUT` URL for the
   missing one.
3. The client uploads that chunk to the object store directly.
4. `POST /files/commit`: the API server checks permissions again, confirms
   each chunk is in the namespace or came from an upload this caller
   completed, records the new chunk in the chunk index, then runs the commit
   transaction. The file is at version 8, journal seq 1042.
5. The relay publishes seq 1042 to the change queue, and the notification
   servers pass it to the namespace's members.
6. The user's desktop calls `/changes`, sees version 8, compares its chunk
   list with its own, and downloads the one chunk it lacks.

Every read path re-checks permissions, so nobody gets a chunk by knowing its
hash. At 230,000 requests a second that relies on the permission cache: an
entry lives 60 seconds and is deleted whenever the membership changes, the TTL
(time to live) being the backstop
([cache invalidation](/systems-and-infrastructure/cache-invalidation)).

## Deep dive: chunked uploads and deduplication

Three ways to get a file's bytes into storage:

- **The whole file through the API servers.** Easy, and every cost lands on
  it: the API servers carry 56 Gbit/s at peak, a connection dropped 40 GB into
  a 50 GB upload starts again, and a few changed pages in a 2 GB database file
  re-upload 2 GB.
- **The whole file straight to the object store.** Multipart uploads make it
  resumable, but every version is still a full copy: the 2 GB edit uploads and
  stores 2 GB, and 30 days of daily edits cost 30 copies.
- **Content-addressed chunks, straight to the object store.** Upload only the
  hashes the server lacks. A 50 GB file is 12,500 chunks; if the connection
  drops after 9,000, `/chunks/check` reports 3,500 missing, and the client
  carries on. Resuming, editing and a new file are the same question. An edit
  that rewrites 3 of a 2 GB file's 500 chunks uploads 12 MB, and version 8
  shares the other 497 with version 7, which is why history costs under 1%.

This design uses chunks. They cost about 29 TB of chunk lists and bookkeeping
and an upload request each; at 1 MB, a 1 GB video would be 1,000 uploads
instead of 250. Chunking does little for compressed formats: a typical
`.xlsx` is a zip archive under 4 MB, one chunk, so any change uploads all of
it. Fixed boundaries also fail on insertions: one line added at the start of
a 100 MB log changes all 25 chunks. **Content-defined chunking** cuts where a
rolling hash of recent bytes matches a pattern, so boundaries move with the
content, for variable-size chunks and more client CPU. This design starts
fixed, which handles appends and in-place edits, and would switch if many
uploads proved to be mid-file insertions.

**Deduplication, and who sees it.** Identical bytes get identical hashes, so a
chunk can be stored once however many files contain it. The question is
whether the client is told. If `/chunks/check` said "already have it" for a
chunk anywhere in the service, the answer would leak other people's files
through a **side channel**: someone who can guess a document (an offer-letter
template with only the salary varying) builds each candidate, asks, and learns
which one another user stored. And if that answer let a client commit the
hash, knowing a hash would be enough to download the file. Three scopes:

- **Global and visible:** the most bandwidth saved, and the leak.
- **Per namespace visible, global in storage:** `/chunks/check` answers only
  from `namespace_chunks`, so copies and re-uploads within your own files skip
  the upload. A chunk someone else has is uploaded again; at commit the server
  finds the hash in the chunk index, points the version at the existing
  object and deletes the duplicate.
- **None:** no leak, and 200 PB paid in full.

This design takes the middle scope, spending upload bandwidth to close the
side channel while storage stays deduplicated. The estimates assumed no dedup
savings, so whatever it saves is headroom. The commit enforces the other half:
a version may list only hashes its namespace holds, or ones this caller
uploaded, proved by naming an upload issued to them whose object exists. (A
move into a shared folder is the one exception, allowed because the server
has just confirmed the caller can read the chunks.) That is why uploads go to
a fresh key like `blobs/up_77c1`: at `chunks/<hash>`, an object's existence
wouldn't say who put it there. The SHA-256 check on the `PUT` closes the other
hole, a client uploading garbage under a popular chunk's hash and corrupting
every file that uses it.

**Deleting the bytes.** A chunk's object can go only when no version in any
namespace refers to it, a global question answered by `chunk_refs` on the
hash-split databases. Updating `chunk_refs` inside each commit would make
every commit that starts or stops a namespace's use of a chunk a transaction
across databases. So the design updates it asynchronously and waits before
deleting:

1. A transaction on a namespace shard (a commit, the purge, a move) that takes
   a chunk's `ref_count` from 0 to 1 or 1 to 0 appends an `added` or `removed`
   row to `ref_changes`, a second
   [outbox](/systems-and-infrastructure/outbox-pattern) beside the journal.
2. Workers carry those rows over in order, inserting or deleting the
   `(hash, namespace_id)` row and, in the same transaction, clearing or
   setting `chunks.unreferenced_since`. Replays change nothing.
3. The collector deletes a chunk, row then object, only if
   `unreferenced_since` is over 7 days old _and_ no `chunk_refs` row exists.
4. Before a commit takes a namespace's count from 0 to 1, it writes to the
   chunk's database: a new `chunks` row for the caller's upload (marking the
   pending upload `claimed`), or an existing row's timer reset to now. Pending
   records go only after the commit succeeds, each with its object unless it
   was claimed (a claimed object belongs to `chunks` now), so a retry can still
   prove its upload; if the row is gone and the caller has no upload, the commit is
   refused with the hash listed as missing.

The reset timer makes lagging workers and failed commits safe: a successful
commit's `added` row clears it well within 7 days, and a failed commit's chunk
is collected on schedule. A live chunk is lost only if an `added` row waits
over 7 days, and an occasional full scan catches drift. Uploads never
committed never reach `chunks`, and expire with their pending records and
objects after 7 days; a `claimed` record expires alone, since its object
leaves only through the collector.

## Deep dive: the sync protocol

A client has two jobs: find out that something changed, and fetch what
changed. The sequence below is the `inventory.db` edit from device A's upload
to device B's download; the arrow into the notifier stands for the journal
relay and change queue, and the chunk-index writes are left out.

![Sequence of one edit syncing from device A to device B. Device A sends POST /chunks/check with hashes 9f2c, 41ab and e07d to the API server, which asks the namespace database which of them namespace ns_81 already holds, and answers that 41ab is missing, with an upload URL. Device A PUTs chunk 41ab's bytes to the object store, then sends a commit with base version 7. The API server writes version 8 and journal seq 1042 to the namespace database in one transaction and answers 200, version 8. The database's new journal row reaches the notifier, which tells device B that ns_81 is at seq 1042. Device B calls GET /changes and learns that f_3302, inventory.db, is at version 8. It fetches version 8's chunk list, 9f2c, 41ab and e07d, asks for a URL for 41ab, the only chunk it lacks, receives a signed URL, then GETs those bytes from the object store.](/diagrams/file-storage/edit-sync-sequence.svg)

**Fetching what changed** always goes through the journal. `/changes` returns
the entries after the cursor, in order, and the client applies them, skipping
its own `device_id`. A laptop closed for a week makes the same call as one
offline for a second, and gets more pages. The journal is kept 90 days;
a client offline longer gets "cursor expired" and compares all its files with
the server's metadata, slow but rare.

The journal row is written in the same transaction as its version, so the
journal can't miss a commit or announce one that rolled back: it is an outbox
in the sense of the
[outbox pattern](/systems-and-infrastructure/outbox-pattern). The relay
publishes committed rows to a
[message queue](/systems-and-infrastructure/message-queues), and if it
publishes one twice after a crash, a client told to catch up to a `seq` it
already reached does nothing.

**Finding out that something changed** has three options, compared in general
in
[WebSockets vs. SSE vs. long polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling):

- **Poll `/changes` every 30 seconds.** Simplest, and it misses the 10-second
  target outright. 10 million online clients make about 333,000 requests a
  second, and with at most 9,200 of them having news (4,600 commits at peak,
  each news to one or two devices), 97–99% answer "nothing new". Polling
  every 5 seconds would be 2 million a second.
- **Long polling:** the server holds each `/notifications` request until
  something changes or 60 seconds pass. Changes arrive within a second, but
  timeouts still send 10,000,000 ÷ 60 ≈ 167,000 empty requests a second.
- **A persistent stream** (server-sent events or a WebSocket): one open
  connection per client, carrying a message only when a namespace moves on,
  plus an occasional **heartbeat** to show it is alive. Changes arrive within
  a second; the cost is about 100 servers for 10 million connections, which
  must track which client is connected where.

This design uses a server-sent events stream, since messages flow only from
server to client, with long polling as a fallback on networks that break
long-lived streams. The notification carries only "namespace ns_81 is at seq
1042", never the change, so there is one path for applying changes, and a lost
notification costs only a delay. A client calls `/changes` on reconnecting and
every 10 minutes regardless: 10,000,000 ÷ 600 ≈ 17,000 requests a second at
peak, a twentieth of 30-second polling, already in the estimates' 100 a day.

For a shared folder with 5,000 members, one commit notifies up to 10,000
devices, which the failure modes come back to.

## Deep dive: conflicting edits

A user edits `inventory.db` on a laptop on a plane, and on a desktop at home
before the laptop lands, both from version 7. The desktop commits version 8.
When the laptop commits with `base_version: 7`, the server sees the file is at 8. Rejecting a stale base is optimistic concurrency control
([optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)):
the version check and the update run in one transaction, so two commits
racing from one base can't both succeed
([race conditions](/systems-and-infrastructure/race-conditions)). A
pessimistic lock ("check the file out first") can't work here: an offline
device can't take a lock.

Detecting the conflict is the easy half. What to do with the losing edit:

**Last writer wins.** The laptop's commit becomes version 9. Nobody is
interrupted, but the desktop's edit silently vanishes from the current file,
surviving only in history. "Last" means last to reach the server, which says
nothing about which edit the user cares about.

**Merge automatically.** Edits to different lines of a text file can be
combined by a three-way merge against version 7, as version control does. But
combining changed byte ranges of a database or Photoshop file gives at best
one of the edits and at worst a corrupt file.

**Keep both.** The laptop's edit is saved next to the original as
`inventory (conflicted copy, laptop-a, 2026-09-28).db`, and version 8 stays
current. Nothing is lost or guessed; the user has to notice the copy and
reconcile by hand.

This design keeps both, because neither edit may be lost and the service
can't understand the contents well enough to merge. On a `409`, the client
commits its version as a new file with the conflicted-copy name (a
metadata-only commit, since its chunks are uploaded and the failed commit kept
their pending records), then downloads version 8.

The same checks settle the other combinations:

- **Edit on one device, delete on another.** A delete arriving second has a
  stale `base_version`, gets `409`, and the client downloads the newer
  version. An edit arriving second matches the deleted version, so the server
  takes the file out of the trash and commits it. The edit survives either way.
- **Two renames.** The second's `expected_name` no longer matches, so it gets
  `409` and takes the server's name.
- **Two new files with the same name.** The second hits the unique name index,
  gets `409`, and becomes a conflicted copy.
- **A folder deleted while a file inside is edited.** The server restores the
  file and each trashed folder on its path.

## Failure modes and bottlenecks

**A large shared folder.** A namespace with 5,000 members, two devices each,
turns one commit into 10,000 notifications and 10,000 `/changes` calls to one
shard within a second or two, the shape of the
[thundering herd problem](/systems-and-infrastructure/thundering-herd-problem).
The page of journal entries after a given `seq` is the same for every member,
so API servers keep recent pages in a
[cache](/systems-and-infrastructure/caching) and serve thousands of identical
requests from one read, and notification servers add a random delay of up to
a few seconds per client to spread the fetches. A namespace still too busy
gets a shard of its own.

**The object store is slow or unavailable.** Uploads and downloads fail;
browsing, renaming and sharing keep working. Clients retry chunk transfers
with [exponential backoff](/systems-and-infrastructure/exponential-backoff),
and a save waits on the device until its chunks upload.

**A metadata shard fails.** Its namespaces can't commit or sync until a
replica is promoted; the other 31 are unaffected. Replicas are synchronous, so
a promoted one has every acknowledged commit, and cursors still name a
position in the same history. A failed chunk-index shard blocks commits that
bring new chunks, and downloads of its chunks, until its replica takes over.

**The relay or the queue falls behind.** Notifications arrive late, but
commits are unaffected and clients catch up on their 10-minute check. The gap
between the newest `seq` stored and published is worth an alert.

**A revoked share.** Removing a member deletes their cached membership, so
their next request is refused. A download URL signed in the last 5 minutes
works until it expires, and files already synced stay on their devices.

**An abandoned upload.** A phone that uploads 3,000 chunks and goes in a
drawer leaves 12 GB uncommitted until the pending records expire after 7 days;
if it comes back sooner, the upload resumes.

## Trade-offs

- **Metadata and contents apart.** Transactions over 80 TB in one store, cheap
  durable bytes over 200 PB in the other. They can disagree, which is why a
  commit checks its chunks exist and garbage collection waits 7 days.
- **Chunks over whole files.** Resumable uploads, small uploads for edits and
  cheap history, paid for with about 29 TB of chunk bookkeeping, a request per
  chunk and a garbage collector. Small files and compressed formats get little
  of the benefit.
- **Per-namespace dedup visible to clients.** No side channel; a popular file
  is uploaded again by each user who adds it, though stored once.
- **Presigned URLs.** The API servers handle requests, not bytes. A URL can't
  be recalled before it expires, and the object store must verify SHA-256.
- **Notify, then pull from the journal.** Notifications can be dropped safely,
  for an extra round trip per change and 100 servers holding 10 million
  connections.
- **Conflicted copies over last writer wins.** No edit is lost; the user
  reconciles two files by hand.
- **Tiered storage.** About 63% off the storage bill, for a one-time
  transition fee of up to three-quarters of a month's saving, fees on reads
  of old files, and a worker to move chunks.

What would change the design: if most usage moved to documents edited in the
browser, the unit of change would become an operation inside a document, a
collaborative editor's problem rather than a sync client's. If users required
that the service can't read their files, encryption with keys only they hold
would make the same file encrypt to different bytes for different users,
ending cross-user deduplication.
