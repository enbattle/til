---
title: Design Cloud File Storage (like Google Drive or Dropbox)
summary: Hashed 4 MB chunks uploaded straight to object storage, devices told "something changed" and pulling from a change log, and conflicted copies instead of lost edits, for 40 million saves a day.
date: 2026-10-05
order: 6
template: 2
---

You're asked to design cloud file storage like Dropbox. Save `inventory.db` on your laptop and a few seconds later the new version is on your desktop. A **sync client**, the program on each device that watches a local folder, uploads and downloads what changed. The hard parts are moving huge files cheaply, telling devices fast, and two devices editing one file.

## Requirements

- Upload files of up to 50 GB, resuming after an interruption, and sync every
  change to a user's devices, including edits made offline.
- Share a folder with viewers (can read) and editors (can change), checked on
  every read and write.
- Keep replaced versions for 30 days. When two devices edit one file from the
  same version, neither edit is lost.
- 50 million users, 10 million active a day; each stores 4 GB in 2,000 files,
  saves (creates or changes) 4 files a day, on 2 devices.
- A confirmed upload is never lost (eleven nines). A change reaches other
  online devices within 10 seconds at p99 (99% are faster); uptime is 99.9%.

Out of scope: co-editing inside a document, search, previews and billing.

## Key numbers

First, size the commits, upload bandwidth, metadata database and notification
servers, with peak at ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Commits: about 4,600 a second at peak.** 10 million users × 4 saves = 40
  million a day ÷ 86,400 ≈ 463 a second on average.
- **Uploads: about 56 Gbit/s at peak.** Assume a save sends 1.5 MB once
  unchanged parts are skipped: 60 TB a day ≈ 5.6 Gbit/s on average.
- **Object store: 200 PB of file contents.** 50 million users × 4 GB.
- **Metadata database: about 67 TB, in about 34 shards of 2 TB.** 100 billion
  files (50 million × 2,000, averaging 2 MB) × 500 bytes = 50 TB. Assume 1.2
  chunks per file: 120 billion chunk rows × 100 bytes = 12 TB, plus chunk lists
  at 40 bytes an entry = 4.8 TB.
- **Notification connections: 10 million.** 20 million clients, half online at
  peak; at 100,000 each, 100 servers.

## High-level architecture

![Architecture of the file storage service. Sync clients send chunk bytes to the object store, send check, commit, version and /changes requests to the API servers, and open a stream to the notification servers. The API servers read memberships from a permission cache and send commits and reads to the namespace database, which is sharded by namespace. Journal rows flow from the namespace database to a journal relay, which publishes to a change queue that the notification servers consume.](/diagrams/file-storage/architecture.svg)

Follow a save of `inventory.db`, a 2 GB file in your own **namespace**, a tree
of folders and files with its own members (yours, or one shared folder). The
laptop cuts it into 500 **chunks** of 4 MB and finds that three differ from
version 7. An API server checks the
[permission cache](/systems-and-infrastructure/caching) that you may edit and
returns a **presigned URL** for each missing chunk, an object-store address
signed so the client can upload one object without credentials. The laptop
sends the 12 MB straight to the **object store**, so the 56 Gbit/s never touches the API servers. Then it commits: one transaction writes version 8 and journal entry
1042 to the namespace database. The **journal relay** publishes that row to the
change queue, the notification servers tell the desktop, and it fetches version 8's chunk list and signed download URLs, checked the same way, then the three it lacks.

## API and data model

```http
POST /chunks/check    { "namespace_id": "ns_81", "hashes": ["9f2c…", …] }
-> { "missing": [ { "hash": "41ab…", "upload_url": "https://objects.example/…" } ] }

POST /files/commit    (Idempotency-Key: 5b1e0c2a-…)
{ "namespace_id": "ns_81", "file_id": "f_3302", "base_version": 7, "chunks": ["9f2c…", "41ab…", …] }
-> 200 { "version": 8, "seq": 1042 }, or 409 { "current_version": 8 }

GET /files/f_3302/versions/8
-> { "chunks": ["9f2c…", …], "download_urls": { "41ab…": "https://objects.example/…" } }

GET /changes?cursor=<cursor>
-> journal entries after the cursor, and a new cursor
```

```text
split by namespace_id:
namespaces  namespace_id PK, next_seq        members  namespace_id, user_id, role
files       file_id PK, namespace_id, parent_id, name, current_version
            UNIQUE (namespace_id, parent_id, name)
versions    file_id, version, chunk_hashes (ordered list), created_at
chunks      namespace_id, hash, object_key, ref_count, state (pending | stored)
journal     namespace_id, seq, file_id, version, device_id   PK (namespace_id, seq)
```

The metadata is relational because a commit is a small all-or-nothing
transaction, and every row it touches carries one `namespace_id`, so it stays
inside one shard ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql),
[sharding](/systems-and-infrastructure/partitioning-vs-sharding)). The
`Idempotency-Key` lets a retry after a lost reply return the original `200`,
not a conflict with itself
([idempotency](/systems-and-infrastructure/idempotency)).

## Decision: content-addressed chunks

Each chunk is named by its **SHA-256 hash**, a 32-byte fingerprint of its
bytes, and a version is the ordered list of hashes. Saving uploads only the
hashes the namespace lacks, so resuming a 50 GB upload (12,500 chunks) and saving an edit are the same question. A `chunks` row is `pending` until its object exists, so a resume re-sends only those. Version 8 shares 497 chunks with version
7, so 30 days of history add at most 1.8 PB (30 × 60 TB), under 1% of 200 PB.

Why not upload each file whole, as a resumable multipart upload? For the
average 2 MB file that works as well. It loses on big files edited in place: a month of daily saves of the 2 GB database holds 60 GB of history,
against about 2.4 GB with chunks. Chunks cost a request each and 4.8 TB of
chunk lists, and a compressed `.xlsx` changes throughout on any edit anyway.

**Rule of thumb.** Split large, partly changing blobs into content-addressed
pieces, so you move and store only what changed.

## Decision: notify, then pull from a change log

Every commit appends a
**journal** row, the namespace's next sequence number (`seq`) with the file and
version, in the same transaction as the version, so it can't miss a commit
([outbox pattern](/systems-and-infrastructure/outbox-pattern)). A device holds
a **cursor**, the last `seq` it has seen in each namespace, and `/changes`
returns everything after it. The notification only says "`ns_81` is at 1042",
over a held-open stream
([SSE](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)), so a
lost one costs a delay; each device also asks every 10 minutes as a backstop.

Why not just poll `/changes` every 30 seconds? It needs no open connections,
but it misses the 10-second target and costs 333,000 requests a second from 10
million online clients, of which at most 9,200 a second return anything (4,600
commits × 2 devices, in ordinary folders).

**Rule of thumb.** Few changes, many listeners: push a tiny "something changed"
and let each listener pull the details, with a slow poll as the backstop.

## Decision: keep both edits on a conflict

Your laptop, offline on a plane, edits `inventory.db` from version 7; the
desktop commits version 8 first. The laptop's commit says `base_version: 7`, and
the server applies a commit only if that is still current, checked in the
transaction
([optimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)),
since an offline device can't hold a lock. The loser gets `409`, and the client
commits its chunks as a new file, `inventory (conflicted copy, laptop-a).db`,
then downloads version 8.

Why not merge the edits, as git does? It works for text. But the service sees bytes, not formats, and merging byte ranges of a database can corrupt it. Last writer wins hides one edit in history without telling anyone.

**Rule of thumb.** When you can't merge, detect the conflict cheaply and keep
both sides rather than pick one.

## Likely follow-ups

- **Why not deduplicate across all users?** Answering "already have it" for any
  chunk in the service leaks what others store: guess a document, hash it, ask.
  So chunks are keyed per namespace.
- **What about a line inserted at the start of a 100 MB log?** Every fixed
  boundary moves, so all 25 chunks change. **Content-defined chunking** cuts
  where a rolling hash of recent bytes matches a pattern, so boundaries follow
  the content.
- **When are a chunk's bytes deleted?** At a `ref_count` of zero a nightly job
  deletes the object, after a 7-day grace so an in-flight commit keeps its chunk.
- **What about a shared folder with 5,000 members?** One commit means 10,000
  identical `/changes` calls, a
  [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Cache
  the journal page and delay notifications by a random second or two.
