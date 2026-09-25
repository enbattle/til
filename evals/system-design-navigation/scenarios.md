# System-design-navigation scenarios

Each scenario is a symptom or question phrased the way someone actually
arrives at it, with no topic names in it. Give it, verbatim, to a fresh
agent that has only the System Design landing page's view of the site (see
`HOW_TO_RUN.md`) and record which question it opens and which catalog
topics it would follow from there. Compare against **Expected**. See
`../README.md` for grading philosophy (some scenarios are ambiguous by
design, and one is a control whose right answer is "no question covers
this").

The expected question and topics were taken from the question pages in
`src/system-design/questions/` and the topics they link, as of the current
questions. **Re-check them when the question set changes** — see
"When the question set changes" in `HOW_TO_RUN.md`. Every **Topics**
entry below is a `systems-and-infrastructure` topic that question links
to (its "Go deeper" list is generated from those links), so a scenario
whose expected topic isn't linked from its expected question is stale.

The question slugs used below are the filenames under
`src/system-design/questions/`:

| Slug                                     | Order |
| ---------------------------------------- | ----- |
| `figuring-out-whats-wrong`               | 1     |
| `database-cant-keep-up-with-reads`       | 2     |
| `database-cant-keep-up-with-writes`      | 3     |
| `one-failing-service-taking-down-others` | 4     |
| `keeping-data-correct-under-concurrency` | 5     |
| `structuring-services-and-storage`       | 6     |
| `pushing-live-updates-to-users`          | 7     |
| `running-work-that-takes-too-long`       | 8     |

---

### SDN-01 — no diagnosis yet

> Our app has been getting slower for a few days. Some requests time out.
> I have no idea which part is responsible.

**Expected question:** `figuring-out-whats-wrong`
**Topics:** `observability` (metrics, then traces, then logs),
`latency-vs-throughput`
**Why:** The user has a symptom and no diagnosis, which is exactly what
question 1 exists for. Every other question assumes the user already knows
which part is failing.
**Fails if:** it jumps straight to a specific fix question (reads,
writes, failing service) without any diagnostic basis, since nothing in
the prompt says which part is at fault.

---

### SDN-02 — one request, dozens of queries

> A trace of our product list page shows it firing about 200 nearly
> identical database queries, one per product, every time it loads. It's
> fast on my laptop and slow in production.

**Expected question:** `database-cant-keep-up-with-reads`
**Topics:** `n-plus-one-queries`
**Why:** One request issuing a query per row is the N+1 pattern, which
that question's "Send fewer queries" section covers; the "fast locally,
slow with production-sized data" detail is the same one the section
gives.
**Fails if:** it routes to `figuring-out-whats-wrong` even though the
prompt already contains a trace-level diagnosis, or picks `database-indexing`
as the primary fix (an index makes each of the 200 queries cheaper but
leaves the 200).

---

### SDN-03 — full table scan

> A report query used to take milliseconds. Our table has grown to tens of
> millions of rows and the same query now takes half a minute. It's only a
> lookup by customer email.

**Expected question:** `database-cant-keep-up-with-reads`
**Topics:** `database-indexing`
**Why:** A single slow lookup that got slower as the table grew is the
missing-index case in "Make each query cheaper", the first fix that page
offers and the cheapest one.
**Fails if:** it proposes copies, caching or sharding without first
considering an index, or routes to the writes question (nothing here is
about write volume).

---

### SDN-04 — requests waiting for a connection (ambiguous by design)

> Every individual database query is fast when I time it, but under load
> requests still hang for seconds and then some fail. Our database server's
> CPU is almost idle.

**Expected question:** `database-cant-keep-up-with-reads`, or
`figuring-out-whats-wrong` first and then `database-cant-keep-up-with-reads`
once the trace shows the time going to waiting for a connection. Both
acceptable.
**Topics:** `database-connection-pooling`; `observability` (if it starts at
diagnosis)
**Why:** Fast queries plus waiting requests plus an idle database is the
"check the connection pool" case, and the reads page's opener covers it
directly ("it looks idle while requests wait for a connection to it"). But
the prompt never says the load is reads, and "requests hang" with no known
cause is also what the diagnosis page is for, so starting there and following
its trace to the reads page is a defensible path. Grade the reasoning, not
the first click: a session that starts at diagnosis must still end at the
reads page and the connection-pool topic.
**Fails if:** it routes to `one-failing-service-taking-down-others` on the
word "hang" alone (the dependency here isn't failing, it's just not handing
out connections), or recommends read replicas or caching for an idle
database.

---

### SDN-05 — write volume on one machine

> We ingest around 50,000 events a second into a single Postgres table.
> The primary's CPU and disk are maxed out and we're falling behind during
> bursts. Adding read replicas didn't help at all.

**Expected question:** `database-cant-keep-up-with-writes`
**Topics:** `partitioning-vs-sharding` (and it should note that plain
partitioning adds no write capacity on one server, sharding does),
`consistent-hashing` when discussing spreading data across machines;
`backpressure`, `scaling-reads-vs-scaling-writes` and
`batching-and-asynchronous-writes` are also linked and acceptable
**Why:** Insert-heavy load with the primary out of CPU and disk is the
write-volume case, and "replicas didn't help" is the tell that the
problem isn't reads.
**Fails if:** it routes to `database-cant-keep-up-with-reads`, or treats
partitioning and sharding as the same thing (the page's central
distinction).

---

### SDN-06 — dependency failure spreading

> Our payment provider's API started responding very slowly. Within
> minutes our own checkout service was down too: its worker threads were
> all stuck waiting, and our retries seem to be making things worse.

**Expected question:** `one-failing-service-taking-down-others`
**Topics:** `circuit-breaker`, `exponential-backoff` (a timeout comes
first per the page, but it has no topic of its own)
**Why:** A slow dependency exhausting its callers' threads, with retries
adding load, is the opening scenario of that question almost word for
word.
**Fails if:** it routes to `figuring-out-whats-wrong` and stops there
(the diagnosis is already in the prompt), or to `database-cant-keep-up-with-writes`
because the payment call involves money.

---

### SDN-07 — retries causing duplicates (trap)

> After we added automatic retries to our checkout call, some customers
> are being charged twice. The payment API is flaky and times out a few
> times a day.

**Expected question:** `one-failing-service-taking-down-others`
**Topics:** `idempotency`; `exponential-backoff` acceptable
**Why:** The duplicates come from retrying against a flaky dependency,
which that page's "Make retrying safe" section covers, and the
concurrency page's own "when it isn't this problem" redirects duplicates
from retries there. The trap is that "duplicate data" superficially
matches `keeping-data-correct-under-concurrency`.
**Fails if:** it routes to `keeping-data-correct-under-concurrency` with
no acknowledgment that the duplicates come from retries. Naming
`idempotency` as the fix is right in either question; the grade is on
which question it opens first and why.

---

### SDN-08 — two buyers, one item

> Two customers just bought the last unit of the same product at nearly the
> same moment, and our stock count went to minus one. We use a normal
> relational database.

**Expected question:** `keeping-data-correct-under-concurrency`
**Topics:** `optimistic-vs-pessimistic-locking`
**Why:** Writers colliding on one row in a shared database is the "same
database: lock, or detect the conflict" case. This is also the page's own
opening example.
**Fails if:** it routes to `database-cant-keep-up-with-writes` (this is
wrong data, not write volume), or reaches for `distributed-locks` even
though everything is in one database.

---

### SDN-09 — job running twice

> Our nightly billing job is scheduled on three servers for redundancy, and
> last night it ran on two of them at once and invoiced people twice.

**Expected question:** `keeping-data-correct-under-concurrency`
**Topics:** `distributed-locks` (with its lease); `idempotency` acceptable
and worth mentioning
**Why:** Separate processes that need exclusive access and don't share
one database is the distributed-lock case, and "a scheduled job runs on
two machines at once" is named in the page's opening.
**Fails if:** it routes to `one-failing-service-taking-down-others`
(nothing is failing), or suggests a database row lock as the whole answer
without noting the processes are on separate servers.

---

### SDN-10 — event never published

> When a customer places an order we save it to the database and then send
> an "order placed" message to our other systems. Occasionally the order
> exists but the message was never sent, and the warehouse never hears
> about it.

**Expected question:** `keeping-data-correct-under-concurrency`
**Topics:** `outbox-pattern`
**Why:** A database change that has to reliably reach another system is
the "one change that has to reach another system" case, and the order
saved but message never sent is its opening example.
**Fails if:** it routes to `one-failing-service-taking-down-others` because
a message failed to send (the receiver isn't overloaded, the two writes
just aren't atomic), or proposes simply retrying the publish with no
mention of the lost-write window between the save and the send.

---

### SDN-11 — multi-service booking

> Booking a trip books a flight in one service, a hotel in another and
> takes payment in a third. If the hotel step fails, we're left with a
> flight booked and money taken and nothing to undo it.

**Expected question:** `keeping-data-correct-under-concurrency`
**Topics:** `saga-pattern`; `outbox-pattern` and `idempotency` acceptable
**Why:** One operation across several services that can fail partway is
the "one operation across several services" case ("a booking is
half-finished when a later step fails" in the page's opening).
**Fails if:** it suggests a single database transaction across the three
services without noting they don't share one, or routes to
`structuring-services-and-storage` (the services already exist; the
problem is what happens when a step fails).

---

### SDN-12 — starting a new system

> I'm starting a new product with a team of four. Should I build it as
> several microservices from day one, and should I use Postgres or MongoDB?

**Expected question:** `structuring-services-and-storage`
**Topics:** `monolith-vs-microservices`, `sql-vs-nosql`; `cap-theorem`
acceptable
**Why:** Choosing an architecture rather than fixing a running one, with
both early decisions (how many deployable pieces, which database) named
in the prompt.
**Fails if:** it routes to `figuring-out-whats-wrong` (nothing is broken)
or answers only one of the two decisions.

---

### SDN-13 — slow writes on a hot row (ambiguous by design)

> Our flash-sale checkout got very slow. The database has plenty of spare
> CPU and disk, but the inventory row for the sale item shows a long queue
> of transactions waiting on each other.

**Expected question:** `keeping-data-correct-under-concurrency`, or
`database-cant-keep-up-with-writes` if the reasoning follows that page's
"separate volume from contention" step over to the concurrency page.
Both acceptable.
**Topics:** `optimistic-vs-pessimistic-locking`
**Why:** The symptom is slowness, so the writes page is a natural first
click, but spare CPU and disk with writes queued on the same rows is
that page's own definition of contention, and it sends the reader to the
concurrency page. The concurrency page covers slowness on a hot row too
(shorter transactions, splitting a counter across rows, queuing writes).
Grade the reasoning, not the first click: a session that opens the writes
page, sees "contention," and continues to the concurrency question passes.
**Fails if:** it stays on the writes page recommending partitioning or
sharding for a database that has spare capacity, or concludes the
problem is read load.

---

### SDN-14 — traffic spike, two things timed out (ambiguous by design)

> After an email campaign, traffic tripled and our API fell over. Both our
> database and one of the services we call started timing out, and I can't
> tell which one went first.

**Expected question:** `figuring-out-whats-wrong` first (which one went
first is a diagnosis question), then `one-failing-service-taking-down-others`
or one of the database questions once the trace answers it. Starting
directly at `one-failing-service-taking-down-others` is also acceptable if
the reasoning notes that the failing-service page tells you how to confirm
it.
**Topics:** `observability` (if it starts at diagnosis); `backpressure`,
`rate-limiting` and `thundering-herd-problem` (if it starts at the
failing-service question)
**Why:** The prompt states two symptoms and an explicit uncertainty about
which is the cause, which favors diagnosis first, but the failing-service
page is also a defensible opening because it has its own "Confirm it"
step and covers the receiver-side defenses (rate limiting, backpressure)
that apply when something is overloaded.
**Fails if:** it picks a database question and commits to a fix
(replicas, sharding) without addressing the stated uncertainty about which
component failed first.

---

### SDN-15 — out of scope (control)

> We're building an internal dashboard. Should we write it in React or
> Svelte, and is Tailwind or plain CSS the better fit?

**Expected question:** none. The right answer is that no System Design
question covers choosing a frontend framework or CSS approach.
**Topics:** none
**Why:** Frontend framework and styling choices are permanently outside
what this section is about (scaling, failure and correctness of backend
systems). This control checks that a navigator says so instead of forcing
the nearest-looking question, which is what the wrong-but-confident
routing failure looks like. It isn't a topic a future question is
expected to cover.
**Fails if:** it opens any question, most likely
`structuring-services-and-storage` on the strength of "should we pick X or
Y," and presents it as an answer.

---

### SDN-16 — server-initiated updates

> The operators of our admin dashboard have to refresh the page to see new
> orders. We want new orders to appear within a second or two of being
> placed, without hammering the server with requests every few seconds.

**Expected question:** `pushing-live-updates-to-users`
**Topics:** `websockets-vs-sse-vs-long-polling`; `backpressure`,
`thundering-herd-problem` and `exponential-backoff` are also linked and
acceptable
**Why:** The server has to tell the client something without being asked,
which is the whole of question 7, and "without hammering the server" is the
cost of the polling alternative the page starts from.
**Fails if:** it routes to `database-cant-keep-up-with-reads` on the strength
of "hammering the server", or recommends polling faster.

---

### SDN-17 — a request that outlives its timeout

> When a user clicks "Export report" our server spends about 90 seconds
> building it, so the request times out at 30 seconds and the user sees an
> error.

**Expected question:** `running-work-that-takes-too-long`
**Topics:** `message-queues`, `worker-pools`; `idempotency` and
`dead-letter-queue` are also linked and acceptable
**Why:** The work itself is long, so it has to leave the request, which is
what question 8 covers; the page starts by asking whether the user has to
wait.
**Fails if:** it routes to `figuring-out-whats-wrong` and stops there (the
cause is already known), to `database-cant-keep-up-with-reads` (nothing says
the database is slow), or answers only with "raise the timeout".

---

### SDN-18 — where to put a cache

> Our product pages are read-heavy and identical for every visitor. We know
> we should cache them, but where should the cache live, and how do we tell
> whether it is big enough?

**Expected question:** `database-cant-keep-up-with-reads`
**Topics:** `caching`; `cache-invalidation` is also linked and acceptable
**Why:** Serving repeated reads from a copy is a section of question 2, and
placement, hit rate and sizing are what the `caching` topic covers.
**Fails if:** it routes to `structuring-services-and-storage` (a "where
should it live" question can superficially look architectural), or names
only `cache-invalidation`, which is about keeping a cache correct, not
placing or sizing one.

---

### SDN-19 — stale reads after adding replicas

> We added read replicas to take load off the primary. Now some users save
> their profile, reload the page, and see their old details for a few
> seconds.

**Expected question:** `database-cant-keep-up-with-reads`
**Topics:** `read-replicas`; `cache-invalidation` is also linked and
acceptable
**Why:** The staleness is replication lag from a read-scaling technique
that question 2 covers, and its "when it isn't this problem" section says a
stale replica belongs there.
**Fails if:** it routes to `keeping-data-correct-under-concurrency` and
recommends locking, which addresses concurrent writers, not lagging copies.

---

### SDN-20 — restarting a hung server by hand (ambiguous by design)

> One of our servers hangs about once a week, and someone has to notice and
> restart it by hand, usually at night. We'd like that to happen on its own.

**Expected question:** `one-failing-service-taking-down-others`, or
`figuring-out-whats-wrong` first if the reasoning then follows the pages on
to the failing-service question. Both acceptable.
**Topics:** `self-healing-systems`
**Why:** Automatic detection and replacement of a broken instance is the
"replace broken instances automatically" section of question 4. When this
scenario was written, that question's summary talked only about a failing
dependency; since the 2026-09-21 miss it also names a hung instance and
automatic restarts, and question 1's table has a row for one's own server
hanging, so the route is now more direct from the landing page. Grade the
reasoning, and whether it ends at the self-healing topic.
**Fails if:** it routes to `structuring-services-and-storage`,
`database-cant-keep-up-with-writes`, or any question and then proposes only
"add monitoring and alerting" without automatic recovery.

---

### SDN-21 — a copy shaped for one page

> Our order history page has to join six tables and is slow, but the tables
> themselves are fine for placing orders. We're considering keeping a
> separate copy of the data shaped for that page.

**Expected question:** `database-cant-keep-up-with-reads`
**Topics:** `cqrs`; `database-indexing`, `n-plus-one-queries` and
`read-replicas` are also linked and acceptable (the cheaper options the page
lists before it)
**Why:** A read model shaped for a page is the heavier option question 2
ends its copies section with, and the page says most systems try the cheaper
fixes first.
**Fails if:** it routes to `structuring-services-and-storage` because
"keeping a separate copy of the data" sounds like an architecture choice, or
goes straight to `cqrs` with no mention that cheaper fixes exist.
