# Add a content-quality dimension to the Writing Standard and review process

## Context

This session just ran a large, ad-hoc, 4-agent audit across all 52
existing topics, checking for three things the current review process
doesn't explicitly cover: prose that reads as generically AI-generated
rather than human-written, figurative/analogical language that gets
over-explained instead of trusted to land, and technical claims stated
confidently without being independently verified. It found real issues
in ~35 files (a corpus-wide "actually" header tic, stock "that's the
real X" closers, mechanically uniform bullet lists, a metaphor in
`why-you-cant-focus-anymore.md` that spent two passages literally
debunking "dopamine detox" as if a reader might take it as a literal
biological claim, and five genuine technical inaccuracies) and fixed all
of them.

The user asked whether this should become a repeatable part of the
process instead of a one-off. Applying this repo's own decision
framework (`ai-and-ml/documentation-vs-skill-vs-hook.md`): the actual
rubric belongs in exactly one place — `CLAUDE.md`'s Writing Standard,
since every place that already reviews against "the Writing Standard"
should inherit the expanded bar automatically, not have it duplicated.
Two things then consume that expanded standard, matching what already
exists: `add-topic`'s Stage 3 per-topic review (closes the gap going
forward, one topic at a time) and a new periodic `content-audit` skill,
structurally parallel to `docs-audit` (catches cross-file patterns a
single-topic reviewer structurally cannot see — the "actually" header
tic was only visible this session because multiple files were read
together). No new hook — full sweeps are deliberately manual/periodic,
the same reasoning `docs-audit` already documents.

## Approach

### 1. `CLAUDE.md` — extend the Writing Standard section

Add three new bullets after the existing four (define terms / first
principles / concrete examples / scannable summary), close to this
wording:

- Prose reads like something a knowledgeable person actually wrote, not
  a generically AI-patterned draft: avoid stock rhetorical crutches
  ("not just X — it's Y," "that's the real/actual X" as a closer),
  bullet lists where every item follows an identical rhythm with no
  variation, filler intensifiers stacked for emphasis ("genuinely,"
  "actually," "real"), and a header's point immediately restated
  almost verbatim in the sentence right under it.
- A figurative or casual phrase (an analogy, a shorthand term like
  "dopamine detox") is used naturally and trusted to land — not
  over-explained or defended against a literal misreading nobody would
  actually make.
- Every substantive technical claim is independently verified against
  real knowledge of the subject before publishing, not assumed correct
  because it reads confidently.

### 2. `.claude/skills/add-topic/SKILL.md` — Stage 3's review prompt

Extend the "Check specifically:" list in the reviewer instruction to
also ask about the three new criteria, referencing "the Writing
Standard" rather than re-stating it (single source of truth stays in
`CLAUDE.md`). This closes the gap for new topics going forward.

### 3. New skill: `.claude/skills/content-audit/SKILL.md`

Structurally parallel to `docs-audit/SKILL.md` (same "why an
independent read, not self-check" framing), sized for a corpus that
will keep growing:

- **Stage 0 — scope the run.** Default: every file under
  `src/content/**/*.md` (glob at run time). If invoked with specific
  file/section names as args, scope to those instead.
- **Stage 1 — enumerate and batch.** List every in-scope file yourself
  (mechanical). Split into roughly-even parallel batches (by section is
  the natural split, as this session did across 4 agents for 52 files)
  rather than one massive agent call.
- **Stage 2 — independent audit, per batch.** Spawn a **fresh**
  `general-purpose` agent per batch (never `fork`), each given its
  files, `CLAUDE.md`'s Writing Standard, and this session's calibration
  criteria for the three categories (the specific tells: rhetorical
  crutches, mechanical bullet uniformity, filler stacking, redundant
  restatement for tone; over-explained analogies for figurative
  language; independent fact-verification for correctness) — the same
  instruction shape that worked this session. Each reports findings
  grouped by file and category, read-only.
- **Stage 3 — apply fixes.** Confirmed findings are low-risk text edits
  — apply directly (batched across fresh agents again if the finding
  count is large, mirroring what this session did; directly by the
  orchestrator if small), same reasoning `docs-audit` Stage 3 already
  gives: the audit itself was the independent check.
- **Stage 4 — final gate.** Run
  `npm run typecheck && npm run lint && npm run format:check && npm run test:run`
  (add `build`/`size` if the batch was large). Summarize what was
  audited, found, and fixed; ask before committing, same as always.

Also add one clarifying line to `docs-audit/SKILL.md`'s Stage 1 file
list noting it does **not** cover `src/content/**` — that's
`content-audit`'s scope — so the two skills' boundaries stay
unambiguous.

### 4. Eval: treat the new scenario as this change's "test"

There's no application code here, so the standard vitest-based Stage
2/3 doesn't literally apply — but `evals/skill-routing` already serves
as this repo's test suite for exactly this kind of SDLC-tooling change,
and the user's own request already asked for a new scenario. This
maps cleanly onto red/green:

- **"Red" (Stage 2):** a fresh agent writes a new scenario (`SR-11`) to
  `evals/skill-routing/scenarios.md`, in the existing format (see
  `SR-09`'s docs-audit entry) — a task description that should route to
  `content-audit`. It then actually runs that scenario against a fresh
  routing-decision agent (per `skill-routing-eval`'s own Stage 1
  procedure) and confirms today's answer is _not_ `content-audit`
  (since the skill doesn't exist yet) — genuinely red, not asserted.
- **"Green" (Stage 3):** the implementer builds the actual skill +
  `CLAUDE.md`/`add-topic` edits, then re-runs the same `SR-11` scenario
  the same way and confirms it now correctly resolves to `content-audit`.

## Explicitly out of scope

- No new hook — full-corpus sweeps stay manual/periodic by design.
- No change to `docs/SDLC.md` unless the implementer finds a specific
  fact it states that's now inaccurate (unlikely — it describes the
  three-agent-boundary reasoning in general terms, not a skill list).
- Not re-running the full 4-batch historical audit again — that already
  happened this session; this change is about the process going
  forward.

## Acceptance criteria

1. `CLAUDE.md`'s Writing Standard includes the three new bullets above.
2. `add-topic/SKILL.md`'s Stage 3 reviewer instruction asks about all
   three new criteria, without duplicating their definitions (references
   "the Writing Standard," doesn't restate it).
3. `.claude/skills/content-audit/SKILL.md` exists, follows the stage
   structure above, and its Stage 2 audit-agent instruction is
   calibrated with concrete examples (not vague "check the tone"), the
   same level of specificity this session's own audit prompts used.
4. `docs-audit/SKILL.md` explicitly notes `src/content/**` is out of its
   scope.
5. `evals/skill-routing/scenarios.md` has a new `SR-11` entry for
   `content-audit`, in the existing format.
6. Before `content-audit` exists, running `SR-11` against a fresh
   routing-decision agent does not resolve to `content-audit`. After
   the skill is built, re-running the identical `SR-11` scenario does
   resolve to `content-audit`. Both runs are real (a spawned agent's
   actual answer), not asserted.
7. Running the _existing_ `SR-02` (add-topic) and `SR-09` (docs-audit)
   scenarios still resolves correctly after the new skill is added —
   the new skill doesn't create routing ambiguity for adjacent cases.
8. A dated results entry is appended under
   `evals/skill-routing/results/` for this run (never overwriting a
   prior day's log), per `skill-routing-eval`'s own Stage 2.

## Files touched

- `CLAUDE.md` (Writing Standard section)
- `.claude/skills/add-topic/SKILL.md` (Stage 3 prompt)
- `.claude/skills/content-audit/SKILL.md` (new)
- `.claude/skills/docs-audit/SKILL.md` (one clarifying line on scope)
- `evals/skill-routing/scenarios.md` (new `SR-11`)
- `evals/skill-routing/results/<today>.md` (new dated entry, created by
  Stage 2 and again referenced when re-run after Stage 3)

No user-facing UI surface — this is entirely `.claude/`, `CLAUDE.md`,
and `evals/` tooling, so Stage 4 review has no browser-check component,
but does need to independently re-run the routing scenarios itself
rather than trust either prior stage's self-report.

## Verification

```bash
npm run format:check
```

(the standard content-only gate `docs-audit` uses) plus the red/green
`SR-11` routing checks described above, run by spawning real agents —
not asserted from reading the skill file and assuming it would route
correctly.
