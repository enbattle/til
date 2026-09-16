# Build the `content-review` eval: does `add-topic`'s Stage 3 review actually catch a planted violation?

## Context

`til`'s dev process (`docs/SDLC.md`, `.claude/skills/`) is deliberately
built for an LLM agent's specific failure modes, not just documented for
humans — and `evals/` exists to check that machinery actually works,
not just that it reads well. Today there's exactly one eval category:
`skill-routing`, which checks whether a fresh session routes a task
description to the right skill. `evals/README.md` already names the two
categories it doesn't have yet:

> Future categories worth adding once routing is stable: does the
> `/feature` review stage actually catch known-bad injected bugs; does
> `add-topic`'s review actually catch a planted factual error or Writing
> Standard violation.

The user asked to grow the AI-native dev-process tooling itself (not
content, not a product AI feature), then picked the lighter of these two
as the first one to build: **does `add-topic`'s Stage 3 review agent
actually catch a deliberately planted violation**, rather than rubber-
stamping a draft. Routing-correctness (does the right skill get chosen)
and review-efficacy (does the chosen skill's review step actually work)
are different failure surfaces — this fills the second one.

This mirrors the exact precedent `docs/specs/content-quality-review.md`
set when `content-audit` was added: a new SDLC-tooling change gets a
written spec, a red/green check via spawned agents (not asserted), and a
routing-eval scenario for the new skill it introduces.

## Approach

### 1. New eval category: `evals/content-review/`

Structurally parallel to `evals/skill-routing/` (same three-file shape):

- **`scenarios.md`** — 5 scenarios (`CR-01`..`CR-05`), each a fully
  fabricated draft topic (frontmatter + body, in a fenced block — never
  written to `src/content/` itself, these are fixtures only) with
  exactly one deliberately planted problem, covering both the original
  Writing Standard criteria and the three tone/figurative/correctness
  criteria `content-quality-review` added:
  - `CR-01` — undefined jargon / no first-principles build-up (uses a
    term central to the topic without ever defining it).
  - `CR-02` — AI-patterned tone (a stock "not just X — it's Y" closer,
    filler intensifiers stacked, a bullet list with mechanically
    identical rhythm on every item).
  - `CR-03` — over-explained figurative language (a casual analogy
    followed by a passage defending it against a literal misreading
    nobody would make).
  - `CR-04` — a planted factual/technical inaccuracy that reads
    confidently (review must catch this via independent verification,
    not by trusting the draft).
  - `CR-05` — a clean baseline with **no** planted violation, to check
    the review doesn't hallucinate findings on a fine draft (a false-
    positive control, not just a true-positive check).

  Each scenario states **Planted violation**, **Expected finding**
  (what the review should flag, or "nothing" for CR-05), and **Fails
  if** (misses it entirely, flags the wrong thing, or — for CR-05 —
  invents a nitpick).

- **`HOW_TO_RUN.md`** — the procedure. Critically: the reviewer
  instruction given to each scenario's agent is **copied fresh from
  `.claude/skills/add-topic/SKILL.md`'s actual Stage 3 prompt at run
  time**, never duplicated/hardcoded into this doc — otherwise this eval
  silently drifts from what `add-topic` actually does the next time that
  prompt is edited, which is exactly the staleness class `docs-audit`
  exists to catch. Each run also pulls the section's real current sibling
  topic list (globbed fresh, per the same reasoning `content-audit`
  Stage 1 already uses) and the current `CLAUDE.md` Writing Standard
  text, not a pasted snapshot. Defines this category's own PASS / FAIL /
  AMBIGUOUS grading (did the review's actual finding text substantively
  name the planted issue — not just coincidentally flag something).

- **`results/<date>.md`** — first real run's dated log, same
  never-overwrite-a-prior-day convention as `skill-routing/results/`.

### 2. New skill: `.claude/skills/content-review-eval/SKILL.md`

Structurally parallel to `skill-routing-eval/SKILL.md` (Stage 0 scope →
Stage 1 spawn a fresh `general-purpose` agent per scenario, never `fork`
→ Stage 2 grade and log → Stage 3 add a scenario first if triggered by a
new violation category or a new content-reviewing skill → Stage 4
report). Same reasoning as the sibling skill: a procedure sitting only in
`HOW_TO_RUN.md` is easy to forget exists; wrapping it as an invokable
skill gives it the same discoverability `skill-routing-eval` already has.

### 3. Wire it into the existing docs

- `evals/README.md` — add a `content-review` bullet under "What's here"
  (parallel to the existing `skill-routing` bullet), and trim "Future
  categories worth adding" down to just the remaining one (`/feature`
  catching an injected bug).
- `docs/SDLC.md` — its "Verifying the process itself" paragraph currently
  describes `evals/` as only checking routing ("does a fresh session
  route it to `/feature`, `add-topic`, or `docs-audit`"). Reword slightly
  so it describes both eval categories in general terms (routing
  correctness, and now review efficacy) rather than leaving that
  paragraph inaccurate the moment this ships — this is the exact kind of
  drift `docs-audit`/the `nudge-precommit` hook exist to catch, so fix it
  now rather than leave it for a later audit to find.
- `evals/skill-routing/scenarios.md` — add `SR-12`, a routing scenario
  for the new `content-review-eval` skill, same format as `SR-10`
  (skill-routing-eval) and `SR-11` (content-audit).

### 4. Actually run both evals for real (not asserted)

- Spawn 5 fresh `general-purpose` agents in parallel (never `fork`), one
  per `CR-0x` scenario, each given exactly what `add-topic` Stage 3 gives
  a real reviewer — grade and log to
  `evals/content-review/results/2026-09-16.md`.
- Spawn a fresh `general-purpose` agent for `SR-12` (plus its two most
  likely collision neighbors, `SR-10` and `SR-11`, as a regression check
  — same pattern `content-quality-review`'s own routing check used),
  grade and log to a new entry in `evals/skill-routing/results/`.

### 5. Save the spec

After approval, save this plan as `docs/specs/content-review-eval.md`
(this repo's durable spec record, per `docs/SDLC.md`'s Stage 1) — with
real results filled in, not left as a forward-looking plan.

## Explicitly out of scope

- Not building the other flagged category (`/feature`'s review catching
  an injected bug) — that's a separate, heavier follow-up.
- No new hook — this is manual/periodic like its sibling evals.
- No change to `add-topic/SKILL.md` itself unless a `CR-0x` run reveals
  its Stage 3 prompt is actually failing to catch something real (in
  which case that's a finding to report, not silently patch mid-plan).

## Files touched

- `evals/content-review/scenarios.md` (new)
- `evals/content-review/HOW_TO_RUN.md` (new)
- `evals/content-review/results/2026-09-16.md` (new)
- `.claude/skills/content-review-eval/SKILL.md` (new)
- `evals/README.md` (edit)
- `docs/SDLC.md` (edit)
- `evals/skill-routing/scenarios.md` (edit — new `SR-12`)
- `evals/skill-routing/results/2026-09-16.md` (new — logs `SR-12` +
  regression check)
- `.claude/skills/skill-routing-eval/SKILL.md` (edit — unplanned; see
  Results)
- `evals/skill-routing/HOW_TO_RUN.md` (edit — unplanned; see Results)
- `docs/specs/content-review-eval.md` (new, saved after approval)

No user-facing UI surface, no `src/` code touched — this is entirely
`.claude/`, `evals/`, and `docs/` tooling.

## Verification

```bash
npm run format:check
```

(the same content-only gate `docs-audit`/`content-audit` use), plus the
real spawned-agent runs for both `CR-0x` and `SR-12`/regression scenarios
described above — never asserted from reading the skill file and
assuming it would work.

## Results

All work above was completed and both evals were actually run (real
spawned agents, not asserted). Full logs:
[`evals/content-review/results/2026-09-16.md`](../../evals/content-review/results/2026-09-16.md),
[`evals/skill-routing/results/2026-09-16.md`](../../evals/skill-routing/results/2026-09-16.md).

**Content-review: 4/5 clean PASS, 1 AMBIGUOUS.** `CR-01` through `CR-04`
each had their planted violation caught explicitly and correctly
categorized by a fresh reviewer agent given `add-topic`'s real Stage 3
instruction. `CR-01` in particular went further than the plant itself —
the reviewer independently web-searched and found two factual claims in
the fixture (about Redis and Chrome Safe Browsing using Bloom filters)
that were wrong but hadn't been deliberately planted; they were errors I
introduced by accident while writing the fixture without verifying them
myself. That's a stronger signal than the eval was designed to produce:
it shows the review does genuine independent verification, not
keyword-matching against a known tell list.

`CR-05` (the false-positive control, intended to draw zero findings) came
back AMBIGUOUS rather than a clean PASS or FAIL: the reviewer found real,
defensible gaps (no concrete/numeric example; "container",
"orchestrator", and "Kubernetes" used without a defining clause) rather
than hallucinating a nitpick. This is a genuine scenario-design finding,
not a review-process failure — the "clean" draft wasn't actually clean
against the full letter of the Writing Standard, which the second set of
eyes caught the same way it's supposed to catch a real draft's gaps. Per
`HOW_TO_RUN.md`'s own AMBIGUOUS category, this is logged rather than
forced to a grade; the results log recommends either hardening `CR-05`
further or redefining its Expected finding as "no violation of the four
planted categories, cosmetic gaps aside" rather than a literal
zero-findings bar.

**Skill-routing regression: 3/3 PASS.** `SR-12` (new) and the two
adjacent scenarios most likely to collide with it (`SR-10`,
`skill-routing-eval`; `SR-11`, `content-audit`) all resolved correctly —
adding `content-review-eval` didn't create routing ambiguity for either
neighbor.

**One unplanned fix, made in-scope because it directly affected the
scenarios being run:** while copying `skill-routing-eval/SKILL.md`'s
Stage 1 instruction verbatim (as `SR-12`'s regression check required),
it turned out that instruction's own enumerated skill list — and
`evals/skill-routing/HOW_TO_RUN.md`'s summary of it — had never included
`skill-routing-eval` itself, even though `SR-10`'s expected answer
already is `skill-routing-eval`. A real, pre-existing staleness bug,
not introduced by this change. Fixed both to list the current six
options (`/feature`, `add-topic`, `docs-audit`, `content-audit`,
`skill-routing-eval`, `content-review-eval`) rather than leaving it
stale while adding a seventh gap on top of it.
