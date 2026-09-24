---
name: feature
description: Run this repo's full spec-to-ship pipeline for a new feature or change — spec, TDD tests, implementation, independent adversarial review (code + UI), and docs — with role separation enforced only where independence actually prevents a specific bias, not for every named step. Use when the user asks to add, build, or ship a feature (or a batch of related ones) in this repo.
---

# Feature pipeline

The full process is documented for humans in [docs/SDLC.md](../../../docs/SDLC.md) —
read that once for the rationale, including _why_ only three stages run as
separate agents rather than one per named step. This file is the
operational runbook: follow it stage by stage, in order, for whatever
feature or change the user just asked for (their request is this skill's
argument).

**Non-negotiable rules, enforced at every stage below, not just described:**

1. The agent that writes tests never implements. The agent that implements
   never edits a test file. The agent that reviews never writes code. Each
   is a **separate, fresh** `Agent` call — never a `fork` — so no stage
   inherits another stage's reasoning or bias.
2. After the test-writing stage and after the implementation stage, you
   (the orchestrator) verify the rule held by running the gate checks
   yourself (`git status`, the test-lock check) — not by trusting the
   subagent's self-report.
3. Never commit or push without the user's explicit go-ahead, per this
   session's standing git rules — this pipeline ends at "ready to commit,"
   not at "committed."

Only **three** stages below run as separate fresh agents (test-writer,
implementer, reviewer; a fixer in Stage 4a and a process-edit reader in
Stage 6 are single-purpose extras that run only when needed) — spec-writing stays with you (the orchestrator,
collaborating with the user) and documentation stays with the implementer.
Neither of those needs blind independence: a spec is validated by the
user's own approval, not by another agent's guess at what the user wants,
and docs describing a change are normally written by whoever made it. Don't
add a fourth or fifth worker agent for those without a specific,
articulable bias it would prevent — see docs/SDLC.md for the reasoning.

## Stage 0 — Scope the request

Read the user's request. If it's small and unambiguous (a copy tweak, a
one-line bug fix, a config change), say so and just do it directly —
this pipeline is for real features, not everything. Otherwise, continue.

Track your progress through the stages below explicitly in your replies
("Stage 2 of 6: writing tests") so the user can see where things stand
without reading tool output.

## Stage 1 — Spec

Use `EnterPlanMode`. Explore the relevant code yourself (don't skip this —
a spec written without reading the code invites a mismatched
implementation later). Use `AskUserQuestion` for any genuine judgment call
— an ambiguous requirement, a choice between reasonable approaches — the
same way you would outside this pipeline.

The plan you write must include, explicitly:

- **Acceptance criteria as concrete, testable behaviors** — not "search
  should work better," but "typing a query that matches a topic's summary
  but not its title still returns that topic." These become the test
  cases in Stage 2, so vague criteria here means a vague test suite later.
- Scope: what's in, what's explicitly out.
- Files/modules touched.
- Whether this change has a user-facing UI surface (decides whether
  Stage 4 includes a browser check).
- A check against [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md):
  if the request needs to break a line there, say so in the plan and let the
  user amend that file or change the request. Don't plan around it quietly.

`ExitPlanMode` for approval as usual — the user's approval here _is_ the
independent check on the spec; nothing else validates "is this actually
what I want" better than the person who wants it. **Once approved**, save
the final spec as its own file at `docs/specs/<slug>.md` (kebab-case, e.g.
`docs/specs/topic-tags.md`) — not just the ephemeral plan-mode file. This
is the shared, durable contract Stages 2–4 are each independently given;
none of them see your exploration or your reasoning, only this document.

## Stage 2 — Tests first (red)

Spawn a **fresh** `general-purpose` agent (`subagent_type: "general-purpose"`,
never `fork`). Give it, in full: the spec file's content, the paths of 2–3
existing test files to match style/conventions (e.g.
`src/lib/content.test.ts`, `src/components/MarkdownRenderer.test.tsx`), and
this instruction, close to verbatim:

> Write tests covering every acceptance criterion in the spec above. Only
> create or edit `*.test.ts` / `*.test.tsx` files (and test fixture content
> under `src/content/` or `src/system-design/` only if the spec requires new
> seed content to test against). Do not write or modify any implementation file. Run the suite
> yourself when done and confirm the new tests fail — report exactly which
> tests are red and why (missing implementation, not a typo in the test).

This has to be a separate agent, not just a separate turn in your own
context: even across two turns of the same session, you'd still be
holding the implementation you're about to build in mind while writing
"tests first," which quietly shapes the tests to fit it — defeating the
actual point of writing them first. A genuinely fresh agent is the only
way to enforce that.

**Verification gate** (you run this, don't trust the report):

```bash
git status --porcelain          # every changed path should be a test file (or content fixture)
npm run test:run                # the new tests must actually fail
```

If a non-test implementation file changed, or the new tests pass
immediately (meaning they're not testing anything new), stop and re-run
this stage with a corrected instruction rather than proceeding.

Once the gate passes, lock the tests:

```bash
npm run check:test-lock -- --snapshot
```

This records a hash of every test file (tracked or not) inside `.git/`, and
the Stage 3 and 4a gates compare against it. Re-take it whenever a fresh
test-writer changes the tests; nothing else may.

## Stage 3 — Implementation (green) + docs

Spawn another **fresh** `general-purpose` agent. Give it the spec file and
the specific failing test file(s) from Stage 2 (their paths and content —
it should treat them as ground truth, not something to question lightly).
Instruction, close to verbatim:

> Implement the spec above so the failing tests listed pass. Do not edit
> any `*.test.ts` / `*.test.tsx` file for any reason. If a test looks wrong
> or the spec is ambiguous in a way that blocks you, stop and report the
> discrepancy instead of changing the test to fit your implementation.
> Update any doc this change makes stale (`CLAUDE.md`, `README.md`, `docs/`,
> `.claude/skills/`, `evals/`) if it adds or changes a convention future
> work should follow — most changes
> won't need every file touched, update only what actually changed.
> Run `npm run verify` (the whole chain in CLAUDE.md's "Verifying a
> change") yourself before reporting done.

Docs stay with this agent rather than a separate one: whoever built the
feature is well-positioned to describe it, and there's no bias to protect
against here the way there is for review — docs aren't a correctness
check.

**Verification gate:**

```bash
npm run check:test-lock -- --verify   # MUST pass — any changed, deleted or added test file is a hard stop
npm run verify
```

Don't use `git diff` for this check: it never shows untracked files, which is
what the Stage 2 tests usually are, and a `git add` hides an edit from it.

A changed test file here is the one rule this whole pipeline exists to
catch — if it's non-empty, stop immediately and surface it to the user
rather than deciding yourself whether the edit was reasonable. That is a
different case from the implementer _reporting_ that a test looks wrong: don't
fix the test yourself either. Send the failure to a fresh test-writer (Stage
2's instruction, plus the failure), re-take the snapshot after its gate, and
re-run this gate.

Two more things to do here, both because the implementer's report is the
only place they'd otherwise surface:

- **Keep the spec truthful.** If the implementer's report shows it did
  something other than the spec says (a different mechanism, a changed
  signature, a behavior the tests forced), add an `## As built` section to
  the spec file listing each deviation and why. Leave the original text as it
  was; the spec is a record of what was decided, and a reader should see both
  what was planned and what shipped.
- **See any new guard fail.** If the change adds a check that exists to catch
  a regression (a script under `scripts/`, a CI step, a size or bundle
  assertion), a passing run proves nothing about it. Copy the repo outside
  the working tree (`git worktree add` or `cp -R` into the scratchpad), plant
  the regression the guard claims to catch there, and confirm it exits
  non-zero. A guard that only ever passed hasn't been tested.

## Stage 4 — Adversarial review (code + UI)

**Do not use `/code-review` here** — invoking it via the `Skill` tool
forks from the calling session, which means it inherits that session's
full context, including the implementer's own framing of why the code is
fine. A forked reviewer is not an independent one; that would quietly
defeat the entire point of this stage. (`/code-review` is still fine for
you or the user to run ad hoc, standalone, outside this pipeline.)

Instead, spawn a **fresh** `general-purpose` agent (never `fork`). Give it
only: the spec file's path/content, the path of
[docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md), and the full
diff, produced with

```bash
git add -N .        # intent-to-add: makes new, untracked files show up in the diff
git diff HEAD
```

(plain `git diff HEAD` silently leaves out every new file, so the reviewer
would never see them) — not your own exploration, not either prior
subagent's report, not any framing of your own about the implementation's
quality.
Instruction, close to verbatim:

> Review the diff below against the spec above, adversarially — assume
> nothing in it is correct until you've checked it yourself. Read
> docs/NON_NEGOTIABLES.md first: a violation of any line there is at least a
> high-severity finding, whatever the spec says. Look for
> correctness bugs, missed edge cases from the spec's acceptance criteria,
> accessibility issues, and security issues. If this change has a
> user-facing UI surface, also start the dev server and actually drive it
> in a browser — click through the real flow, not just the happy path,
> check both themes and a mobile-width viewport, check the console for
> errors, and hold it to docs/DESIGN.md's accessibility checklist. Resizing
> the browser window may not change the page's viewport, so confirm
> `innerWidth` after resizing, or load the page in a 375px-wide same-origin
> iframe and compare `document.documentElement.scrollWidth` to it. Check the
> page with the widest content (tables, long code lines) for each kind of
> page the change renders, not only the page the diff names, since a change
> to a shared wrapper affects all of them. If the change adds a check or guard
> script, try at least one other way of regressing what it guards that it
> might miss, in a copy of the repo outside the working tree. For every
> finding, say whether this diff introduced it or it was already there. If this
> change adds or edits topic content (a file under `src/content/` or
> `src/system-design/`), also
> hold the prose itself to CLAUDE.md's Writing Standard section — terms
> defined before use, built from first principles rather than an assumed
> mental model, concrete examples over abstract description, and written
> so a reader with zero prior background on the subject actually follows
> it, not just someone who already knows the topic. Also check whether
> this diff makes any documentation elsewhere in the repo (CLAUDE.md,
> README.md, docs/**, other SKILL.md files) inaccurate or incomplete —
> a convention this change establishes that isn't written down anywhere,
> a fact (a command, a file list, a section name) that a doc now states
> incorrectly. The implementer was already asked to update docs as part
> of Stage 3; verify that independently rather than trusting it was done
> correctly, the same way you verify the code itself. Do not write or
> edit any code in the working tree — review only. Report findings ranked by severity, or say
> explicitly that you found nothing worth flagging.

UI verification lives here rather than as its own stage: it exists for
the same reason as code review (fresh eyes catching what the implementer's
own bias missed), so splitting it into a fourth agent would add cost
without adding any independence that isn't already provided by this stage
being separate from Stage 3.

- No findings, or only cosmetic/low-severity ones the user would clearly
  wave through → go to Stage 5.
- Real (CONFIRMED or credible PLAUSIBLE) findings the diff introduced →
  **Stage 4a**.
- Real findings that were already there before this diff skip 4a (fixing them
  isn't this change's job, and re-review would keep flagging them until the
  cap tripped): they go on the Stage 5 list.

### Stage 4a — Capped fix loop

Up to **2 rounds**:

1. Spawn a **fresh** `general-purpose` agent (not the Stage 3 agent) with
   the findings and the spec: "Fix these findings. Do not edit any
   `*.test.ts` / `*.test.tsx` file." Same verification gate as Stage 3.
2. Re-run Stage 4's review on the updated diff (produced the same way,
   `git add -N .` then `git diff HEAD`).

If findings remain after 2 rounds, **stop** — report the remaining
findings to the user directly rather than attempting a third round
yourself. This mirrors the cap the user chose: bounded automation, not an
unbounded loop.

## Stage 5 — Final gate and handoff

Re-run the full verification suite one last time on the final diff:

```bash
npm run verify
```

Summarize for the user: what changed, a link to the spec file, the review
outcome, and confirmation everything above is green. List separately any
finding the review made that this change did not cause (a bug that was
already there): it is not a regression and not part of this diff, so it goes
to the user as its own item to fix now, file, or drop, rather than being
absorbed silently or left only in your summary. Then add the Stage 6 result.
Ask explicitly before committing or pushing — this pipeline's job is to leave
the working tree ready, not to ship it without a final human yes.

## Stage 6 — Retrospective

Part of the same handoff message, done by you (the point is to write down
what the run itself showed, not to re-review the code). Look back over this
run for friction that actually happened: a gate or agent output that was wrong
or misleading, something that had to be redone, or a doc that turned out false.
The evidence is the
three agents' reports (a spec error the test-writer caught, a deviation the
implementer reported, findings the reviewer made), any gate that failed, and
any tool that behaved unexpectedly. Don't invent friction, and don't add a
rule to justify the stage: a run with none reports "nothing to change" and
only logs its row (below).

For each real issue, fix it at the strongest level that fits:

1. **A mechanical check** (a script, a test, a CI step). It doesn't depend on
   anyone reading a doc, so it is the preferred fix (`check:bundle`'s
   static-import check came from a review finding). A new check still gets
   Stage 3's planted-regression test.
2. **A correction to the doc or skill that already covers the area**, edited
   in place. Add a new section only when nothing existing fits.
3. **A new sentence of guidance**, only when neither of the above applies.

A real issue is not skipped because it's small or awkward to fix. A bug found
but not caused by this change belongs in the Stage 5 list, not here, and a
problem in a topic under `src/content/` is fixed in this diff (Stage 4a) or
listed there; neither is a retro edit.

Also check [docs/DEFERRED_PRACTICES.md](../../../docs/DEFERRED_PRACTICES.md):
if a practice's revisit condition became true during this run, propose
adopting it to the user (a large one, like Playwright, is its own `/feature`)
and update or remove its entry. That file holds practices considered and
deliberately not adopted yet, each with a revisit trigger; a lesson or a fix
does not go there (see its "Adding an entry").

If the proposed edits touch a process file (a `SKILL.md`, `CLAUDE.md`, a doc
under `docs/` other than a spec, anything under `evals/`, or `.claude/hooks/`),
have **one fresh** `general-purpose` agent (never `fork`) read them before you
show the user: you wrote them, so you are the worst-positioned reader of them.
Give it the diff, the friction evidence for each edit (not your reasoning) and
the paths of the files the edits sit in, and tell it to review only, not edit.
Ask it to be skeptical and to answer: does any edit contradict text that
already exists (counts and stage numbers included); could a hurried reader who
has never seen this repo apply it differently than intended; is each edit
earned by its evidence, or a rule added to look thorough; would a mechanical
check make the prose unnecessary. Have it also pick two or three realistic
runs and dry-run the new text against them, saying where the text gave no
clear answer. One pass, no loop: fix each finding you can't refute in a
sentence and report the rest. A run whose edits touch no process file skips
this.

Append this run's row to [docs/pipeline-log.md](../../../docs/pipeline-log.md)
(its header defines the columns), even when the retro found nothing: a run
with no friction is data too. Before writing "nothing to change", compare it
with the row's own gate failures and findings; if they are non-zero, say in
the Retro cell why none of them called for a change. If this run fixed a bug
an earlier approved run introduced, fill in that row's **Escaped defect** cell
and treat it as friction for this retro.

Show the user what you found and the edits you propose, along with any review
findings you didn't act on. Once they approve, commit the retro edits
separately from the feature, then run whichever eval `evals/README.md`'s table
names for what you changed.
