# Case-study drafting checklist

Read this in Stage 1, before drafting, and check the draft against every item
before Stage 2. Each item is a problem class that independent reviewers found
repeatedly in the first batch of case studies (2026-09). Each one cost a
review round when missed.

**Length.** Aim for about 5,000–5,500 words of prose, with three deep dives
and two diagrams. More depth isn't more teaching. The drafts that ran to 8,000
words drew the most findings.

1. **Dual writes.** Any "write to the store, then publish to a queue or
   another store" step loses the second write if the process dies in between.
   Use an outbox (same transaction or partition) or a recovery marker, and
   link `/systems-and-infrastructure/outbox-pattern`. Say what happens on a
   crash at every step of every write path.
2. **Conditional writes, leases and fencing.** State exactly what a conditional
   write checks (which fields, which states), which states are terminal, and
   what a retry writes. A lease can expire while its holder is still alive
   (GC pause, slow call). Say how that is fenced (a version or fencing token
   checked on the write) and what it costs on the chosen store; on a
   leaderless store a compare-and-set needs a consensus round. Link
   `/systems-and-infrastructure/distributed-locks` where leases appear.
3. **Duplicates.** At-least-once delivery means duplicates. Say where they're
   removed (idempotency key, unique constraint) and what can still double.
   Never claim exactly-once effects across a boundary you don't control, such
   as a provider or a phone.
4. **Estimates.** Every figure follows from a stated requirement or a stated
   assumption, and every line is recomputed (node works). When a number
   changes, grep the page and update every use: requirements, estimates, deep
   dives, failure modes, trade-offs, diagram labels, alt text, summary. State
   headroom explicitly, never sizing at ~100% of capacity. Keep averages
   separate from peaks, and requests separate from distinct items.
5. **Diagrams fit the page.** The column is about 720 px and a diagram is
   never scaled below 0.75, so every rendered SVG stays at or below ~950 px
   wide (read the width from `public/diagrams/manifest.json`). Architecture
   diagrams have 8–11 nodes; if the default layout is too wide, try
   `vars: { d2-config: { layout-engine: elk } }`, merge nodes, or wrap labels.
   Sequence diagrams have at most 5–6 participants. Every component, edge and
   name matches the prose and the alt text exactly.
6. **Product claims.** State documented public behavior only when sure, scoped
   ("some providers"), and never describe how a named company builds its
   system. Facts reviewers caught:
   - Redis sorted-set scores are doubles (exact only to 2^53).
   - JSON numbers above 2^53 lose precision, so send large IDs as strings.
   - A presigned PUT signs an exact size.
   - Cold storage tiers may bill a minimum object size.
   - Archive tiers differ by provider.
7. **Terms.** Define every term briefly at first use for a reader with zero
   background (load balancer, replica, shard, partition, primary, TTL, lease,
   idempotency key…), and put the catalog link at that first use.
8. **Deep dives** compare at least two real options with what each costs in
   this design's numbers, then choose. Don't re-teach a linked topic.
9. **Prose.**
   - No meta-commentary ("it's worth noting", "remember that").
   - No repeated "not X, but Y" closers.
   - Trade-offs bullets don't all share one rhythm.
   - The summary is one short, scannable sentence that matches the body.
10. **Requirements match the design.** If the design can't meet a stated
    requirement (latency, availability, "never lose", "exactly once"), change
    one of them and say so.
11. **At a glance matches the body.** Every figure in it is copied from the
    body (grep each one), the three decisions and the follow-up answers say
    only what the body argues, and each in-page link lands on the section that
    covers it. When a body number changes, this section is one of the places
    item 4's grep must reach.

Link earlier case studies (`/system-design/<slug>`) where a design reuses
their mechanism instead of re-deriving it. Examples: push delivery (the
notification system), socket gateways (the chat app), rate limits (the rate
limiter), chunked uploads (file storage), fan-out (the social feed).
