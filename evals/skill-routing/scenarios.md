# Skill-routing scenarios

Each scenario is a task description phrased exactly as a user might type
it. Give it, verbatim, to a fresh session with no other context. Record
what it actually does — which skill it invokes, if any, before starting
work — and compare against **Expected**. See `HOW_TO_RUN.md` for the
procedure and `../README.md` for grading philosophy (some of these are
ambiguous by design).

---

### SR-01 — new interactive feature

> Add pagination to the search results in the search dialog so it
> doesn't show more than 8 at once without a way to see more.

**Expected:** `/feature`
**Why:** New interactive behavior with real design choices (load-more
vs. numbered pages, keyboard behavior, what happens to the currently
active/focused result) and accessibility implications — squarely
"new functionality" / "multiple valid approaches" per `CLAUDE.md`.
**Fails if:** implemented directly with no spec, or routed to `add-topic`
(wrong domain entirely).

---

### SR-02 — new topic, existing section

> Add a topic to the ai-and-ml section about how vector embeddings work.

**Expected:** `add-topic`
**Why:** Exactly `add-topic`'s stated scope — a new topic markdown file
in an existing section, no app code involved.
**Fails if:** routed to `/feature` (unnecessary TDD ceremony for pure
content), or done directly with no independent review pass.

---

### SR-03 — trivial fix

> There's a typo in the README — it says "wich" instead of "which". Fix
> it.

**Expected:** Direct, no skill
**Why:** `CLAUDE.md`'s own named example of what to skip the pipeline
for.
**Fails if:** any skill is invoked for a one-word fix.

---

### SR-04 — new section (ambiguous by design)

> Add a new section for book recommendations, with one topic to start.

**Expected:** Either the plain 3-step "Adding a new section" process
from `docs/content.md`, done directly, **or** `/feature` if the session wants
full review — both acceptable.
**Why:** `docs/content.md` documents new-section creation as its own
lightweight, well-defined process; `add-topic`'s own scope note
explicitly excludes new sections and points here.
**Fails if:** stretched into `add-topic`'s scope (it explicitly says not
to), or the registry/folder correspondence is skipped entirely.

---

### SR-05 — bug of unknown size

> The search dialog doesn't close reliably — sometimes if I hit Escape
> right after typing, it reopens a second later. Can you fix that?

**Expected:** "Triage first": reproduce the bug and find its cause
before choosing a process, then route by what is found (a localized fix is
direct with a regression test; a cause that spans modules or needs a
behavior decision goes to `/feature`), as `feature/SKILL.md` Stage 0 says.
The eval forbids implementing and asks for a routing answer, so "triage
first, and here is what decides the route afterwards" **is** the passing
answer.
**Why:** Bug size is unknown before investigation. This tests whether the
session knows to triage before sizing the process, not whether it guesses
the size right.
**Fails if:** it names `/feature` or a direct fix as its route without
making that conditional on what triage finds, or proposes a fix without
reproducing the bug. (Before 2026-09-24 this scenario had no written triage
rule to follow, and four runs in a row landed as near-misses on both sides;
the rule was added to Stage 0 in response.)

---

### SR-06 — editing existing content, not adding new (trap)

> In the caching topic, the eviction-policy paragraph ends "Redis lets you
> choose among these" without saying how. Add a few words noting it's the
> `maxmemory-policy` setting (for example `allkeys-lru` or `allkeys-lfu`).

(The prompt used to name a September 2026 state-of-LLMs topic, which was
removed in PR #26. Keep it pointing at prose that exists.)

**Expected:** Direct, no skill
**Why:** `add-topic` is explicitly scoped to _new_ topic files, not
editing existing ones; a small, accurate addition to existing prose is exactly
`CLAUDE.md`'s "small, unambiguous" carve-out.
**Fails if:** routed through `add-topic` (scope creep of a skill beyond
its stated purpose) or `/feature` (no app behavior involved).

---

### SR-07 — new feature, multi-file

> Add a "reading time" estimate (e.g., "5 min read") shown on each
> topic's card on the section/home pages and on the topic page itself.

**Expected:** `/feature`
**Why:** Touches multiple files (`TopicCard.tsx`, `TopicPage.tsx`,
a new shared estimation utility), has a real design decision (words-per-
minute assumption, rounding), and is genuinely new functionality.
**Fails if:** implemented directly with no spec, given the multi-file
surface and the judgment call embedded in the estimate itself.

---

### SR-08 — mechanical maintenance

> Update the npm dependencies in package.json to their latest minor
> versions.

**Expected:** Direct, no skill (but should still run the full
verification suite before considering it done)
**Why:** Routine, well-understood, mechanical operation — not new
functionality, no design choices to spec. Dependabot already automates
this in the ordinary case; this scenario is about a manual invocation of
the same kind of change.
**Fails if:** routed to `/feature` (there's no feature here to spec), or
done without running `npm run verify` afterward.

---

### SR-09 — docs-staleness check

> Can you check if any of the documentation in this repo is out of date
> after all the recent changes?

**Expected:** `docs-audit`
**Why:** Exactly this skill's stated purpose — an independent, fresh-eyes
read of every doc against current repo state.
**Fails if:** routed to `/feature` (no app behavior to spec) or
`add-topic` (not adding a topic), or done as an ad-hoc direct read-through
by the same session with no independent audit pass — that defeats the
skill's actual design premise (see its `SKILL.md`: whoever just made a
change is the worst-positioned person to notice what it left stale).

---

### SR-10 — skill-routing-eval routing

> Can you run the skill-routing eval to make sure everything's still
> working after these changes?

**Expected:** `skill-routing-eval`
**Why:** Exact match for the skill's stated purpose.
**Fails if:** routed to `docs-audit` (a different concern — doc staleness,
not routing correctness) or done as an ad-hoc check that skips the actual
fresh-subagent-per-scenario procedure the skill exists to standardize.

---

### SR-11 — corpus-wide content-quality sweep

> Can you go through all the existing topics in the site and check
> whether any of them read like they were obviously written by AI,
> over-explain their analogies instead of trusting the reader to get
> them, or state technical claims that might actually be wrong? I want
> a sweep across everything we've already published, not just anything
> new.

**Expected:** `content-audit`
**Why:** Exactly this skill's stated purpose — an independent, fresh-eyes
read of every topic under `src/content/**` (and, by default, every System
Design case study under `src/system-design/case-studies/` and every DSA entry
under `src/dsa/entries/`) against the
Writing Standard's AI-patterned-prose, over-explained-figurative-language,
and unverified-technical-claim criteria. It's a full-corpus sweep of
published content, which is a different axis from its neighbors:
`docs-audit` covers meta-documentation (`CLAUDE.md`, `docs/`, `evals/`,
`SKILL.md` files) staleness against current repo state, not the prose
quality of published content; `add-topic` and `add-case-study` each review
exactly one new file as part of writing it, not the entire existing corpus.
**Fails if:** routed to `docs-audit` (wrong scope — meta-docs staleness,
not topic-content quality), routed to `add-topic` (that skill's review
pass covers a single new topic it's writing, not a sweep of everything
already published), or done as an ad-hoc read-through by the same session
with no independent per-batch audit pass — that defeats the same design
premise `docs-audit` already establishes for this repo.

---

### SR-12 — content-review-eval routing

> After changing the wording of add-topic's review instructions, can you
> check that the review still actually catches a planted content
> violation instead of just checking that the routing still works?

**Expected:** `content-review-eval`
**Why:** Exact match for the skill's stated purpose — checking whether
`add-topic`'s Stage 3 review agent actually catches a deliberately
planted problem, a different failure surface from routing correctness.
**Fails if:** routed to `skill-routing-eval` (that checks whether the
right skill gets _chosen_, not whether a chosen skill's review step
actually works), `content-audit` (that's a corpus-wide sweep of already-
published topics, not a check of the review process itself), or done as
an ad-hoc manual check with no spawned fresh reviewer agent and no
planted-violation scenario — that defeats the same "genuinely fresh eyes"
premise every other eval in this repo is built on.

---

### SR-13 — retired

This scenario routed "check that a reader still finds the right System Design
question" to `system-design-navigation-eval`. The question pages, that eval
and its skill were removed by `docs/specs/system-design-case-studies.md`, so
the scenario no longer has a right answer. The ID is kept so past results
under `results/` still line up; don't reuse it.

---

### SR-14 — feature-review-eval routing

> I tightened the reviewer instructions in the /feature pipeline. Can you
> check whether the reviewer still actually catches bugs in a diff, rather
> than just approving everything?

**Expected:** `feature-review-eval`
**Why:** Exact match for the skill's purpose: planted-defect diffs given to
fresh reviewers running Stage 4's current instruction, graded against known
defects and a clean control.
**Fails if:** routed to `content-review-eval` (that checks `add-topic`'s
prose review, not `/feature`'s code review), `skill-routing-eval` (checks
which skill gets picked, not whether a review catches defects), `/feature`
itself, or done as an ad-hoc read of the reviewer prompt by the same session
with no planted defect and no fresh reviewer, which can't show whether the
review catches anything.

---

### SR-15 — new System Design case study

> Write a System Design case study for a collaborative document editor like
> Google Docs, with the usual architecture diagram.

(The prompt used to name a chat app like WhatsApp; that case study now exists
as `messaging.md`, which made the prompt a request to edit an existing one.
Keep the prompt naming a case study that doesn't exist yet.)

**Expected:** `add-case-study`
**Why:** Exactly that skill's scope: a new file under
`src/system-design/case-studies/` plus its D2 diagrams, drafted to the
template, rendered with `npm run diagrams`, then reviewed by a fresh agent
against the Writing Standard and the case-study checklist (estimate
arithmetic, compared options in each deep dive, diagrams matching the prose).
**Fails if:** routed to `add-topic` (a case study isn't a catalog topic, and
that skill's review has none of the case-study checks), routed to `/feature`
(no app code changes, so spec and TDD would be ceremony), or written directly
with no independent review, which skips the check most likely to catch a
wrong estimate or a one-sided deep dive.

---

### SR-16 — improving an existing case study's prose (trap)

> The URL shortener case study reads a bit stiff in places and I'm not sure
> every claim in it holds up. Can you go over it and tighten the writing?

**Expected:** `content-audit` scoped to that one file
**Why:** The case study already exists, and `add-case-study`'s description
says it is not for editing an existing case study's prose quality (that's
`content-audit`). An independent read of one published file against the
Writing Standard, including whether its claims hold, is `content-audit`'s
single-file scope. The prompt names no specific fix and asks for claims to be
checked, so the direct-edit carve-out does not apply.
**Fails if:** rewritten directly in the same session (as SR-11), routed through `add-case-study` (that skill drafts a new file
and its diagrams; it has no path for revising a published one) or `/feature`
(no app behavior involved).

---

### SR-17 — changing the case-study page or diagram tooling (trap)

> On a case study page, make the Contents list stick to the side of the
> screen on wide monitors, and have the diagram render script fail when a
> diagram is wider than the content column.

**Expected:** `/feature`
**Why:** Both halves are app and tooling code (the case-study page component
and `scripts/render-diagrams.mjs`), with behavior that needs acceptance
criteria and tests. `add-case-study`'s description sends changes to the
case-study page, loader or diagram tooling to `/feature`, and its Stage 0
stops if a request needs anything under `src/` outside the case-study and
diagram folders.
**Fails if:** routed to `add-case-study` (the words "case study" and
"diagram" match its trigger, but it writes content, not code), or done as a
direct edit (a layout change plus a new guard is not a one-line fix).

---

### SR-18 — new DSA entry

> Add the heap entry to DSA.

**Expected:** `add-dsa-entry`
**Why:** Exactly that skill's scope: a new file under `src/dsa/entries/` plus
its Python and TypeScript code and tests under `src/dsa/code/heap/`, drafted
to the data-structure template, checked by `npm run verify` (including
`npm run test:py`), then reviewed by a fresh agent against the Writing
Standard and the DSA checklist (code correct and idiomatic in both languages,
tests that reach the edge cases, a walkthrough that explains why).
**Fails if:** routed to `add-topic` (a DSA entry isn't a catalog topic, and
that skill's review never looks at code or tests), routed to `/feature` (no
app code changes, so a spec and locked tests would be ceremony), or written
directly with no independent review of the code and its tests.
