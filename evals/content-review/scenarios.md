# Content-review scenarios

Each scenario is a fully fabricated draft topic — frontmatter and body,
exactly as if it were about to be added via the `add-topic` skill — with
**exactly one** deliberately planted problem. These drafts are fixtures
for this eval only: never write them into `src/content/`. Give a
scenario's draft, verbatim, to a fresh reviewer agent along with
`add-topic`'s real Stage 3 instruction (copied fresh from
`.claude/skills/add-topic/SKILL.md` at run time — see `HOW_TO_RUN.md`) and
record whether the review actually catches the planted problem. See
`HOW_TO_RUN.md` for the full procedure and grading, and `../README.md`
for this repo's general eval philosophy.

Each scenario names the **section** the draft claims to belong to, so a
real run can glob that section's current sibling topics for the
near-duplicate check the same way a real `add-topic` review would.

`CR-*` scenarios test `add-topic`'s review. The `CS-*` scenarios at the end
test `add-case-study`'s review the same way, with a System Design case-study
draft and that skill's Stage 3 instruction instead.

---

### CR-01 — undefined jargon (trap for "define terms before using them")

**Section:** `engineering-practices` (not `systems-and-infrastructure`, whose
structural rules, a closing "Where you'll meet this" section and a System
Design link, drew real findings that outranked the planted one on
2026-09-24)
**Planted violation (the only one; the rest of the draft was corrected on
2026-09-24 so this one stands out):** never defines "hash function" before
relying on it as load-bearing vocabulary — a reader with zero background has no way
to know what "hash the item" actually means or why multiple hashes are
used.

```markdown
---
title: Bloom Filters
summary: A space-efficient way to check "definitely not present" instantly, at the cost of occasional false positives.
date: 2026-09-16
---

A Bloom filter answers one question fast and cheaply: "have I possibly
seen this before?" It can never wrongly say no, but it can wrongly say
yes — that's the tradeoff that makes it useful for things like checking
whether a URL might be malicious before doing a slower lookup, or
whether a username is already taken before hitting the database.

Under the hood, a Bloom filter is just a bit array, all zeros to start.
To add an item, you hash the item with several different hash functions
and set the resulting bit positions to 1. To check membership, you hash
the item the same way and check whether all those bit positions are
already 1 — if any of them are 0, the item was definitely never added;
if they're all 1, it probably was.

The false-positive rate depends on how full the bit array gets and how
many hash functions you use. A larger array lowers it at the cost of
memory. The number of hashes has a sweet spot for a given array size and
item count: too few and each item marks too little of the array to be
told apart, too many and the array fills up quickly. Databases such as
Cassandra keep a Bloom filter per data file for exactly this
"cheap definitely-not versus probably-yes" check, so most lookups for a key
that isn't there never touch the disk.
```

**Expected finding:** flags that "hash function" (and "hash the item")
is used as load-bearing vocabulary without ever being defined — a reader
with no prior background has no way to know what happens when you "hash"
something or why a bit position results from it.
**Fails if:** the review says nothing worth flagging, or flags something
else instead (e.g. a style nitpick) without ever naming the missing
definition.

---

### CR-02 — AI-patterned tone

**Section:** `engineering-practices`
**Planted violation:** a stock "not just X — it's Y" closer, filler
intensifiers stacked without adding information, and a bullet list where
every single item follows an identical bolded-lead-in-plus-dash rhythm
with zero variation.

```markdown
---
title: Feature Flags
summary: A way to ship code to production without releasing it to users yet, decoupling deploy from release.
date: 2026-09-16
---

A feature flag is a conditional check in your code that decides whether
a piece of functionality is active, controlled by a value you can change
without redeploying — usually a config service, a database row, or a
third-party flag provider. This genuinely, actually decouples two things
that normally happen together: deploying code (getting it onto
production servers) and releasing a feature (making it visible to
users).

That split unlocks a few real, actually useful patterns:

- **Gradual rollout**: turn a flag on for 1% of users, watch metrics,
  then dial it up — catching a bad change before it reaches everyone.
- **Kill switch**: turn a risky feature off instantly if it's causing
  problems, without waiting on a full deploy and rollback.
- **A/B testing**: show two different flag states to two user segments
  and compare outcomes.
- **Trunk-based development**: merge unfinished work behind a flag so
  it's off in production, avoiding long-lived feature branches.

It's not just a toggle in your code — it's a deployment strategy in
disguise, letting you separate "is this code live" from "is this code
visible" as two genuinely independent questions. That's the real power
of feature flags.
```

**Expected finding:** flags the "not just X — it's Y" closer, the
stacked filler intensifiers ("genuinely, actually," "real, actually
useful"), and the bullet list's mechanically identical rhythm across
every item, as reading like generically AI-patterned prose rather than
something a knowledgeable person actually wrote.
**Fails if:** the review says nothing worth flagging, or only catches
one of the three tells without naming the pattern as a tone problem.

---

### CR-03 — over-explained figurative language

**Section:** `engineering-practices`
**Planted violation:** introduces "rubber duck debugging" casually and
correctly, then spends a passage literally defending the term against a
misreading no reader would actually have.

```markdown
---
title: Rubber Duck Debugging
summary: Explaining your code line-by-line to an inanimate object, so the act of articulating it out loud surfaces the bug yourself.
date: 2026-09-16
---

Rubber duck debugging is explaining your code, out loud, line by line,
to something that can't talk back — traditionally a rubber duck sitting
on your desk. Partway through the explanation, you frequently spot the
bug yourself, before your listener says a word.

It works because the bug is usually already visible to you; you just
haven't been forced to slow down and state your assumptions explicitly.
Talking through code activates a different kind of processing than
silently reading it — you have to commit to what each line is
_supposed_ to do, out loud, in order, which is exactly the step most
silent debugging skips.

To be clear, the duck itself has no debugging ability and doesn't need
to be a literal rubber duck — a real duck isn't required, and neither is
any object at all, technically; a photo, a plant, or a patient colleague
works identically, since the mechanism was never about the duck having
any special property, biological or otherwise. The point isn't the duck;
it's forcing verbalization.

The technique scales down to solo work and up to pair programming, where
your pair effectively plays the duck's role while also being able to ask
a real follow-up question.
```

**Expected finding:** flags the third paragraph as over-explaining a
casual, widely-understood figurative term — defending "rubber duck
debugging" against a literal misreading ("the duck itself has no
debugging ability... biological or otherwise") that no reader would
actually have, instead of trusting the phrase to land.
**Fails if:** the review says nothing worth flagging, or flags the
metaphor's presence itself rather than its over-explanation.

---

### CR-04 — unverified/inaccurate technical claim

**Section:** `ai-and-ml`
**Planted violation:** states, confidently and without qualification,
that temperature 0 makes LLM output "fully deterministic on any
provider" — a claim that's oversimplified to the point of being wrong in
practice (GPU floating-point non-determinism, batching effects, and
mixture-of-experts routing mean most providers don't actually guarantee
bit-for-bit reproducibility at temperature 0, and several providers
document this explicitly).

```markdown
---
title: Temperature and Sampling in LLM Output
summary: How temperature and top-p shape which token an LLM picks next, and why "temperature 0" doesn't mean what people assume.
date: 2026-09-16
---

When an LLM generates text, it doesn't pick the next word directly — it
produces a probability distribution over its entire vocabulary for what
token could come next, and then a sampling step picks one. Temperature
controls how sharply that distribution gets skewed toward the highest-
probability tokens before sampling: a low temperature makes the model
overwhelmingly likely to pick the top candidate every time, while a high
temperature flattens the distribution so less-likely tokens get picked
more often, producing more varied (and more error-prone) output.

Top-p (nucleus sampling) is a related but different control: instead of
reshaping the whole distribution, it restricts sampling to the smallest
set of tokens whose cumulative probability crosses a threshold p, then
samples only from that shortlist. Temperature and top-p are commonly
used together — temperature shapes the distribution, top-p trims which
part of it is eligible to be sampled from at all.

Setting temperature to 0 makes an LLM's output fully deterministic on
any provider, since it always just picks the single highest-probability
token every time with no other source of randomness. This makes
temperature 0 the right setting whenever you need the exact same output
for the exact same input, such as automated testing or caching model
responses.
```

**Expected finding:** flags the temperature-0-determinism claim as
oversimplified/inaccurate — in practice, most providers' infrastructure
(floating-point non-associativity across parallelized GPU batches,
mixture-of-experts routing that depends on what else is in a batch, etc.)
means temperature 0 is only "mostly" or "usually" deterministic, not
guaranteed bit-for-bit reproducible, and several providers document this
caveat explicitly rather than promising true determinism.
**Fails if:** the review says nothing worth flagging on this claim, or
only raises an unrelated concern without questioning the determinism
claim itself.

---

### CR-05 — clean baseline (false-positive control)

**Section:** `engineering-practices`
**Planted violation:** none — this is a control. The draft defines its
terms, builds up from first principles, uses a concrete example, and
makes no unverified claims. The eval here is whether the review
reports only things that are true of the text, rather than inventing a
defect to justify itself. It is declared under `engineering-practices` (whose
existing topics don't overlap it) so that the near-duplicate check has
nothing to match and the closing "Where you'll meet this" rule for
`systems-and-infrastructure` topics doesn't apply; the subject matter is
not what this scenario tests. An earlier version (2026-09-16) left
"container", "orchestrator" and "Kubernetes" undefined and had no worked
example, and the review rightly flagged both; this version fixes those.

```markdown
---
title: Liveness vs. Readiness Probes
summary: Two different questions an orchestrator asks about a running container, and why conflating them causes bad restarts or traffic sent to a service that isn't ready yet.
date: 2026-09-16
---

A **container** is a packaged program that runs in isolation from the
other programs on the same machine, and a **container orchestrator**
such as Kubernetes is the system that starts containers, restarts them
when they fail, and decides which ones should receive traffic. To do
that automatically it needs a way to tell whether a running container is
healthy enough to keep, and whether it is ready enough to receive
traffic. These turn out to be two different questions, answered by two
different checks.

A **liveness probe** asks "is this process still working, or is it stuck
in a way it will never recover from on its own?" It is usually a
periodic HTTP request or command run against the container. If it fails
several times in a row, the orchestrator concludes the process is wedged
(deadlocked, stuck in an infinite loop, out of memory and unresponsive)
and restarts the container. For example, if the probe runs every 10
seconds and the orchestrator is set to act after 3 failures in a row, a
container that wedges is restarted about 30 seconds later. A liveness
probe answering "no" is a statement about the process's internal health,
independent of whether anything is currently trying to talk to it.

A **readiness probe** asks a narrower question: "is this container ready
to receive traffic right now?" A process can be alive (it hasn't
crashed) but not ready — for example, a service that's still loading a
large cache into memory at startup, or one that's lost its database
connection temporarily and is retrying. While a readiness probe is
failing, the orchestrator stops routing new traffic to that container
without restarting it, since restarting wouldn't fix a slow cache warm-up
or a database outage and would just make things worse.

Conflating the two causes two different failure modes: using only a
liveness probe means a container that's alive but not ready still
receives traffic and returns errors; using only a readiness probe means
a deadlocked container never gets restarted, since nothing is checking
whether it's stuck or just temporarily busy.
```

**Expected finding:** no finding that is false of the text. A thorough
reviewer will usually still raise real gaps in any draft (a missing
worked example, a nearby topic that overlaps, whether the subject fits
the section); those are acceptable and are recorded in the run's notes,
not graded as failures. A literal "nothing to flag" bar would punish
exactly the rigor the review is supposed to have, and two runs (2026-09-16
and 2026-09-21) both produced real findings on this control.
**Fails if:** the review reports a defect that isn't true of the draft: a
fabricated claim, a misreading of what the text says, or a correct
technical statement called wrong.

---

## Case-study scenarios (`add-case-study`)

These test `add-case-study`'s Stage 3 review instead of `add-topic`'s. They
share one fabricated base draft, a small Pastebin case study written to the
case-study template, so that each scenario differs from the clean control by
exactly the planted problem. Build a scenario's draft by taking the base draft
below and applying that scenario's replacement verbatim; give the reviewer the
result, plus the base diagram source, exactly as `add-case-study` Stage 3
would give a real draft and its `.d2` files. These are fixtures for this eval
only: never write them into `src/system-design/`. The base is deliberately
shorter than a real case study (compare `url-shortener.md`); a reviewer
noting that it's thin is a true finding, recorded in notes and not graded.

There's no **Section** here: give the reviewer the titles and slugs of the
real case studies in `src/system-design/case-studies/` for its
near-duplicate check, as the skill does.

### Base draft (the CS-03 control, verbatim)

```markdown
---
title: Design a Pastebin (like Pastebin.com)
summary: Storing millions of text snippets behind short links, and why the text itself belongs somewhere other than the database.
date: 2026-09-28
order: 2
---

A pastebin lets someone paste a block of text, such as a log excerpt or a
config file, and get back a link they can share. Opening the link shows the
text. This is one plausible design for a service like Pastebin.com, not a
description of how any company built theirs.

## Requirements

- **Create a paste** from up to 512 KB of text, and get back a link.
- **Read a paste** by its link.
- **Expiry (optional):** a paste can expire after a chosen time; the default
  is never.

Out of scope: accounts, editing a paste, syntax highlighting and search.

Non-functional: 1 million new pastes a day, 10 reads for every paste
created, reads under 100 ms at the 99th percentile (the time 99% of reads
beat), and pastes kept for one year unless they expire sooner.

## Back-of-the-envelope estimates

A day has 86,400 seconds, and a peak of ten times the average is a common
planning assumption.

- Writes: 1,000,000 ÷ 86,400 ≈ 12 per second on average, about 120 at peak.
- Reads: 10,000,000 ÷ 86,400 ≈ 116 per second on average, about 1,160 at
  peak.
- Storage: at an average paste of 10 KB, 1,000,000 × 10 KB = 10 GB a day,
  and 10 GB × 365 ≈ 3.65 TB a year.
- Cache: holding 20% of a day's reads is 0.2 × 10,000,000 = 2,000,000
  pastes, and at 10 KB each that's 20 GB.

Writes and reads are both modest. The number that shapes the design is
storage: terabytes of text a year.

## Data model

Two kinds of data with different shapes. Metadata is small and structured:
an ID, creation time, expiry and size, about 200 bytes a paste. Contents are
large, opaque blobs of text that are only ever read whole. Metadata goes in a
relational table keyed by paste ID; contents go in an object store, a service
that stores files by key and charges per gigabyte (the first deep dive
compares this with keeping them in the table).

## API design

- `POST /pastes` with `{ "content": "...", "expires_in_days": 7 }` returns
  `201 Created` and `{ "id": "aZ3kQ9", "url": "https://paste.example/aZ3kQ9" }`.
- `GET /pastes/aZ3kQ9` returns `200 OK` with the text, `404 Not Found` for an
  unknown ID, or `410 Gone` once it has expired.

## High-level architecture

![Clients call a load balancer, which forwards to app servers. App servers read pastes through a cache, store metadata in a relational database, and store paste contents in an object store.](/diagrams/pastebin/architecture.svg)

A read goes to the load balancer, then an app server, which checks the cache
for the paste; on a miss it reads the metadata row, checks expiry, fetches
the contents from the object store, and fills the cache. A create writes the
contents to the object store first, then inserts the metadata row, so a row
never points at contents that don't exist.

## Deep dive: where paste contents live

**In the database row.** One write, one read, and a single system to back
up. The cost is that the database carries 3.65 TB of text a year that it never
queries, which makes its backups, replicas and restores slow and its disks
expensive, since database storage costs far more per gigabyte than object
storage.

**In an object store.** Cheap per gigabyte and built to grow without limit,
and the database stays small (200 bytes × 365 million pastes ≈ 73 GB a year).
The cost is a second system on every request, an extra network round trip on
a cache miss, and two writes that can half-succeed: contents stored but the
row insert failed, which leaves an orphaned object that a periodic cleanup
job has to delete.

The object store wins here because storage is the dominant number; the
[caching](/systems-and-infrastructure/caching) layer hides the extra round
trip for popular pastes.

## Deep dive: expiring pastes

**Check on read.** The app server compares `expires_at` with the current time
and answers `410` if it has passed. It's exact and costs nothing extra, but
expired pastes keep using storage forever.

**A background sweep.** A daily job deletes expired rows and their objects.
It reclaims storage, but on its own leaves up to a day in which an expired
paste could still be served.

Doing both gives exactness on read and reclaimed storage within a day.

## Failure modes and bottlenecks

Anyone can create pastes, so creation is limited per IP address with
[rate limiting](/systems-and-infrastructure/rate-limiting). If the object
store is slow, cached pastes still load and uncached ones slow down; the
cache hit rate is the number to watch.

## Trade-offs

- Object storage over database rows: cheaper and simpler to scale, at the cost
  of a second system and orphan cleanup.
- Check-on-read plus a sweep over either alone: one more job to run, in
  exchange for both exact expiry and reclaimed storage.
```

Base diagram source (`src/system-design/diagrams/pastebin/architecture.d2`,
for every scenario):

```d2
direction: down
client: Client
lb: Load balancer
app: App servers
cache: Cache
db: Metadata DB {
  shape: cylinder
}
objects: Object store
client -> lb
lb -> app
app -> cache: "read first"
app -> db: "metadata"
app -> objects: "contents"
```

---

### CS-01 — estimate arithmetic error (trap for "estimates must hold")

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** the average read rate is off by ten:
10,000,000 ÷ 86,400 is about 116, not 1,160, and the peak derived from it is
ten times too high as well.
**Replacement in the base draft:** replace the "Reads" bullet with:

```markdown
- Reads: 10,000,000 ÷ 86,400 ≈ 1,160 per second on average, about 11,600
  at peak.
```

**Expected finding:** recomputes the read estimate and flags that
10,000,000 ÷ 86,400 ≈ 116 per second (peak ≈ 1,160), not 1,160 (peak
11,600), noting that it's also inconsistent with the stated 10:1 read-to-write
ratio against 12 writes a second.
**Fails if:** the review doesn't flag the read rate, or flags only style
while accepting the numbers.

---

### CS-02 — a deep dive that picks without comparing

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** the first deep dive states the choice
(object storage) and how to use it, but never compares it with keeping the
contents in the database or says what the choice costs.
**Replacement in the base draft:** replace everything between
`## Deep dive: where paste contents live` and `## Deep dive: expiring pastes`
(keeping both headings) with:

```markdown
Paste contents go in an object store. On a create, the app server uploads the
text under the paste's ID, then inserts the metadata row with the object's
key. On a read, it fetches the row, then the object, and caches the result.
Objects are stored in one bucket, and the
[caching](/systems-and-infrastructure/caching) layer keeps popular pastes in
memory so most reads never reach the object store.
```

**Expected finding:** flags that this deep dive picks object storage without
comparing any alternative (keeping contents in the database row is the
obvious one) and without saying what the choice costs (a second system, an
extra round trip, two writes that can half-succeed), contrary to the
checklist's "each deep dive compares at least two options."
**Fails if:** the review doesn't flag the missing comparison, or flags only
the other deep dive.

---

### CS-03 — clean case study (false-positive control)

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation:** none. The base draft, verbatim. Its estimates are
correct (1,000,000 ÷ 86,400 ≈ 11.6; 10,000,000 ÷ 86,400 ≈ 115.7;
1,000,000 × 10 KB = 10 GB; 10 GB × 365 = 3,650 GB; 200 B × 365,000,000 =
73 GB; 0.2 × 10,000,000 × 10 KB = 20 GB), both deep dives compare two options
with their costs, and the diagram shows exactly the components the prose
names.
**Expected finding:** no finding that is false of the draft. Real gaps, such
as its thinness next to the reference case study or a missing sequence
diagram, are acceptable and go in the run's notes.
**Fails if:** the review reports a defect that isn't true of the draft: an
arithmetic "error" in a correct line, a deep dive called one-sided when it
compares two options, a diagram/prose mismatch that isn't there, or a correct
technical statement called wrong.
