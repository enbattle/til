---
name: feature
description: Run this repo's full spec-to-ship pipeline for a new feature or change — spec, TDD tests, implementation, independent adversarial review (code + UI), and docs — with role separation enforced only where independence actually prevents a specific bias, not for every named step. Use when the user asks to add, build, or ship a feature (or a batch of related ones) in this repo.
---

# Feature pipeline

The runbook: follow it stage by stage for the change the user asked for (their
request is this skill's argument). Why each stage is shaped this way is in
[docs/SDLC.md](../../../docs/SDLC.md).

**Non-negotiable rules, enforced at every stage below, not just described:**

1. The agent that writes tests never implements. The agent that implements
   never edits a test file. The agent that reviews never writes code. Each
   is a **separate, fresh** `Agent` call — never a `fork` — so no stage
   inherits another stage's reasoning or bias.
2. After the test-writing stage and after the implementation stage, you
   (the orchestrator) verify the rule held by running the gate checks
   yourself (`git status`, the test-lock check) — not by trusting the
   subagent's self-report.
3. Never commit or push without the user's explicit go-ahead — this pipeline
   ends at "ready to commit," not at "committed."

Only the test-writer, implementer and reviewer run as separate fresh agents,
plus single-purpose extras when a stage calls for one (a finding triager in Stage 4, a
fixer in 4a, a process-edit reader in Stage 6). Spec stays with you and the
user; docs stay with the implementer. Add no other worker agent without a
specific bias it would prevent. Tell every agent to run tests and checks in
the foreground: one that backgrounds a run and waits on it can stall without
ever reporting.

**Splitting a role.** A role can run as several agents when its content files
are more than one agent can read in full. One owner agent does all the role's
code, doc and UI work on the full diff plus its share of the content; each
extra agent gets the spec, docs/NON_NEGOTIABLES.md and only its own content
files, and never sees another role's work. The stage's gate runs once, after
all finish. Stage 4a's rounds and cap count for the whole stage, and a round's
fixes go to one fixer. Don't split small work just to finish sooner.

## Stage 0 — Scope the request

Small and unambiguous (a copy tweak, a one-line fix, a config change)? Say so
and do it directly. **A bug of unknown size is triaged first:** reproduce it
and find the cause, read-only. A cause confined to one place, fixed without
changing behavior anything else relies on, is a direct fix with a regression
test that fails before the fix; one that spans modules, changes a convention
or needs a behavior decision comes back here. Name the current stage in your
replies ("Stage 2: writing tests").

## Stage 1 — Spec

Use `EnterPlanMode`, explore the relevant code yourself, and use
`AskUserQuestion` for any genuine judgment call. The plan must include:

- **Acceptance criteria as concrete, testable behaviors** ("typing a query
  that matches a topic's summary but not its title still returns that
  topic", not "search should work better"). They become Stage 2's tests.
- A check over content uses the shared `markdownParser()`
  (`src/lib/markdown.mjs`) or inspects the rendered output, not a regex
  or a second parser.
- A guard (a check script, the test lock, a structural test): where the
  inputs that can change its outcome can be listed in full, the spec pins all
  of them (an allowlist), not a list of known-bad names, which is only as
  complete as the cases someone thought of. Where they can't (HTML sinks), the
  spec says so and lists the vectors the guard must reject.
- A change to a script that is already locked (`docs/verification.md` lists
  them, e.g. `scripts/lib.mjs`) is assigned to the Stage 2 test-writer, which
  writes its planted cases first. A change that widens the lock shows its new
  parts as `added` at Stage 3's gate; the spec can pre-approve exactly those,
  and the orchestrator then confirms with the previous script that nothing
  already locked changed, and re-takes the snapshot.
- Scope in and out; files/modules touched; whether there's a user-facing UI
  surface (decides Stage 4's browser check).
- A check against [docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md):
  if the request needs to break a line there, say so and let the user amend
  that file or change the request. Don't plan around it quietly.

`ExitPlanMode` for approval. **Once approved**, save the spec as
`docs/specs/<slug>.md` (kebab-case). Stages 2–4 get this file, never your
exploration or reasoning.

## Stage 2 — Tests first (red)

Spawn a **fresh** `general-purpose` agent (never `fork`). Give it the spec's
full content, the paths of 2–3 test files to match (e.g.
`src/lib/content.test.ts`, `src/components/MarkdownRenderer.test.tsx`), and
this instruction, close to verbatim:

> Write tests covering every acceptance criterion in the spec above. Only
> create or edit test files (any `*.test.*` or `*.spec.*` JS or TS file, such as
> `*.test.ts`, `*.test.tsx` or `*.test.mjs`: what `check:test-lock` locks; a
> guard script's planted-violation cases go in `scripts/checks.test.mjs`), a
> new `test*` script in `package.json` and its `npm run` step in `verify` if
> the tests need one, any locked script the spec assigns to you, and test fixture
> content under `src/content/`, `src/system-design/` or `src/dsa/` only if the spec
> requires new seed content to test against. Do not write or modify
> any implementation file. Run the suite yourself when done and confirm the
> new tests fail — report exactly which tests are red and why (missing
> implementation, not a typo in the test). A file that can't import a module
> nothing implements yet is red as a whole and hides each test's own reason,
> so a test that doesn't need that module goes in a file that doesn't import it.

**Gate** (you run it):

```bash
git status --porcelain -uall    # every changed path is a test file, a fixture, package.json's test* scripts and verify steps, or a script the spec assigned
npm run test:run                # the new or edited tests for the new behavior must actually fail
npm run typecheck               # every error is a name the spec introduces but nothing implements yet; any other error fails the gate
npx prettier --check <changed test and fixture files> && npx oxlint <changed test files>   # no later stage may fix a locked file
```

If an implementation file changed, or a new test passes immediately or is red
for a reason other than missing implementation, re-run
this stage with a corrected instruction. Cap: **2 corrected re-runs**, then
go to the user (the criteria probably aren't testable as written). An edited
existing test only has to fail if the edit encodes the new behavior.

A content fixture ships as real content, so it meets the Writing Standard.
Once locked, only a Stage 2 re-run may change it (a prose finding about it
goes to Stage 4a's test-writer, not its fixer). Lock the tests, naming every
fixture the test-writer created or changed:

```bash
npm run check:test-lock -- --snapshot [fixture paths...]
```

The Stage 3, 4a and 5 gates compare against it; only a fresh test-writer's
change re-takes it.

**Re-running after Stage 3 has started** (the implementer reported a wrong
test): give a fresh test-writer Stage 2's instruction plus the report, scoped
to the tests it names. Gate:

```bash
git status --porcelain -uall   # before and after the re-run: no implementation file may change
npm run check:test-lock -- --verify   # lists exactly what the re-run changed
```

Every listed path must be one the report named (or a fixture it depends on);
a corrected test needn't fail. Re-take the snapshot and run Stage 3's gate.
Green, and the earlier implementer's report covers its docs and any spec
deviations: go on to Stage 4. Otherwise spawn a **fresh** implementer, which
counts toward Stage 3's cap of 2. Cap: **2 re-runs per feature**; a third wrong-test report goes
to the user as a spec problem.

## Stage 3 — Implementation (green) + docs

Spawn another **fresh** `general-purpose` agent with the spec and the failing
test files' paths and content (ground truth). Instruction, close to verbatim:

> Implement the spec above so the failing tests listed pass. Do not edit,
> delete or add any file `npm run check:test-lock` locks (docs/verification.md
> lists them: every test file, the test runners' and the lock's own scripts
> and config, every ignore rule) or these fixture files: <the fixture paths
> locked in Stage 2, or "none">. A check will fail if any of them changes. If
> a test looks wrong or is too slow to run, or the spec is ambiguous in a way
> that blocks you, stop and report it instead of changing the test or adding
> app code to work around it.
> Update any doc this change makes stale (`CLAUDE.md`, `README.md`, `docs/`,
> `.claude/skills/`, `evals/`) if it adds or changes a convention future
> work should follow — most changes
> won't need every file touched, update only what actually changed.
> Run `npm run verify` (the whole chain; docs/verification.md explains each
> check) yourself before reporting done.

**Gate** (not `git diff`, which misses untracked files and staged edits):

```bash
npm run check:test-lock -- --verify   # MUST pass — any changed, deleted or added locked file is a hard stop
npm run verify
```

A lock failure: stop and surface it to the user; don't judge the edit
yourself. Only `verify` red: send its output and the spec to a fresh
implementer, cap **2**, then the user. A reported wrong test: don't fix it
yourself; re-run Stage 2 as above, then this gate.

Also:

- **Keep the spec truthful.** If the report shows a deviation from the spec (a
  different mechanism, a changed signature, a behavior the tests forced), add
  an `## As built` section listing each and why; leave the original text.
- **See any new guard fail.** For a new regression guard (a `scripts/`
  check, a CI step, a size or bundle assertion), plant the regression in a
  copy outside the working tree (`git worktree add` or `cp -R` into the
  scratchpad) and confirm it exits non-zero. Its planted cases belong in the
  locked `scripts/checks.test.mjs`: Stage 2 wrote them if the spec planned the
  guard; otherwise report it and re-run Stage 2 for them before this gate
  passes.

## Stage 4 — Adversarial review (code + UI)

**Not `/code-review`**: the `Skill` tool forks it from this session, so it
isn't independent (fine ad hoc, outside this pipeline). Spawn a **fresh**
`general-purpose` agent (never `fork`) with only the spec, the path of
[docs/NON_NEGOTIABLES.md](../../../docs/NON_NEGOTIABLES.md) and the full diff
from `npm run review:diff` (`git diff HEAD` omits new files) — no exploration,
subagent reports or framing of yours. Instruction, close to verbatim:

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
> finding, say whether this diff introduced it or it was already there, and
> name a realistic trigger: for app behavior, real inputs or content; for a
> guard or check, an edit an author following docs/content.md,
> docs/case-studies.md or docs/dsa.md could plausibly make, or a shape a doc says the check
> covers (a doc/code mismatch is itself a finding). Label a finding without
> one "theoretical". If the spec has a `## Review decisions` list, re-raise a
> listed decision only with new evidence. If this change adds or edits topic
> content (a file under `src/content/`, `src/system-design/` or `src/dsa/`), also hold the
> prose to docs/writing-standard.md: terms defined before use, followable by
> a reader with zero background, concrete examples. Also check whether
> this diff makes any documentation elsewhere in the repo (CLAUDE.md,
> README.md, docs/**, other SKILL.md files) inaccurate or incomplete —
> a convention this change establishes that isn't written down anywhere,
> a fact (a command, a file list, a section name) that a doc now states
> incorrectly. The implementer was already asked to update docs as part
> of Stage 3; verify that independently rather than trusting it was done
> correctly, the same way you verify the code itself. Do not write or
> edit any code in the working tree — review only. Report findings ranked by severity, or say
> explicitly that you found nothing worth flagging.

No findings, or only cosmetic ones the user would wave through → Stage 5.
Findings already there before this diff → the Stage 5 list. Other real
findings → finding triage.

**Finding triage, before any fix.** Spawn a **fresh** `general-purpose` agent
in the implementer role (not the reviewer, not you; never `fork`) with the
spec, the findings and `npm run review:diff`. Instruction, close to verbatim:

> For each finding below, confirm or dispute it with evidence from the
> current repo: does the input or shape it describes occur in real files,
> does it reproduce (try it in a copy outside the working tree, via
> `git worktree add` or `cp -R` into the scratchpad), and is it reachable?
> Reachable means:
> for app behavior, with real inputs or content; for a guard or check, by an
> edit an author following docs/content.md, docs/case-studies.md or
> docs/dsa.md could plausibly make, or in a shape a doc says the check covers (a doc/code
> mismatch is itself a finding). Anything else is theoretical. Quote the file
> and line, or the command and its output, for each. Do not edit any file in
> the working tree.

You assign each finding one outcome from the triager's evidence, weighing
impact × likelihood, not history alone (a severe-if-unlikely class such as
XSS, data loss or money created isn't dismissed because it hasn't happened
yet):

- **Fix with a test**: every reachable behavior bug, including a vector a
  guard misses.
- **Fix, no new test**: prose, docs or layout only.
- **Known limitation**: real but theoretical, or the fix costs more than the
  risk.
- **Reject**: not true of the current code or content.

A finding that breaks a line of docs/NON_NEGOTIABLES.md is never Known
limitation or Reject for reachability: it is Fix (with a test when that line
names a check or vector table, e.g. #6), and only the user can waive it, by
amending that file. For security, reachable means reachable under the threat
the line names, not by today's content.

You may not Reject or Known-limit a finding the triager confirmed reachable
without asking the user. A finding is contested when the triager disputes one
the reviewer rated High, or you want to overrule the triager; a contested
finding that costs real work goes to the user. Record each Reject and Known
limitation in the spec under `## Review decisions`, one line each with its
reason; the re-review gets that list, and the PR description repeats it.

### Stage 4a — Capped fix loop

Up to **2 rounds**, each in this order:

1. **Test first, only for Fix with a test** (a reachable behavior bug or a
   vector a guard misses, as finding triage defines reachable). A **fresh** test-writer gets
   Stage 2's instruction scoped to those findings; each test must fail for the
   finding's reason and exercise real output (the rendered page, the real
   file, the real CSS), not a re-implementation of it. Gate it like the Stage 2
   re-run (no implementation file in `git status --porcelain -uall`;
   `check:test-lock -- --verify` lists only those tests or fixtures), then
   re-take the snapshot. Any other change to a locked file goes here too,
   since a fixer may not touch one: prose in a fixture, or a locked script
   (the lock's own, a runner). For a script, the brief names it as allowed;
   the test-writer adds the planted case to `scripts/checks.test.mjs`, shows
   it failing, then edits the script, and the gate accepts the script in
   `--verify`. These runs don't count against Stage 2's caps and aren't
   logged.
2. A **fresh** `general-purpose` fixer (not the Stage 3 agent) gets the
   findings, the spec and any new tests: "Fix these findings. Do not edit,
   delete or add any locked file (the same list as Stage 3's instruction)."
   Stage 3's gate.
3. Re-run the review and finding triage on a fresh `npm run review:diff`.

Only fix outcomes the diff introduced count as remaining findings. After
round 2, open Mediums and non-cosmetic Lows default to Known limitation; if any finding
remains, **stop** and report to the user rather than running a third round.
Rounds past the cap are for High findings only, one per explicit go-ahead:
the same three steps, then stop and report again (NON_NEGOTIABLES #12). "Keep
going until it's clean" authorizes one round; say so.

## Stage 5 — Final gate and handoff

```bash
npm run check:test-lock -- --verify   # the reviewer ran the app; confirm it changed no locked file
npm run verify
npm run check:test-lock -- --clear    # the run's snapshot has done its job
```

Summarize: what changed, a link to the spec, the review outcome, each Reject
and Known limitation with its reason, and that everything above is green.
List separately each finding this change didn't cause, for the user to fix
now, file or drop. Add the Stage 6 result. Ask before committing or pushing.

## Stage 6 — Retrospective

In the same handoff, by you. Look for friction that actually happened: a gate
or agent output that was wrong or misleading, redone work, a doc that turned
out false. Evidence: the agents' reports, failed gates, tools that misbehaved.
Don't invent friction or add a rule to justify the stage; a run with none
reports "nothing to change" and only logs its row.

For each real issue, first ask: could something be deleted or simplified
instead? Otherwise fix it at the strongest level that fits: (1) a mechanical
check (script, test, CI step), which still gets Stage 3's planted-regression
test; (2) a correction in place to the doc or skill that covers the area (a
new section only when nothing fits); (3) a new sentence, only if neither
applies. A retro aims for no net added words in process files; when it adds,
the pipeline-log row's Retro cell says what it removed. Don't skip a real issue because it's small. A bug
this change didn't cause goes on the Stage 5 list, and a problem in a topic is
fixed in 4a or listed there; neither is a retro edit. When the row's Agents
count is high, name the stage that cost the most before proposing any change,
since an agent earns its cost only where its independence prevents a bias
(docs/SDLC.md).

If a [deferred practice's](../../../docs/DEFERRED_PRACTICES.md) revisit
condition came true, propose adopting it (a large one is its own `/feature`)
and update or remove its entry; lessons and fixes don't go there.

If the edits touch a process file (a `SKILL.md`, `CLAUDE.md`, a doc under
`docs/` other than a spec or the pipeline log, `evals/`, `.claude/hooks/`),
**one fresh** `general-purpose` agent (never `fork`) reads them first, given
the diff, the friction evidence per edit (not your reasoning) and the files'
paths, review only. Ask it, skeptically: does an edit contradict existing text
(counts and stage numbers included); could a hurried newcomer apply it
differently; is each edit earned by its evidence; would a check or a deletion
make the prose unnecessary. It also dry-runs the text against two or three
realistic runs, saying where it gave no clear answer. One pass: fix each
finding you can't refute in a sentence, report the rest.

Show the user the findings, proposed edits and review findings you didn't act
on. Once approved, commit the retro edits separately and run the eval
`evals/README.md`'s table names for them.

Then append this run's row to [docs/pipeline-log.md](../../../docs/pipeline-log.md),
following its header (columns, the Retro cell, **Escaped defect**), in the
feature's commit, with no independent read, and run
`npx prettier --write docs/pipeline-log.md`, `npm run check:pipeline-log` and
`npm run format:check`. A bug this run fixed that an earlier approved run
introduced is friction for this retro.
