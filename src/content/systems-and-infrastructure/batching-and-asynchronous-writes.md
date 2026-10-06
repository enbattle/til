---
title: Batching and Asynchronous Writes
summary: Grouping many small writes into one, and confirming a write before it is applied, raise write throughput in exchange for latency, ordering, and error-handling complications.
date: 2026-09-21
---

Suppose you run a news site, and every time someone opens an article you record a page view. At 2,000 views a second, how do you keep the database from drowning?

Start with what one write costs. Beyond the data itself, each write pays a fixed price: a network round trip to the database, and a commit, which typically waits until the change is flushed to disk before the database calls it safe. Insert views one at a time and you pay that price 2,000 times a second. **Batching** groups many writes into one operation, so the price is paid once:

```sql
-- 1,000 round trips, and typically 1,000 commits
INSERT INTO page_views (article_id, viewed_at) VALUES (7, now());
INSERT INTO page_views (article_id, viewed_at) VALUES (9, now());
-- ...

-- one round trip, one commit
INSERT INTO page_views (article_id, viewed_at)
VALUES (7, now()), (9, now()), (7, now()); -- ...and so on
```

What does that cost you? A view can no longer go out the moment it arrives. Something has to collect views until a batch is ready, and a common rule is to flush at a maximum size or a maximum wait, whichever comes first, say 500 rows or 100 milliseconds. At 2,000 views a second, 500 rows fill in 250 milliseconds, so the 100 millisecond timer fires first and each batch holds about 200 views. The first view into a batch waits for the others. That is the trade in [Latency vs. Throughput](/systems-and-infrastructure/latency-vs-throughput): throughput goes up, and so does the latency of each individual write.

## Acknowledging before applying

Who is waiting on that latency? With batching alone, the web server holds the reader's request open until the batch commits. But the reader doesn't care whether the view was recorded. So you can go a step further. **Asynchronous writes** separate accepting a write from applying it: the server answers as soon as the view is stored in a [queue](/systems-and-infrastructure/message-queues) (a buffer of pending work), and a background **consumer**, a process that reads from the queue, writes it to the database later.

Batching pairs well with this, because the consumer can pull hundreds of queued views at once. It can also combine them. If you also keep a per-article view counter, the consumer can fold a batch's 150 views of article 7 into one `UPDATE ... SET views = views + 150`, which sidesteps the contention on a hot row (one row that many writers all try to update at once) described in [Optimistic vs. Pessimistic Locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking).

Replying before the write is applied changes what "success" means. Four consequences follow, and the first two apply only to asynchronous writes, since plain batching replies after the batch commits.

**Durability window.** Your reply promised the view was safe, so it has to be stored somewhere that survives a crash. If the server replies after putting the view in its own memory buffer, a crash loses every view still in the buffer, even though each reader was told it worked. Replying only after the queue has durably stored the write closes that window, at the cost of some latency. What "durably" means depends on how the queue is configured.

**Visibility.** Between the reply and the consumer's write, the view isn't in the database. For a view nobody notices. For something the user wrote, such as a comment sent the same way, an immediate reload may not show it, so the interface has to cope, for example by showing the pending comment locally.

**Ordering.** If several consumers process different batches, they can finish in a different order than the writes arrived. For view counts that doesn't matter, because adding is the same in any order. For edits to an article it does: an earlier edit applied last can overwrite the article's current text. Where order matters, the usual approach is to route all the writes for one key (here, one article) to the same consumer, which keeps the order within each key and gives up ordering between keys.

**Failure handling.** In a batch of 500, one row may violate a constraint. Depending on how the batch was applied, the whole batch fails or part of it lands, and with asynchronous writes the reader was already told yes. A consumer typically retries, and a retry can replay writes that already succeeded, so each write has to be [idempotent](/systems-and-infrastructure/idempotency): applying it twice must leave the same result as applying it once. A write that can never succeed goes to a [dead-letter queue](/systems-and-infrastructure/message-queues#dead-letter-queues) (a holding area for failed messages) instead of being retried forever. Validating before replying catches many bad writes while the caller can still hear about them.

The queue also needs a limit. If views arrive faster than the consumer applies them, the queue grows without bound, and so does the delay between reply and application. See [Backpressure](/systems-and-infrastructure/backpressure).

**Rule of thumb.** Batch writes whose caller doesn't need the outcome right away and can tolerate a short delay and some reordering, such as counters, analytics events and activity logs, and keep the synchronous path for writes where the caller needs the result now, like charging a card, where the answer is sometimes a refusal.

## Where you'll meet this

A news feed with huge volumes of likes and views often counts them this way: events are queued and applied as periodic batched updates, so a displayed count runs a little behind. A notification pipeline batches on the way out, because one request to a provider that accepts many recipients costs less than one call per recipient. In chat, messages within a conversation have to stay in order, so any batching there must never reorder messages within a conversation.
