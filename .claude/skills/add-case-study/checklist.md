# Case-study drafting checklist

Read this in Stage 1, before drafting, and check the draft against every item
before Stage 2. Each item is a problem class that independent reviewers found
repeatedly in the case studies so far. Each one cost a review round when
missed.

**Length.** At most 1,150 words of prose, not counting diagrams or code
(docs/case-studies.md has the template; `case-study-structure.test.ts` counts
them). Most of the budget goes to the three decisions. When a draft runs long,
cut an exception or a second alternative before cutting a decision's reason.
The earlier 6,000-word case studies were thorough and hard to remember.

1. **Durability and duplicates, named, not exhaustively traced.** Where a
   write goes to two places ("store, then publish"), name the risk (the second
   write is lost if the process dies in between) and the mechanism that covers
   it (an outbox, an idempotency key, a unique constraint), and link the topic
   (`/systems-and-infrastructure/outbox-pattern`,
   `/systems-and-infrastructure/distributed-locks`). Never claim exactly-once
   effects across a boundary you don't control, such as a provider or a
   phone. One sentence each; the catalog topic carries the step-by-step crash
   analysis.
2. **Estimates.** Every figure follows from a stated requirement or a stated
   assumption, and every line is recomputed (node works). When a number
   changes, grep the page and update every use: requirements, key numbers,
   decisions, follow-ups, diagram labels, alt text, summary. State headroom
   explicitly, never sizing at ~100% of capacity. Keep averages separate from
   peaks, and requests separate from distinct items.
3. **Decisions.** Each one names the choice, why in this design's numbers, the
   one alternative a reader would suggest and why it loses here, and ends with
   a `**Rule of thumb.**` paragraph stating the general rule. Pick the three
   decisions that most shape the design; a fourth goes in follow-ups or is cut.
   Don't re-teach a linked topic.
4. **Diagrams fit the page.** The column is about 720 px and a diagram is
   never scaled below 0.75, so every rendered SVG stays at or below 960 px
   wide, target ~950 (`check:diagrams` fails on a wider width in
   `public/diagrams/manifest.json`). Architecture diagrams have 8–11 nodes; if
   the default layout is too wide, try
   `vars: { d2-config: { layout-engine: elk } }`, merge nodes, or wrap labels.
   Sequence diagrams have at most 5–6 participants. Every component, edge and
   name matches the prose and the alt text exactly. A diagram costs no words,
   so let it carry the structure the prose would otherwise describe.
5. **Product claims.** State documented public behavior only when sure, scoped
   ("some providers"), and never describe how a named company builds its
   system. Facts reviewers caught:
   - Redis sorted-set scores are doubles (exact only to 2^53).
   - JSON numbers above 2^53 lose precision, so send large IDs as strings.
   - A presigned PUT signs an exact size.
   - Cold storage tiers may bill a minimum object size.
   - Archive tiers differ by provider.
6. **Terms.** Define every term in a short phrase at first use (load
   balancer, replica, shard, partition, primary, TTL, lease, idempotency
   key…), and put the catalog link at that first use.
7. **Compression overclaims.** Short prose tends to drop the qualifier that
   made a claim true ("never loses a message" for "doesn't lose an
   acknowledged message"). Check every absolute word: never, always, exactly,
   guaranteed.
8. **Voice and prose** (docs/writing-standard.md, "Case studies and DSA
   entries").
   - Talk to the reader; ask their next question, then answer it.
   - One running example, carried through the page.
   - No meta-commentary ("it's worth noting", "remember that").
   - No repeated "not X, but Y" closers, and the three decisions don't share
     one rhythm.
   - The summary is one short, scannable sentence that matches the body.
9. **Requirements match the design.** If the design can't meet a stated
   requirement (latency, availability, "never lose", "exactly once"), change
   one of them and say so.
10. **Follow-ups say only what the page supports.** Each answer is consistent
    with the decisions and numbers above it; one that needs a new mechanism
    names it in a phrase and links the catalog topic.

Link earlier case studies (`/system-design/<slug>`) where a design reuses
their mechanism instead of re-deriving it. Examples: push delivery (the
notification system), socket gateways (the chat app), rate limits (the rate
limiter), chunked uploads (file storage), fan-out (the social feed).
