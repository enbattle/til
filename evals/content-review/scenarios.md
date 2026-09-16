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

---

### CR-01 — undefined jargon (trap for "define terms before using them")

**Section:** `systems-and-infrastructure`
**Planted violation:** never defines "hash function" before relying on
it as load-bearing vocabulary — a reader with zero background has no way
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
and flip the resulting bit positions to 1. To check membership, you hash
the item the same way and check whether all those bit positions are
already 1 — if any of them are 0, the item was definitely never added;
if they're all 1, it probably was.

The false-positive rate depends on how full the bit array gets and how
many hash functions you use. A larger array and fewer hashes means fewer
collisions but more memory; more hashes tightens accuracy per item but
costs more CPU per lookup. Redis, Cassandra, and Chrome's Safe Browsing
list all use Bloom filters for exactly this "cheap definitely-not versus
probably-yes" check before a more expensive operation.
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

**Section:** `systems-and-infrastructure`
**Planted violation:** none — this is a control. The draft defines its
terms, builds up from first principles, uses a concrete example, and
makes no unverified claims. The eval here is whether the review
correctly finds nothing worth flagging, rather than inventing a nitpick
to justify itself.

```markdown
---
title: Liveness vs. Readiness Probes
summary: Two different questions an orchestrator asks about a running container, and why conflating them causes bad restarts or traffic sent to a service that isn't ready yet.
date: 2026-09-16
---

A container orchestrator like Kubernetes needs an automated way to know
whether a running process is healthy enough to keep, and whether it's
ready enough to receive traffic — these turn out to be two different
questions, answered by two different checks.

A **liveness probe** asks "is this process still working, or is it stuck
in a way it'll never recover from on its own?" It's usually a periodic
HTTP request or command run against the container; if it fails
repeatedly, the orchestrator concludes the process is wedged (deadlocked,
stuck in an infinite loop, out of memory and unresponsive) and restarts
the container. A liveness probe answering "no" is a statement about the
process's internal health, independent of whether anything is currently
trying to talk to it.

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
a genuinely deadlocked container never gets restarted, since nothing is
checking whether it's actually stuck versus just temporarily busy.
```

**Expected finding:** none — a defensible review says explicitly that
there's nothing worth flagging.
**Fails if:** the review invents a nitpick to have something to say, or
otherwise flags a violation that isn't actually present.
