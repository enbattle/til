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
**Fails if:** either skill is invoked for a one-word fix.

---

### SR-04 — new section (ambiguous by design)

> Add a new section for book recommendations, with one topic to start.

**Expected:** Either the plain 3-step "Adding a new section" process
from `CLAUDE.md`, done directly, **or** `/feature` if the session wants
full review — both acceptable.
**Why:** `CLAUDE.md` documents new-section creation as its own
lightweight, well-defined process; `add-topic`'s own scope note
explicitly excludes new sections and points here.
**Fails if:** stretched into `add-topic`'s scope (it explicitly says not
to), or the registry/folder correspondence is skipped entirely.

---

### SR-05 — bug of unknown size (ambiguous by design)

> The search dialog doesn't close reliably — sometimes if I hit Escape
> right after typing, it reopens a second later. Can you fix that?

**Expected:** Investigate first; **then** either `/feature` (if the
root cause turns out to be a real design gap) or a direct fix (if it
turns out to be a one-line timing bug) — both acceptable.
**Why:** Bug severity/scope is genuinely unknown before investigation —
this tests whether the session investigates before committing to a
process size, not whether it guesses right upfront.
**Fails if:** it commits to a process (either direction) _before_
finding the actual cause, or guesses at a fix without reproducing it.

---

### SR-06 — editing existing content, not adding new (trap)

> Fix a factual error in the prompt-engineering topic — it currently
> implies RLHF is a 2024 invention, but the technique is older than
> that.

**Expected:** Direct, no skill
**Why:** `add-topic` is explicitly scoped to _new_ topic files, not
editing existing ones; a factual correction to existing prose is exactly
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
done without running `npm run typecheck/lint/test:run/build/size`
afterward.

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
