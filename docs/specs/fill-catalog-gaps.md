# Fill the catalog gaps and the two questions they need

## Context

The System Design questions route into catalog topics. Two whole problem areas
have no question because the topics behind them don't exist yet (live updates;
work that outlives a request), and four of the existing questions point at
material that only exists as a paragraph inside another topic (caching basics
and read replicas in `scaling-reads-vs-scaling-writes`; batching and
asynchronous writes in the same topic; self-healing nowhere). The user's
starting point was a short video listing the patterns that recur in system
design: caching, read replicas, indexing for reads; sharding, async writes,
batching for writes; WebSockets, server-sent events, long polling for real
time; message queues, worker pools, workflow engines for long-running jobs;
retries, idempotency, circuit breakers, self-healing for reliability; CQRS for
splitting reads and writes. Indexing, sharding, retries, idempotency and
circuit breakers exist. This change adds the rest.

## New topics (nine), all in `src/content/systems-and-infrastructure/`

Each is written by a fresh agent (three groups of three), then independently
fact-checked. Each follows the Writing Standard (zero-background reader, terms defined before
use, concrete examples, verified claims, prose that doesn't read as generic AI
output) and ends with a `## Where you'll meet this` section per
`docs/specs/where-youll-meet-this.md`. Comparison-style titles match the
catalog's existing style ("Partitioning vs. Sharding"); three near-identical
real-time topics would be shallow, so they are one comparison.

| slug                                | title                                              | scope (and what it leaves to existing topics)                                                                                                                                  |
| ----------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `caching`                           | Caching: Placement, Hit Rate, and Eviction         | What a cache buys; where caches sit (browser, CDN, application, database); hit rate; eviction (LRU, TTL); sizing. Leaves keeping it correct to `cache-invalidation`.           |
| `read-replicas`                     | Read Replicas and Replication Lag                  | Primary/replica; routing reads; asynchronous vs synchronous replication; replication lag and read-your-own-writes; failover promotion.                                         |
| `batching-and-asynchronous-writes`  | Batching and Asynchronous Writes                   | Grouping writes; acknowledging once durably queued and applying later; what it trades (latency, durability window, ordering, failure handling). Links `latency-vs-throughput`. |
| `cqrs`                              | CQRS: Separating Reads from Writes                 | Command Query Responsibility Segregation: a write model and separate read model(s); how they're kept in sync; eventual consistency; when it's not worth it.                    |
| `message-queues`                    | Message Queues                                     | Producers/consumers; acknowledgement and redelivery (at-least-once); visibility timeout; competing consumers; ordering caveats; queue vs. direct call. Links DLQ/backpressure. |
| `worker-pools`                      | Worker Pools                                       | A fixed set of workers taking jobs from a queue; sizing for CPU-bound vs I/O-bound work; queue depth as the signal; graceful shutdown; what a slow job does to the pool.       |
| `workflow-engines`                  | Workflow Engines and Durable Execution             | Long-running multi-step processes with persisted state, retries, timers and compensation; how that differs from a hand-built saga and from a plain queue.                      |
| `websockets-vs-sse-vs-long-polling` | WebSockets vs. Server-Sent Events vs. Long Polling | Three ways for a server to push to a client: how each works, what each costs (connections, proxies, direction), and how to choose. Scaling connections.                        |
| `self-healing-systems`              | Self-Healing Systems                               | Health checks (liveness vs readiness), automatic restart and replacement, failover, autoscaling; and the limits (crash loops, cascading restarts, flapping).                   |

Each topic is roughly 500-800 words with frontmatter `title`, `summary` and `date`. Each topic's technical claims must be correct and general. Naming a real
product as an example of a category is fine when the claim is well established
(a workflow engine like Temporal or AWS Step Functions), but never a claim
about how a company internally builds something.

## Two new questions

Ordered after the six seed questions (orders 7 and 8), in the same shape as
the existing ones (`docs/specs/system-design.md`; CLAUDE.md "System Design
questions").

| order | slug                               | title                                                       |
| ----- | ---------------------------------- | ----------------------------------------------------------- |
| 7     | `pushing-live-updates-to-users`    | How do I push live updates to users?                        |
| 8     | `running-work-that-takes-too-long` | How do I run work that takes too long for a single request? |

- Question 7 links `websockets-vs-sse-vs-long-polling` and the topics that
  matter once many clients hold connections open (`backpressure`,
  `thundering-herd-problem`, `exponential-backoff`).
- Question 8 links `message-queues`, `worker-pools`, `workflow-engines`,
  `dead-letter-queue`, `backpressure`, `idempotency`, and where relevant
  `outbox-pattern` and `saga-pattern`. It should say when a plain queue is
  enough and when a workflow engine is.

## Updates to existing pages (small, link-level)

- Reads question links `caching`, `read-replicas` and `cqrs`; writes question
  links `batching-and-asynchronous-writes` (and `cqrs` where it fits); the
  failing-service question links `self-healing-systems`. Their paragraphs that
  currently carry a topic's mechanism inline get trimmed to route-and-compare.
- `scaling-reads-vs-scaling-writes` links each of its named techniques to the
  new topic that now covers it, where one exists.
- A first mention of a "message queue" in `dead-letter-queue`, `backpressure`
  and `outbox-pattern`, of "workflow" in `saga-pattern`, and of "cache" in
  `cache-invalidation` gets one link to the new topic. No other prose in those
  topics changes.

## Tests

- `src/lib/system-design.test.ts` currently asserts the question list equals
  exactly the six seed questions. Change it to assert those six are the first
  six, in that order, so later questions can be added; keep every other
  assertion. No other test needs to change: coverage, dead links, the
  closing-section check and the tests that iterate over `QUESTIONS` /
  `TOPICS` pick the new content up automatically, which is the point of them.

## Eval

`evals/system-design-navigation/`: re-derive each existing scenario's
Expected against the new question set (`SDN-10` outbox and `SDN-11` saga may
now also plausibly reach question 8; decide whether each is unambiguous or now
ambiguous by design and record it), add scenarios for the new material
(live updates, long-running work, cache placement, replica lag, self-healing,
and a CQRS-shaped one), keep the control permanent, update the slug table, then
run the whole eval.

## Bundle size

New topic and question text ships in the main chunk (search indexes bodies
eagerly). Expect several kB. Raise the main-chunk limit deliberately to the
measured size plus about 4 kB and update the size note in `CLAUDE.md`'s
"Verifying a change" section. That note already records why the root fix
(load bodies and the search index on demand) is deferred and its revisit
condition (the main chunk passing about 200 KB brotlied, or a third
content-only raise); if this change makes that condition true, say so there
and treat it as a reason to schedule the fix, not to raise the limit again.

## Acceptance criteria

1. The nine topics exist with valid frontmatter and pass every existing
   content test, including the closing-section test and the coverage test
   (each is linked from at least one question).
2. Questions 7 and 8 exist with `order` 7 and 8, titles ending in `?`, valid
   links, and the ordering assertion in `system-design.test.ts` is updated as
   described.
3. The existing-page updates above are made and no other prose in those
   topics changes.
4. The full verification chain passes, including `npm run size` with any
   limit change recorded.
5. The eval's scenarios are updated and the run is logged.

## Out of scope

Walkthroughs of whole systems; topics beyond these nine; changing existing
topics' prose beyond the link-level edits above; a lazy-loading rewrite of the
content loader (recorded as a deferred practice instead).
