---
title: Design Cloud File Storage (like Google Drive or Dropbox)
summary: Hashed 4 MB chunks uploaded straight to object storage, devices told "something changed" and pulling from a change log, and conflicted copies instead of lost edits, for 40 million saves a day.
date: 2026-10-05
order: 6
template: 3
---

You're asked to design cloud file storage like Dropbox. Save `inventory.db` on your laptop and a few seconds later the new version is on your desktop. A **sync client**, the program on each device that watches a local folder, uploads and downloads what changed. The hard parts are moving huge files cheaply, telling devices fast, and two devices editing one file.

The design stores each file as small pieces that go straight to cheap bulk storage, keeps the record of what is where in a database, and tells devices to ask for changes instead of sending them. This page starts with the obvious design and where it breaks, follows one save through the design that replaces it, sizes its parts, and makes three decisions: how files are cut up, how devices hear about changes, and what happens when two devices edit one file.

## Requirements

- Upload files of up to 50 GB, resuming after an interruption, and sync every change to a user's devices, including edits made offline.
- Share a folder with viewers (can read) and editors (can change), checked on every read and write.
- Keep replaced versions for 30 days. When two devices edit one file from the same version, neither edit is lost.
- 50 million users, 10 million active a day; each stores 4 GB in 2,000 files, saves (creates or changes) 4 files a day, on 2 devices.
- Each confirmed upload has a 99.999999999% (eleven nines) chance of surviving any given year. A change reaches other online devices within 10 seconds at p99 (99% are faster); uptime is 99.9%.

Out of scope: co-editing inside a document, search, previews and billing.

## Start simple

The obvious design sends the whole file. When a file changes, the sync client uploads it to an **API server**, a server that answers the app's requests, which saves the bytes and notes the new version in a database. Every device asks the server every 30 seconds whether anything changed, and downloads whole files that did.

The saved bytes can't sit on one server's disk. They go to an **object store**, a service that keeps each file under a name and copies it across machines, so one failure loses nothing.

For a 5 MB document that's fine. For `inventory.db`, 2 GB, assume a home uplink of 100 Mbit/s:

```text
5 MB document:
  5 MB × 8 = 40 Mbit
  40 Mbit ÷ 100 Mbit/s = 0.4 s
inventory.db, 2 GB:
  2,000 MB × 8 = 16,000 Mbit
  16,000 Mbit ÷ 100 Mbit/s = 160 s
a 50 GB upload:
  50,000 MB × 8 = 400,000 Mbit
  400,000 Mbit ÷ 100 Mbit/s = 4,000 s ≈ 67 minutes
```

Say an edit to the database changes 12 MB of it. The whole-file design still sends all 2 GB, 160 seconds against a 10-second target, and a connection that drops at minute 66 of a 50 GB upload starts over.

So cut each file into fixed pieces of 4 MB, called **chunks**. `inventory.db` becomes 2,000 MB ÷ 4 MB = 500 chunks, and the edit touches 12 MB ÷ 4 MB = 3 of them. Send those three, and an interrupted upload resumes at the next unsent chunk.

That fixes the bytes. It leaves a new job: remembering which chunks make up each version, how the other devices find out, and who may see them. Access is decided per **namespace**, a tree of folders and files with its own list of members; everything you own is one, and a shared folder is another.

## High-level architecture

![Architecture of the file storage service. Sync clients send chunk bytes to the object store using presigned URLs, send chunk checks, version saves, version fetches and change-list requests to the API servers, and open a connection to the notification servers. The API servers read members from the permission cache and save and read versions in the namespace database, which is sharded by namespace. Journal rows flow from the namespace database to a journal relay, which publishes to a change queue that the notification servers consume.](/diagrams/file-storage/architecture.svg)

Follow a save of `inventory.db` from your laptop. It cuts the file into 500 chunks and finds that three differ from version 7. It asks an API server to save the change, and the server checks that you may edit your namespace, using the **permission cache**, each namespace's member list kept in memory so the check skips the database ([caching](/systems-and-infrastructure/caching)). The server replies with a **presigned URL** for each missing chunk, an address on the object store signed so the client can upload one object without credentials. The laptop sends the 12 MB straight to the object store, so the upload traffic never touches the API servers.

Then the laptop asks the API server to save version 8, which writes the version and its chunk list to the namespace database. The same write adds entry 1042 to the namespace's **journal**, a numbered log of every change in it. Writing it with the version, not afterwards, means a save can't land without its entry ([outbox pattern](/systems-and-infrastructure/outbox-pattern)). A **journal relay**, a small process that watches for new journal rows and forwards them, picks up row 1042.

The relay publishes the row to the **change queue**, which holds it until something reads it ([message queues](/systems-and-infrastructure/message-queues)). The **notification servers** read it: they keep an open connection to every online device, and they tell the desktop that your namespace changed. The desktop then asks an API server for what happened after the last entry it saw, fetches version 8's chunk list and signed download URLs, checked against the permission cache the same way, and downloads the three chunks it lacks.

Now that every part has a name, how big does each need to be?

## Key numbers

These size the API servers, the upload path into the object store, the object store, the namespace database and the notification servers. A day is 86,400 seconds, and peak is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)).

- **API servers:** about 4,600 saves a second at peak. 10 million active users × 4 saves = 40 million a day; 40 million ÷ 86,400 ≈ 463 a second on average; 463 × 10 ≈ 4,600.
- **Uploads to the object store:** about 56 Gbit/s at peak. Assume a save sends 1.5 MB once unchanged chunks are skipped. 40 million × 1.5 MB = 60 TB a day; 60 TB × 8 ÷ 86,400 ≈ 5.6 Gbit/s on average; 5.6 × 10 ≈ 56 Gbit/s.
- **Object store:** 200 PB of file contents. 50 million users × 4 GB = 200 million GB = 200 PB.
- **Namespace database:** about 67 TB, in about 45 **shards**, slices that each hold whole namespaces, so one save touches one shard ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)). Each user stores 4 GB in 2,000 files, so a file averages 4 GB ÷ 2,000 = 2 MB. 50 million users × 2,000 files = 100 billion files; × 500 bytes = 50 TB. Assume 1.2 chunks per file: 120 billion chunk rows × 100 bytes = 12 TB, plus chunk lists at 40 bytes an entry, 120 billion × 40 = 4.8 TB. Total 50 + 12 + 4.8 ≈ 67 TB. Keep each 2 TB shard at 75% full, 1.5 TB: 67 ÷ 1.5 ≈ 45.
- **Notification servers:** 10 million connections, 125 servers. 10 million users × 2 devices = 20 million clients; half are online at peak, 10 million. Assume a server holds 100,000 connections and runs at 80%, 80,000: 10 million ÷ 80,000 = 125.

The 56 Gbit/s is why the bytes skip the API servers; the 10 million connections are why a notification must be tiny.

## API and data model

A client names each chunk by its **hash**, a fixed-size fingerprint of its bytes ([hashing](/computing-fundamentals/encoding-hashing-and-encryption)). A **commit** is the request that saves a new version.

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

The metadata is relational because a commit is a small all-or-nothing transaction, and every row it touches carries one `namespace_id`, so it stays inside one shard ([SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)).

The `Idempotency-Key` is a unique ID the client sends with a commit, so a retry after a lost reply returns the original `200` instead of a conflict with itself ([idempotency](/systems-and-infrastructure/idempotency)).

That's the shape. Three choices in it need defending.

## Decision: content-addressed chunks

The simpler design uploads each file whole, as a resumable multipart upload that already survives a dropped connection. For the average 2 MB file that works as well as chunks. It loses on big files edited in place. Keep 30 daily saves of the 2 GB database, each edit changing 12 MB:

```text
whole files:  30 × 2,000 MB = 60,000 MB = 60 GB
chunks:       30 × 12 MB = 360 MB
```

So name each chunk by its **SHA-256 hash**, a 32-byte fingerprint, and make a version the ordered list of hashes. A save asks `/chunks/check` which hashes the namespace lacks and uploads only those, so resuming a 50 GB upload (12,500 chunks) and saving an edit are the same question. A `chunks` row is `pending` until its object exists, so a resume re-sends only those. Version 8 shares 497 chunks with version 7, and 30 days of history add at most 1.8 PB, under 1% of 200 PB:

```text
30 days × 60 TB = 1,800 TB = 1.8 PB
1.8 PB ÷ 200 PB = 0.9%
```

The cost: a request per chunk, 4.8 TB of chunk lists, and no gain on a compressed `.xlsx`, which changes throughout on any edit.

**Rule of thumb.** Split large, partly changing blobs into content-addressed pieces, so you move and store only what changed.

## Decision: notify, then pull from a change log

The simpler design has no notifications: each device asks `/changes` every 30 seconds. It needs no open connections, but a change waits up to 30 seconds, three times the 10-second target, and the requests are mostly empty:

```text
requests:  10,000,000 online clients ÷ 30 s ≈ 333,000 a second
useful:    4,600 saves × 2 devices = 9,200 a second at most (ordinary folders)
```

So make the journal the source of truth and the notification only a hint. Each journal row has a `seq`, a number that rises by one within its namespace. A device holds a **cursor**, the last `seq` it has seen in each namespace, and `/changes` returns everything after it. The notification says only "`ns_81` is at 1042", over a held-open stream ([SSE](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)). A lost one costs a delay, not a missed change, because the next `/changes` call picks up everything after the cursor. As a backstop each device also asks every 10 minutes:

```text
10,000,000 ÷ 600 s ≈ 16,700 a second, 20 times fewer than 333,000
```

The cost is 10 million held connections to run, the 125 servers above.

**Rule of thumb.** Few changes, many listeners: push a tiny "something changed" and let each listener pull the details, with a slow poll as the backstop.

## Decision: keep both edits on a conflict

The simplest rule is that the last writer wins. Your laptop, offline on a plane, edits `inventory.db` from version 7; the desktop commits version 8 first. When the laptop reconnects and its save wins, version 8 is replaced and one edit survives only in history, with no one told. With two devices per user and offline edits a requirement, that will happen.

So the laptop's commit says `base_version: 7`, and the server applies a commit only if that is still current, checked in the transaction ([optimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)), since an offline device can't hold a lock. The loser gets `409`, and the client commits its chunks as a new file, `inventory (conflicted copy, laptop-a).db`, then downloads version 8.

The cost is a second file the user must reconcile by hand. Merging the edits, as git does, would spare them that, and it works for text. But the service sees bytes, not formats, and merging byte ranges of a database can corrupt it.

**Rule of thumb.** When you can't merge, detect the conflict cheaply and keep both sides rather than pick one.

## Likely follow-ups

- **Why not deduplicate across all users?** Answering "already have it" for any chunk in the service leaks what others store: guess a document, hash it, ask. So chunks are keyed per namespace.
- **What about a line inserted at the start of a 100 MB log?** Every fixed boundary moves, so all 25 chunks change. **Content-defined chunking** cuts where a rolling hash of recent bytes matches a pattern, so boundaries follow the content.
- **When are a chunk's bytes deleted?** `ref_count` counts the versions that use a chunk. At zero, a nightly job deletes the object, after a 7-day grace so an in-flight commit keeps its chunk.
- **What about a shared folder with 5,000 members?** One commit means 10,000 identical `/changes` calls, a [thundering herd](/systems-and-infrastructure/thundering-herd-problem). Cache the journal page and delay notifications by a random second or two.
