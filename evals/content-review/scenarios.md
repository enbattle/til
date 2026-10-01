# Content-review scenarios

Each scenario is a fully fabricated draft topic — frontmatter and body,
exactly as if it were about to be added via the `add-topic` skill — with
**exactly one** deliberately planted problem. These drafts are fixtures
for this eval only: never write them into `src/content/`. Give a
scenario's draft, verbatim, to a fresh reviewer agent along with
`add-topic`'s real Stage 3 instruction (built fresh at run time) and record
whether the review actually catches the planted problem. The
`content-review-eval` skill has the full procedure and grading, and
`../README.md` this repo's general eval philosophy.

Each scenario names the **section** the draft claims to belong to, so a
real run can glob that section's current sibling topics for the
near-duplicate check the same way a real `add-topic` review would.

`CR-*` scenarios test `add-topic`'s review. The `CS-*` and `DS-*` scenarios
after them test `add-case-study`'s and `add-dsa-entry`'s reviews the same
way, with a case-study draft or a DSA entry and its code instead.

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
defect to justify itself. It is declared under `engineering-practices`, and
no topic in any section covers versioning or dependency updates, so the
near-duplicate check has nothing to match and the closing "Where you'll meet
this" rule for `systems-and-infrastructure` topics doesn't apply; the subject
matter is not what this scenario tests. Until 2026-09-28 the control was a
"Liveness vs. Readiness Probes" draft, which every run from 2026-09-21 on
rightly called a near-duplicate of `self-healing-systems` (same distinction,
same cache warm-up example), so the control moved to this subject.
Its claims follow the Semantic Versioning 2.0.0 specification (semver.org:
the reset rule, `0.y.z` as initial development where anything may change) and
npm's documentation: the caret and tilde ranges, including the caret's
leftmost-nonzero rule below `1.0.0` (`^0.3.1` is `>=0.3.1 <0.4.0`, `^0.0.3`
is `>=0.0.3 <0.0.4`); the default `^` save prefix; `package-lock.json`,
written by default since npm 5, which a plain `npm install` follows while it
still satisfies `package.json`; `npm ci` removing `node_modules`, erroring
when the lockfile and `package.json` disagree, and never writing either file;
and `npm update` moving packages to the newest version their ranges allow.
Python's version scheme is PEP 440, not SemVer.

```markdown
---
title: Semantic Versioning
summary: What the three numbers in a version like 2.4.1 promise, and how a package manager (for example, npm) relies on that promise to decide which updates to install without asking.
date: 2026-09-28
---

Most projects are built on **dependencies**: libraries, meaning code someone
else wrote and published, that your project calls. A **package manager**
such as npm (for JavaScript) or pip (for Python) downloads them for you. Each
library keeps publishing new versions, and every time it does you face the
same question: can I take this update without anything breaking? A version
number like `4.17.21` can't answer that on its own, unless the library's
authors have agreed on what the numbers mean.

Semantic Versioning, or SemVer, is that agreement, written down as a
short specification at semver.org (the current version is 2.0.0). A version
has three parts, `MAJOR.MINOR.PATCH`, and each one is a promise about the library's
**public API**: the functions, options and behavior its authors document for
other people to use, as opposed to the internals they're free to rewrite.
Compared with the release before it:

- PATCH goes up for a bug fix that leaves the API as it was.
- MINOR goes up when something is added, such as a new function or option,
  and everything that already existed works as before.
- MAJOR goes up for any change that isn't backward compatible, meaning code
  written against the previous version could stop working: something removed
  or renamed, or documented behavior changed.

Raising one number resets the numbers to its right to zero, so the release
after `1.4.2` is `1.4.3`, `1.5.0` or `2.0.0`.

Take a date-formatting library at `1.4.2`. Its `formatDate` function prints
the wrong month for December dates; the fix ships as `1.4.3`. Next, the
authors add `formatRelative`, which turns a date into text like "3 days ago".
Nothing that existed changed, so that's `1.5.0`. Then they rename
`formatDate` to `format` and drop the old name. Every project calling
`formatDate` would now fail, so that release has to be `2.0.0`.

Versions below `1.0.0` are a special case. The specification treats `0.y.z`
as initial development, where anything may change at any time, and `1.0.0`
is the release where the authors commit to a public API.

## How npm uses it

npm leans on these numbers directly. (Not every ecosystem does: Python's
tools follow their own rules, PEP 440, instead.) A JavaScript project
lists its dependencies in a `package.json` file at its root, and because the
numbers carry meaning, it can say which versions of each it accepts instead
of **pinning** one, that is, naming a single exact version such as `1.4.2`.
`^1.4.2` (a caret) accepts anything from `1.4.2` up to but not including
`2.0.0`: later fixes and additions, but no breaking changes. `~1.4.2` (a
tilde) is stricter and accepts only patches, from `1.4.2` up to but not
including `1.5.0`. When you add a package with `npm install <name>`, npm
records it with a caret by default.

Below `1.0.0`, where the specification promises nothing, npm adds a
convention of its own: the caret treats a change to the leftmost nonzero
number as breaking. So `^0.3.1` accepts later `0.3` patches but not `0.4.0`,
treating a new `0.y` as a breaking release, and `^0.0.3` accepts only `0.0.3`
itself.

With ranges alone, every install resolves them again, usually to the newest version each one accepts, so two machines
installing a week apart can end up running different code. And the promise
is only as good as the people making it: a bug fix can break a project that
relied on the bug, and authors sometimes misjudge what counts as breaking.

So npm also writes a **lockfile**, `package-lock.json`, recording the exact
version of every package it installed, including the dependencies of your
dependencies. With the lockfile committed, a plain `npm install` on another
machine installs those locked versions, as long as they still satisfy the
ranges in `package.json`. `npm ci`, meant for automated builds, is stricter:
it deletes any installed packages (the `node_modules` folder) first, fails if
the lockfile and `package.json` disagree, and never rewrites the lockfile.

A dependency then changes version when someone changes the lockfile: by
running `npm update`, which moves each package to the newest version its
range allows, by installing a specific version with
`npm install <name>@<version>`, or by editing a range in `package.json` and
reinstalling (the locked version only moves if it no longer fits the new
range). Dependency bots such as Dependabot open pull requests, proposed
changes for someone to review, that do the same. Each route shows up as a
change to `package-lock.json`, so an upgrade becomes a
deliberate change that can be reviewed and tested like any other, instead of
something that arrives unnoticed on the next install.
```

**Expected finding:** no finding that is false of the text. A thorough
reviewer will usually still raise real gaps in any draft (a missing
worked example, a nearby topic that overlaps, whether the subject fits
the section); those are acceptable and are recorded in the run's notes,
not graded as failures. A literal "nothing to flag" bar would punish
exactly the rigor the review is supposed to have, and every run from
2026-09-16 to 2026-09-28 (all on the earlier probes draft) produced real
findings on this control.
**Fails if:** the review reports a defect that isn't true of the draft: a
fabricated claim, a misreading of what the text says, or a correct
technical statement called wrong (for example, calling the caret's
narrower `0.y.z` range, `^0.0.3` matching only `0.0.3`, a plain `npm install`
following the lockfile, or a bug fix shipping as a patch, an error).

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
summary: Keeping a year of text snippets behind short links, and why the text itself belongs somewhere other than the database.
date: 2026-09-28
order: 17
---

A pastebin lets someone paste a block of text, such as a log excerpt or a
config file, and get back a link they can share. Opening the link shows the
text. This is one plausible design for a service like Pastebin.com, not a
description of how any company built theirs.

## At a glance

**Requirements.**

- Create a paste of up to 512 KB and get back a link that's hard to guess.
- Read a paste by opening its link; there are no accounts.
- Expiry of 1 to 365 days (default 365), with expired text deleted within a
  day.
- 1 million new pastes a day, 10 reads for each, and reads under 500 ms at
  p99.

**Key numbers.**

- About 120 creates/s at peak (1,000,000 ÷ 86,400 ≈ 12, 10× for peak).
- About 3.65 TB of text (1,000,000 × 10 KB = 10 GB a day, × 365).
- 4 GB of cache for the most-read 20% of a day's 2 million pastes.
- About 73 GB of metadata (200 bytes × 365 million pastes).
- 62⁷ ≈ 3.5 trillion IDs, so about 1 guess in 9,600 finds a paste.

**Key decisions.**

- Contents in an object store: the database holds 73 GB of metadata instead
  of 3.65 TB of text ([contents](#deep-dive-where-paste-contents-live)).
- Expiry checked on every read and swept daily: exact expiry, with storage
  reclaimed within a day ([expiry](#deep-dive-expiring-pastes)).
- IDs from a counter and a keyed encryption step: never reused, and random to
  anyone without the key ([data model](#data-model)).

**Likely follow-ups.**

- What removes an object whose row insert failed? A lifecycle rule deleting
  anything older than 366 days ([contents](#deep-dive-where-paste-contents-live)).
- Why delete the object before the row? A failure in between leaves an
  expired row the next run finds again ([expiry](#deep-dive-expiring-pastes)).
- What if the cache node is lost? Reads slow down but still beat 500 ms, at
  around 200 ms for a slow miss ([failure modes](#failure-modes-and-bottlenecks)).
- How is guessing held back? An address with 100 `404`s in an hour is blocked
  for the rest of it, about one paste found every four days; only a longer ID
  slows a botnet ([failure modes](#failure-modes-and-bottlenecks)).

The components are drawn under
[High-level architecture](#high-level-architecture).

## Requirements

- **Create a paste** from up to 512 KB of text, and get back a link such as
  `https://paste.example/aZ3kQ9x`.
- **Read a paste** by opening its link. There are no accounts, so the link is
  the only thing keeping a paste from strangers, and it must be hard to guess.
- **Expiry:** the creator picks how many days a paste lasts, from 1 to 365;
  the default, and the maximum, is 365. After that it can't be read, and its
  text is deleted within a day.

Out of scope: accounts, editing a paste, syntax highlighting and search.

Non-functional: 1 million new pastes a day, 10 reads for every paste
created, and reads answered in under 500 ms at the 99th percentile (p99: the
time 99% of reads beat), measured at our servers. A paste is a page someone opens
by hand, not an API called in a loop, so half a second is acceptable.

## Back-of-the-envelope estimates

A day has 86,400 seconds, and a peak of ten times the average is a common
planning assumption. Sizes are decimal: 1 KB is 1,000 bytes.

- Writes: 1,000,000 ÷ 86,400 ≈ 12 per second on average, about 120 at peak.
- Reads: 10,000,000 ÷ 86,400 ≈ 116 per second on average, about 1,160 at
  peak.
- Storage: assume an average paste of 10 KB, far below the 512 KB limit
  since most pastes are a screen or two of text. 1,000,000 × 10 KB = 10 GB a
  day. No paste outlives 365 days, so storage levels off at about
  10 GB × 365 ≈ 3.65 TB, and less if many pastes expire sooner.
- Cache: assume a day's 10 million reads land on about 2 million distinct
  pastes, five reads each on average, and that they're skewed the familiar
  80/20 way. A paste linked from a busy forum thread is read thousands of
  times while most are read once or twice, so the most-read 20% of pastes
  draw about 80% of reads. Caching everything read in a day would take
  2,000,000 × 10 KB = 20 GB. Caching the most-read 20% takes
  0.2 × 2,000,000 = 400,000 pastes, and at 10 KB each, 4 GB, which fits in
  one server's memory.

Writes and reads are both modest. The number that shapes the design is
storage: terabytes of text.

## Data model

Two kinds of data with different shapes. **Metadata** is small and
structured: the paste's ID, creation time and `expires_at`, about 200 bytes a
paste once the database's per-row overhead and indexes are counted.
**Contents** are the text itself: large, opaque, and only ever read whole.
Metadata goes in a relational database (one that keeps rows in tables and is
queried with SQL), in a table whose **primary key** is the paste ID. The
primary key is the column that identifies each row: the database refuses two
rows with the same one, and keeps an
[index](/systems-and-infrastructure/database-indexing) on it, a lookup
structure that finds a row without reading the others. A second index, on
`expires_at`, finds expired rows the same way. Contents go in an **object
store**, a service that keeps each blob of bytes under a key, hands it back by
that key, and charges per gigabyte stored and per request (the first deep dive compares this with
keeping them in the table).

A paste ID is seven base62 characters (the digits and the lower- and
upper-case letters), so there are 62⁷ ≈ 3.5 trillion possible IDs. They come
from the scheme the [URL shortener](/system-design/url-shortener) works
through. A counter, kept as one row in the metadata database, hands out
blocks of 10,000 numbers to each app server, which uses them from memory.
Each number then goes through an encryption step over the range 0 to
62⁷ − 1, keyed with a secret that only the app servers hold, and is written
as seven characters, padded with leading zeros. The counter never repeats a
number and the encryption is one-to-one, so an ID is never reused, and 3.5
trillion IDs last over 9,000 years at 365 million a year. Without the key the
IDs look random, so guessing one is no better than picking at random: with at
most 365 million live pastes, 365,000,000 ÷ 62⁷ ≈ 0.01%, about 1 guess in
9,600, finds a paste. The failure modes cover how fast one address may guess.

## API design

- `POST /pastes` with `{ "content": "...", "expires_in_days": 7 }` returns
  `201 Created` and
  `{ "id": "aZ3kQ9x", "url": "https://paste.example/aZ3kQ9x" }`. Leaving out
  `expires_in_days` means 365. It returns `400 Bad Request` if
  `expires_in_days` isn't 1 to 365, `413 Content Too Large` over 512 KB, and
  `429 Too Many Requests` over the per-address limit in the failure modes.
- `GET /aZ3kQ9x`, the shared link itself, returns `200 OK` with the text,
  `404 Not Found` for an unknown ID, or `410 Gone` for a paste that has
  expired but that the daily cleanup job hasn't deleted yet. After the job
  deletes it, at most a day after expiry, nothing of the paste is kept and its
  ID answers `404`; either way, the client learns the paste is gone.

## High-level architecture

![A client calls a load balancer, which forwards to app servers. To read a paste, the app servers check a cache first; on a miss they read the metadata database and the object store and fill the cache. To create one, they store its contents in the object store and its metadata in the metadata database. A daily cleanup job deletes expired pastes' contents from the object store and their rows from the metadata database.](/diagrams/pastebin/architecture.svg)

- The **load balancer** receives every request and spreads them across the
  app servers.
- The **app servers** run the service's code. They keep nothing between
  requests, so any of them can handle any request, and adding one adds
  capacity.
- The **cache** holds recently read pastes in memory, keyed by ID, the
  pattern [caching](/systems-and-infrastructure/caching) covers. Memory
  answers in well under a millisecond, so a read the cache can answer (a
  **hit**) skips the database and the object store. It's capped at the
  estimate's 4 GB, and when full it evicts the least recently used entry
  (**LRU**), which keeps roughly the most-read pastes, since a popular paste
  is read again before it reaches the back. The share of reads that hit is
  the **hit rate**; the 80/20 assumption puts it at about 80%, a little less
  in practice, since a paste's first read always misses and LRU only
  approximates the most-read 20%.
- The **metadata database** and **object store** are the two stores from the
  data model, and the **daily cleanup job** is in the expiry deep dive.

A read goes to the load balancer, then an app server, which asks the cache
for the paste. A cache entry holds the contents and `expires_at`, and on a
hit the app server checks `expires_at` before answering. On a miss it reads
the metadata row (answering `404` if there's none and `410` if it has
expired), fetches the contents from the object store, and puts both in the
cache with a **TTL** (time to live: how long the cache keeps the entry) of
one day, cut short to `expires_at` if that comes sooner. Without the cap,
those entries would add up to everything read in a day, about 20 GB. A create
writes the contents to the object store first, then inserts the metadata
row, so a live row never points at contents that don't exist.

**Checking the latency target.** A hit takes a few milliseconds. A miss adds
a lookup by primary key in the database, a few milliseconds more, and an
object-store fetch, which for a small object typically takes tens of
milliseconds and can reach a couple of hundred. With about one read in five
missing, the slowest 1% of reads are all misses, so the 500 ms target holds
if 95 in 100 misses beat it (1% of reads is 5% of the misses). At around
200 ms for a slow miss, they do, with room to spare.

## Deep dive: where paste contents live

**In the database row.** One write, one read, and a single system to back
up. The cost is that the database carries up to 3.65 TB of text that it never
queries, which makes its backups, copies and restores slow and its disks
expensive, since database storage costs far more per gigabyte than object
storage.

**In an object store.** Storage is cheap per gigabyte and grows without
limit, though each upload is billed as a request too: at list prices, a
million creates a day costs more in requests than 3.65 TB costs to store. The
database stays small, at 200 bytes × 365 million pastes (a year's worth) ≈
73 GB. The cost is a second system on every create, an extra network
request on every cache miss, and two writes that can half-succeed: contents
stored but the row insert failed, which leaves an orphaned object that no row
points at. Finding those by comparing the store's keys with the table would
mean listing about 365 million keys, 365,000 list calls a day at 1,000 keys a
call, and it would race creates in flight, whose object exists a moment
before their row. Instead, a **lifecycle rule** on the object store, a
setting that deletes every object older than a given age, removes anything
older than 366 days. No paste lives longer than 365 days, so the rule never
touches a live one, and an orphan costs at most a year of storage.

The object store wins here because of what the text would do to the database:
3.65 TB that nothing queries, in every backup, copy and restore. The two
object-store bills are small either way. The cache hides the extra request for
popular pastes, and the latency check above already counts it for the rest.

## Deep dive: expiring pastes

Every paste has an `expires_at`, so expiry has two jobs: stop serving a paste
once that time passes, and delete it so storage stays at a year's worth.

**Check on read.** The app server compares `expires_at` with the current time
on every read, hit or miss, and answers `410` if it has passed; a cache
entry's TTL, capped at `expires_at`, also drops it from memory at that
moment. It's exact and costs one comparison, but on its own it deletes
nothing: expired text would pile up past the 3.65 TB estimate, and the
requirement that it's deleted would go unmet.

**A background sweep.** A daily job uses the index to find rows whose
`expires_at` has passed, and for each one deletes the object and then the
row. Once the service has run for a year, that's about a million pastes a
day, the same rate they're created. It reclaims storage, but on its own
leaves up to a day in which an expired paste could still be served.

Doing both gives exact expiry on read and storage reclaimed within a day.
Deleting the object before the row means a failure between the two leaves an
expired row with no object. Reads of it answer `410` from the row without
fetching anything, and the next run finds the row again, deletes the
already-missing object, which is harmless, and removes the row. The other
order would leave an object that no row points at, which only the 366-day
lifecycle rule would ever remove.

## Failure modes and bottlenecks

**The cache node is lost.** Every read misses until the cache refills: about
1,160 reads a second at peak, each a primary-key lookup in the database and a
fetch from the object store. That load is well within what one relational
database and an object store serve, and at around 200 ms a slow miss still
beats the 500 ms target, so reads get slower but keep working while popular
pastes fill the cache again. The per-address counts in the abuse limits
below, kept in the cache, start over.

**The metadata database is unavailable.** Creates fail, since there's nowhere
to insert the row, and so do cache misses. Cache hits still work, because an
entry holds the contents and `expires_at`, so about four reads in five keep
being answered. A standby copy of the database, kept up to date and promoted
when the main one fails, keeps that window short.

**The cleanup job stops running.** Reads still answer `410` on time, so
nothing looks wrong, but expired text is no longer deleted within a day, as
the requirements promise; rows pile up, and the lifecycle rule removes the
contents only at 366 days. The job records when it last finished, and an
alert fires if that was more than 26 hours ago.

**The object store is slow.** Cached pastes still load and uncached ones slow
down. The latency check assumed a slow miss takes around 200 ms and about one
read in five misses, so watch both numbers: the object store's fetch latency,
and the hit rate, since a lower hit rate puts more reads on the slow path.

**Abuse.** Anyone can create pastes, so creation is limited per address with
[rate limiting](/systems-and-infrastructure/rate-limiting), counted in the
cache that every app server shares: 10 creates a minute per address. For
IPv6, an address means a /56 prefix (the first 56 bits), the block an
internet provider commonly gives one home, so a household can't rotate
through its own addresses to dodge the limit. An address at the limit makes one
create every 6 seconds, 1/720 of the 120-a-second peak, so no single sender
can flood the service. The cost falls
on people who share one address, such as an office or school behind one
router that translates many devices to a single public address (NAT): they
share the limit too and see `429` sooner. Reads get a limit aimed at
guessing: an address that gets 100 `404`s in an hour is blocked for the rest
of that hour, which holds it to about 100 × 0.01% ≈ 0.01 pastes found an
hour, one every four days. A botnet (many machines an attacker controls)
guessing from 10,000 addresses gets that
rate from each, about 100 pastes an hour, and no per-address limit stops it;
only a longer ID does. An eighth character would make a guess about 1 in
600,000 (62⁸ ÷ 365,000,000), at the cost of a longer link. This design keeps
seven, since a paste link is meant to be easy to share, and a creator who
needs privacy shouldn't rely on an unlisted link.

## Trade-offs

- **Object storage for contents.** It keeps 3.65 TB of text out of the
  database and is cheap per gigabyte; the price is a second system on every
  create and a lifecycle rule to catch orphans.
- **Expiry enforced twice**, by the check on read and by the daily sweep.
  That's one more job to run and alert on, and it's what gives both exact
  expiry and storage that stops growing at a year of pastes.
- **Keyed encryption for IDs** rather than a scramble anyone could undo,
  which puts a secret key on the app servers; an undoable scramble would
  let anyone list the IDs actually issued. Seven characters rather than six
  make every link one character longer, and in return a guess finds a paste
  about once in 9,600 tries instead of once in 156.
- **`404` after deletion.** A deleted paste's ID answers `404`, not `410`. An exact answer would
  mean keeping a record of every expired ID, and here nothing of an expired
  paste is kept.
```

Base diagram source (`src/system-design/diagrams/pastebin/architecture.d2`,
for every scenario):

```d2
direction: down
client: Client
lb: Load balancer
app: App servers
cache: Cache
db: Metadata database {
  shape: cylinder
}
objects: Object store
cleanup: Daily cleanup job
client -> lb
lb -> app
app -> cache: "check first, fill on miss"
app -> db: "metadata"
app -> objects: "contents"
cleanup -> objects: "delete expired contents"
cleanup -> db: "then delete expired rows"
```

---

### CS-01 — estimate arithmetic error (trap for "estimates must hold")

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** the average read rate is off by ten:
10,000,000 ÷ 86,400 is about 116, not 1,160, and the peak derived from it is
ten times too high as well. The base draft's `At a glance` section leaves
the read rate out of its key numbers on purpose, so this error appears only in
the estimates and the scenario stays as hard as before the section existed.
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
text under the paste's ID, then inserts the metadata row. On a cache miss, it
reads the row, then fetches the object, and puts both in the cache. The cache
keeps popular pastes in memory, so most reads never reach the object store. A
**lifecycle rule** on the object store, a setting that deletes every object
older than a given age, removes anything older than 366 days.
```

**Expected finding:** flags that this deep dive picks object storage without
comparing any alternative (keeping contents in the database row is the
obvious one) and without saying what the choice costs (a second system, an
extra request on a cache miss, two writes that can half-succeed), contrary to
the checklist's "each deep dive compares at least two options." A reviewer may
also note that the data model promises a comparison this deep dive doesn't
make, or that Trade-offs and the expiry deep dive name costs (a second system,
orphaned objects the lifecycle rule catches) the body never argues, or that
the `At a glance` decision linking to this deep dive gives a reason the deep
dive no longer argues; all are the same planted gap.
**Fails if:** the review doesn't flag the missing comparison, or flags only
the other deep dive.

---

### CS-03 — clean case study (false-positive control)

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation:** none. The base draft, verbatim. Its estimates are
correct and each follows from a stated requirement or assumption
(1,000,000 ÷ 86,400 ≈ 11.6; 10,000,000 ÷ 86,400 ≈ 115.7; 1,000,000 × 10 KB =
10 GB; 10 GB × 365 = 3,650 GB; 10,000,000 ÷ 2,000,000 = 5 reads a paste;
2,000,000 × 10 KB = 20 GB; 0.2 × 2,000,000 × 10 KB = 4 GB; 1% of reads ÷ 20%
missing = 5% of misses; 200 B × 365,000,000 = 73 GB; 62⁷ = 3,521,614,606,208,
which at 365,000,000 a year is about 9,648 years; 365,000,000 ÷ 62⁷ ≈ 0.0104%,
1 in about 9,648, against 62⁶ ÷ 365,000,000 ≈ 156 for six characters;
365,000,000 keys ÷ 1,000 a list call = 365,000 calls; 120 ÷ (10 ÷ 60) = 720;
100 guesses × 0.0104% ≈ 0.0104 pastes an hour, one every 96 hours). IDs come
from the URL shortener's counter-plus-keyed-encryption scheme, with the
counter in the metadata database and the key on the app servers, and the
guess odds are stated and rate-limited (per IPv4 address or IPv6 /56; a
botnet's 100 finds an hour from 10,000 addresses and 62⁸ ÷ 365,000,000 ≈
598,000 are stated, and the design says why it keeps seven characters). Retention is one rule (every paste
expires within 365 days) that the check on read and the daily sweep enforce,
with a 366-day lifecycle rule as the backstop for orphans; the sweep deletes
the object before the row, so a failure leaves an expired row the next run
finds again; expiry is checked on cache hits as well as misses; the cache is
capped at 4 GB with LRU eviction; the API says when `410` gives way to `404`;
the latency target is checked against the miss path; the failure modes cover
the cache, the database, the cleanup job and the object store; both deep
dives compare two options with their costs; and the diagram shows exactly the
components the prose names (the counter is a row in the metadata database and
the lifecycle rule a setting of the object store, not components); and the
`At a glance` section has the four lead-ins in order, every figure in it
matches the body, and every in-page link resolves to a heading id.
**Expected finding:** no finding that is false of the draft. Real gaps, such
as its thinness next to the reference case study or a missing sequence
diagram, are acceptable and go in the run's notes.
**Fails if:** the review reports a defect that isn't true of the draft: an
arithmetic "error" in a correct line, a deep dive called one-sided when it
compares two options, a diagram/prose mismatch that isn't there, or a correct
technical statement called wrong.

---

## DSA scenarios (`add-dsa-entry`)

These test `add-dsa-entry`'s Stage 3 review. Like the case-study scenarios, they
share one fabricated base: a short Prefix Sums entry (a pattern) and its four
code files, written to the template in `docs/dsa.md`. Build a scenario's
files by taking the base and applying that scenario's replacements verbatim,
then give the reviewer the entry and all four code files, exactly as
`add-dsa-entry` Stage 3 would. These are fixtures for this eval only: never
write them into `src/dsa/`. The base code and tests were run as written (4
pytest and 3 vitest tests pass, and Prettier accepts the `.ts` files).

There's no **Section**: give the reviewer the titles and slugs of the real
entries in `src/dsa/entries/` for its near-duplicate check, as the skill does.

### Base entry (the DS-03 control, verbatim)

`src/dsa/entries/prefix-sums.md`:

````markdown
---
title: Prefix Sums
summary: Precompute running totals once, and the sum of any stretch of an array becomes one subtraction.
date: 2026-10-01
kind: pattern
---

## Prerequisites

None. This assumes you know what an array is and that its positions are
numbered from 0.

## The idea

Suppose you have an array of numbers and need the sum of many different
stretches of it: positions 1 through 3, then 0 through 4, then 2 through 2.
Adding each stretch up from scratch costs one step per element in it, so a
thousand questions about a long array repeat a lot of the same additions.

A **prefix sum** is the total of an array's first few elements. Build a second
array, `prefix`, where `prefix[i]` is the sum of the first `i` elements, so
`prefix[0]` is 0 (nothing added yet). For `nums = [3, 1, 4, 1, 5]`:

| i         | 0   | 1   | 2   | 3   | 4   | 5   |
| --------- | --- | --- | --- | --- | --- | --- |
| prefix[i] | 0   | 3   | 4   | 8   | 9   | 14  |

The sum of positions 1 through 3 is everything up to and including position 3,
minus everything before position 1: `prefix[4] - prefix[1] = 9 - 3 = 6`, which
is 1 + 4 + 1.

## When to use it

Use it when the array doesn't change and you need many range sums from it. If
the array changes between questions, every running total after the changed
position goes stale, and a different structure, one built to handle updates,
fits better. The same trick works for anything you can undo by subtraction,
such as counts. It doesn't work for the largest value in a range, because a
maximum can't be subtracted away.

## Walkthrough

```python
def build_prefix(nums: list[int]) -> list[int]:
    prefix = [0] * (len(nums) + 1)
```

```typescript
export function buildPrefix(nums: number[]): number[] {
  const prefix = new Array<number>(nums.length + 1).fill(0);
```

The array is one longer than the input. The extra slot at the front,
`prefix[0] = 0`, stands for "the sum of no elements". Without it, a range that
starts at position 0 would need its own special case, since there would be
nothing before it to subtract.

```python
    for i, value in enumerate(nums):
        prefix[i + 1] = prefix[i] + value
    return prefix
```

```typescript
  for (let i = 0; i < nums.length; i++) {
    prefix[i + 1] = prefix[i] + nums[i];
  }
  return prefix;
}
```

Each total is the previous total plus one element, so one pass builds the whole
array instead of re-adding from the start for every slot. The write goes to
`i + 1` because element `i` is the `(i + 1)`th element, so it belongs in the
total of the first `i + 1` elements. Writing `prefix[i] = prefix[i] + value`
instead would read the slot it's about to fill, which is still 0, so each slot
would hold a single element rather than a running total. (In Python,
`list(itertools.accumulate(nums, initial=0))` builds the same list in one
call; the loop is spelled out here to show the step it repeats.)

```python
def range_sum(prefix: list[int], left: int, right: int) -> int:
    return prefix[right + 1] - prefix[left]
```

```typescript
export function rangeSum(prefix: number[], left: number, right: number): number {
  return prefix[right + 1] - prefix[left];
}
```

Both `left` and `right` are inside the range. `prefix[right + 1]` is the sum of
everything up to and including position `right`, and `prefix[left]` is the sum
of everything before position `left`, so their difference is exactly the
range. Using `prefix[right]` would leave out the element at `right`: for the
example, `prefix[3] - prefix[1]` is 5, missing the 1 at position 3.

## Complexity

Big-O notation describes how a cost grows with the size of the input, n.
Building `prefix` takes O(n) time, one addition per element, and O(n) extra
space for the n + 1 totals. Each range sum is then O(1): two array reads and a
subtraction, however long the range. Answering q questions costs O(n + q) in
total, against O(n × q) in the worst case when every range is added up from
scratch.

## Pitfalls

- **Off by one at the right end.** The range includes `right`, so the formula
  reads `prefix[right + 1]`. Mixing that up with a range that stops just before
  `right` is the most common bug; pick one convention and keep it.
- **Overflow with fixed-width integers.** Python's integers grow as needed, and
  the TypeScript version's numbers are 64-bit floating point, exact for every
  integer up to 2⁵³ in size; past that, totals silently round instead of
  overflowing. In a language with 32-bit integers, the totals of a long array
  of large values can overflow even when every element fits.
````

`src/dsa/code/prefix-sums/prefix_sums.py`:

```python
def build_prefix(nums: list[int]) -> list[int]:
    prefix = [0] * (len(nums) + 1)
    for i, value in enumerate(nums):
        prefix[i + 1] = prefix[i] + value
    return prefix


def range_sum(prefix: list[int], left: int, right: int) -> int:
    return prefix[right + 1] - prefix[left]
```

`src/dsa/code/prefix-sums/test_prefix_sums.py`:

```python
import random

from prefix_sums import build_prefix, range_sum


def test_empty_input_has_one_zero():
    assert build_prefix([]) == [0]


def test_worked_example():
    prefix = build_prefix([3, 1, 4, 1, 5])
    assert prefix == [0, 3, 4, 8, 9, 14]
    assert range_sum(prefix, 1, 3) == 6


def test_single_elements_and_the_whole_array():
    nums = [3, 1, 4, 1, 5]
    prefix = build_prefix(nums)
    for i, value in enumerate(nums):
        assert range_sum(prefix, i, i) == value
    assert range_sum(prefix, 0, len(nums) - 1) == sum(nums)


def test_matches_brute_force_on_random_ranges():
    rng = random.Random(7)
    for _ in range(500):
        nums = [rng.randint(-50, 50) for _ in range(rng.randint(1, 30))]
        prefix = build_prefix(nums)
        left = rng.randrange(len(nums))
        right = rng.randrange(left, len(nums))
        assert range_sum(prefix, left, right) == sum(nums[left : right + 1])
```

`src/dsa/code/prefix-sums/prefix-sums.ts`:

```typescript
export function buildPrefix(nums: number[]): number[] {
  const prefix = new Array<number>(nums.length + 1).fill(0);
  for (let i = 0; i < nums.length; i++) {
    prefix[i + 1] = prefix[i] + nums[i];
  }
  return prefix;
}

export function rangeSum(prefix: number[], left: number, right: number): number {
  return prefix[right + 1] - prefix[left];
}
```

`src/dsa/code/prefix-sums/prefix-sums.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildPrefix, rangeSum } from './prefix-sums';

describe('prefix sums', () => {
  it('gives an empty input one zero', () => {
    expect(buildPrefix([])).toEqual([0]);
  });

  it('matches the worked example', () => {
    const prefix = buildPrefix([3, 1, 4, 1, 5]);
    expect(prefix).toEqual([0, 3, 4, 8, 9, 14]);
    expect(rangeSum(prefix, 1, 3)).toBe(6);
  });

  it('matches a brute-force sum on random ranges', () => {
    let seed = 7;
    const next = (n: number) => {
      seed = (seed * 48271) % 2147483647;
      return seed % n;
    };
    for (let round = 0; round < 500; round++) {
      const nums = Array.from({ length: 1 + next(30) }, () => next(101) - 50);
      const prefix = buildPrefix(nums);
      const left = next(nums.length);
      const right = left + next(nums.length - left);
      const expected = nums.slice(left, right + 1).reduce((a, b) => a + b, 0);
      expect(rangeSum(prefix, left, right)).toBe(expected);
    }
  });
});
```

---

### DS-01 — a TypeScript bug the tests don't reach (trap for "the code is correct" and "the tests reach the edge cases")

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation (the only one):** the TypeScript loop stops one element
early, so `prefix[n]` stays 0 and every range that ends at the last element is
wrong (`rangeSum(buildPrefix([3, 1, 4, 1, 5]), 0, 4)` returns 0, not 14). The
weakened TypeScript test still passes, since `rangeSum(prefix, 1, 3)` is 6 with
or without the bug. The Python code and tests are unchanged and correct.
**Replacements in the base:** in both `prefix-sums.ts` and the entry's second
typescript fence, replace `for (let i = 0; i < nums.length; i++) {` with:

```typescript
  for (let i = 0; i < nums.length - 1; i++) {
```

and replace `prefix-sums.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import { buildPrefix, rangeSum } from './prefix-sums';

describe('prefix sums', () => {
  it('gives an empty input one zero', () => {
    expect(buildPrefix([])).toEqual([0]);
  });

  it('sums the middle of the worked example', () => {
    expect(rangeSum(buildPrefix([3, 1, 4, 1, 5]), 1, 3)).toBe(6);
  });
});
```

**Expected finding:** flags the TypeScript loop bound: the last element is
never added, so `prefix` ends in 0 and any range ending at the last position is
wrong, unlike the Python version; and notes that the TypeScript tests never
check a range that reaches the end (or the whole `prefix` array, or random
ranges), which is why they pass.
**Fails if:** the review doesn't flag the loop bound, or flags only the thin
tests without finding the bug they miss.

---

### DS-02 — a walkthrough paragraph that narrates (trap for "explains why, not what")

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation (the only one):** the paragraph after the third pair says
what `range_sum` does, line by line, but never why it reads `prefix[right + 1]`
rather than `prefix[right]`, or what the subtraction removes. The Pitfalls
section still names the off-by-one, so the entry as a whole isn't wrong; this
paragraph just doesn't do a walkthrough paragraph's job.
**Replacement in the base:** replace the paragraph that starts "Both `left`
and `right` are inside the range." with:

```markdown
This function takes the prefix array and the two positions. It looks up the
value at `right + 1` and the value at `left`, subtracts the second from the
first, and returns the result, which is the sum of the range.
```

**Expected finding:** flags this paragraph as narration that restates the
code without explaining why it's written that way (why `right + 1`, what
`prefix[left]` subtracts, what goes wrong with `prefix[right]`), against the
checklist's "explains why its lines are written that way, not only what they
do."
**Fails if:** the review doesn't flag the paragraph, or flags only the other
walkthrough paragraphs.

---

### DS-03 — clean entry (false-positive control)

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation:** none. The base, verbatim. The code is correct in both
languages and every line of each file appears once in the walkthrough, in
order. The worked example holds (prefix `[0, 3, 4, 8, 9, 14]`;
`prefix[4] - prefix[1] = 6`; `prefix[3] - prefix[1] = 5`, missing the 1 at
position 3), the tests cover empty input, single elements, the whole array and
500 random ranges against a brute-force sum, the complexity claims hold, 2⁵³
is the limit of exact integers in a 64-bit float (larger ones round), and
`itertools.accumulate` takes `initial=` from Python 3.8.
**Expected finding:** no finding that is false of the entry. Real gaps, such
as its brevity next to the reference entries or no TypeScript test for single
elements, are acceptable and go in the run's notes.
**Fails if:** the review reports a defect that isn't true of the entry: a
"bug" in correct code, a wrong figure that's right, a narrating paragraph that
does explain why, or a correct technical statement called wrong.
