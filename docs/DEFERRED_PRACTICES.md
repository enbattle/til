# Deferred agentic-engineering practices

This is the process-tooling equivalent of `CLAUDE.md`'s "What's
deliberately not built here" — except that section covers product
features, and this covers practices for building the site itself
(hooks, evals, CI gates, agent-workflow scaling) that were considered
and explicitly **not** adopted, rather than never considered at all.

**Why this file exists rather than just skipping these silently:** a
solo, single-maintainer static site and a large engineering org solve
different problems, and most of what follows is genuine best practice
_at a scale this repo doesn't have_ — adopting it here would be exactly
an "over-build ceremony before the basics are proven" anti-pattern.
Recording the reasoning (not just the conclusion) means a future
maintainer of this repo, or another repo using `til` as a reference, can
tell "considered and rejected for a stated reason" apart from "never
occurred to anyone," and can re-evaluate cheaply if the stated condition
actually changes.

**Provenance:** the practices reviewed to produce this file came from a
Cursor engineering workshop (Lauren Tan / "pstack" plugin, on building
reliable AI-agent workflows in a production codebase) and Anthropic's own
Claude Code best-practices guide
(https://code.claude.com/docs/en/best-practices), reviewed against `til`'s
actual SDLC tooling on 2026-09-16, plus additional practices common at
larger engineering/AI organizations that came up in the same review. The
practices that were adopted rather than deferred (the hex-color CI guard,
`docs/SDLC.md`'s context-window note) are documented where they live, not
repeated here.

## Adding an entry

An entry belongs here only if a practice was **considered and deliberately
not adopted yet**, usually because this repo doesn't yet have the scale or
complexity that justifies it, with a **revisit when** that can be checked as
true or false (or a plain statement of why there isn't one, as the
session-hygiene entry gives). It is a reference for when the codebase grows
into needing the practice, not a list of lessons or todos. A bug or a
process gap found in a run is fixed in the place it lives (a check, a doc, a
skill) and does not get an entry here; the `/feature` retrospective (Stage 6
of `.claude/skills/feature/SKILL.md`) is where that decision gets made. When
a revisit condition becomes true, adopt the practice and update or remove its
entry rather than leaving a stale deferral (the header notes that adopted
practices are documented where they live, not repeated here). Use the three-part format below.

## How to use this file

Each entry has three parts: **what it is**, **why it's deferred** (the
actual reasoning, not just "not needed"), and **revisit when** (a
concrete trigger condition, not "eventually"). Before adopting anything
below, check whether the trigger condition is actually true now — most
of these get worse, not better, if adopted before the condition that
justifies them exists.

---

### Local blocking pre-commit hook (PreToolUse deny on `git commit`)

**What it is:** A hook that intercepts `git commit` and refuses to let it
run unless a verification script passes first, enforced locally rather
than relying on the agent choosing to run checks.

**Why deferred:** Investigated directly (see
`docs/specs/` history and the session that produced this file) and
rejected for a specific, verified reason: Claude Code's PreToolUse hooks
**fail open on timeout** — if the check doesn't finish inside its
configured timeout, the tool call proceeds anyway, block or no block.
`til`'s existing hooks use a 10-second timeout; the full verification
suite (`npm run verify`, the chain in `CLAUDE.md`) can exceed that, which means a naive version of this hook would
silently stop blocking the first time a check ran slow — a false sense
of security, which is worse than no hook. A narrower version (gating
only the fast checks — `format:check` + `lint`) avoids the timeout risk
but only protects commits made through this exact hook config on this
exact machine; it's trivially bypassed and duplicates gate logic that
already varies by change type across the skills (`add-topic` vs.
`/feature` intentionally use different-sized gates). The mechanism that
actually matches "don't let a bad change get merged" is GitHub branch
protection requiring the existing CI check to pass — server-side,
doesn't fail open, can't be bypassed by local config. Branch protection is
enabled, but in practice commits are pushed straight to `main` (none of the
history arrived through a PR), and on 2026-09-21 two commits whose CI failed
(fdd0db5, 00f2f84) reached `main` and deployed. That was this entry's
revisit condition firing. The response was a second server-side layer rather
than this local hook: the deploy workflow now runs `npm run verify` itself,
so a red commit can land on `main` but can't go live. The local hook's
fail-open problem is unchanged, so it stays deferred.
**Revisit when:** The server-side layers prove insufficient in practice: a
commit that fails `verify` goes live despite the deploy gate, or red commits
on `main` keep costing enough (broken history to bisect, reverts) that
catching them before the push is worth the hook's complexity.

### Token/compute cost tracking per agent task

**What it is:** Measuring and logging token spend per verified
successful task, not just raw agent output volume.

**Why deferred:** Real advice for a team or org where inefficient agent
usage compounds across many people and a shared budget. For a solo
personal-site repo, there's no budget being pooled and no one else's
spend to keep visible — the cost of a wasteful session is fully borne
and immediately felt by the one person running it. When it is needed, the
cheap first step is a cost column in [pipeline-log.md](pipeline-log.md)
(agents spawned, rough tokens per run), not a metering system.
**Revisit when:** Agent usage on this repo becomes heavy/frequent enough
that cost becomes a real planning question, or if this repo is ever
used as a template by a team where spend needs to be visible across
people.

### Git worktrees / `claude -p` fan-out for parallel agents

**What it is:** Running many isolated Claude Code sessions in parallel
across git worktrees or via scripted fan-out, each scoped with
`--allowedTools`.

**Why deferred:** Solves a scaling problem — coordinating many
simultaneous agents — that a single-maintainer site doesn't have.
`til`'s actual parallelism (e.g. running 5+ eval scenarios at once) is
already handled by spawning subagents within one session, which is
enough at this scale.
**Revisit when:** A single task genuinely needs more simultaneous,
independent agent work than subagents-within-a-session can reasonably
provide — not just "more agents" as a goal in itself (the source
research explicitly warns against optimizing for agent count/output
volume).

### LLM-as-judge with a CI-gated automatic threshold

**What it is:** Running eval scenarios automatically on every push/PR,
graded by another model, with a required pass threshold blocking merge —
the automated version of what `skill-routing-eval` and
`content-review-eval` currently do manually.
**Why deferred:** `evals/README.md` already states the reasoning:
manual/periodic is deliberate here, since a full eval run costs real
time and tokens per scenario, and this is a personal site's process
check, not a safety-critical gate. An automatic CI-gated version also
needs a tolerance for eval-grading false positives/negatives that a
"revisit when something surprises you" cadence doesn't.
**Revisit when:** Manual/periodic runs are missed often enough in
practice that real routing or review-quality drift goes unnoticed for a
long stretch — that would be evidence the cadence, not just the
mechanism, needs to change.

### Sandboxed/ephemeral execution per agent run

**What it is:** Running each agent invocation in an isolated, disposable
environment (a container, a fresh VM) rather than directly against the
working machine.
**Why deferred:** This defends against an agent executing untrusted or
unpredictable code at meaningful blast radius — relevant when many
people's agents touch shared infrastructure. `til` is a static site with
no backend, no secrets of consequence beyond what's already
git-ignored, and a single operator; the existing "never `fork` for an
independent review" pattern already provides the isolation that
actually matters here (fresh reasoning context), just not OS-level
isolation. The one real blast radius is that a push to `main` deploys the
public site. That is covered without a sandbox: `.claude/settings.json`
denies force-pushes and asks before any `git push` (permission rules, unlike
hooks, don't fail open on a timeout), and the deploy workflow runs
`npm run verify` before publishing. The rules are a guardrail against a
mistake, not a security boundary: they match command text, so they cover
`git push`, `git -C <dir> push` and the same forms in the PowerShell tool
(`Bash(...)` rules don't apply to it, so each rule is written for both), but
Claude Code's own docs note forms like `git -c key=value push` or a quoted
`'push'` slip past any such rule.
**Revisit when:** This repo (or a fork of it) starts running agents
against something with real blast radius — deployment credentials,
production data, another system's API keys.

### Knowledge graph / semantic code index for agent context

**What it is:** A derived index sitting between an agent and the
codebase — embeddings for RAG-style retrieval, a symbol/dependency
graph, or a generated repo map — so a session queries a compressed
representation instead of reading source files fresh each time. This is
the pattern behind several public "give your coding agent long-term
memory" projects.
**Why deferred:** Solves a scale problem `til` doesn't have. `src/` is
a modest codebase that `CLAUDE.md` plus `Glob`/`Grep` orient a fresh
session in quickly — there's no re-reading cost here to amortize. It also
wouldn't have fixed the actual drift this repo has hit repeatedly (a
fact hand-duplicated across docs going stale): a derived graph is itself
a second representation of the truth that needs its own invalidation the
moment the source changes, which relocates that exact risk into a new
artifact rather than removing it. `CLAUDE.md`, `docs/SDLC.md`,
`docs/DESIGN.md`, and the skills already are `til`'s persistent knowledge
base for a session — hand-curated and human/agent-verified, which is
more reliable at this size than something auto-extracted.
**Revisit when:** The codebase or SDLC tooling surface grows large
enough that reading it fresh every session becomes genuinely slow or
costly — not a fixed file count, but the point where `CLAUDE.md` plus
`Glob`/`Grep` stop being enough to orient a fresh session quickly. A
related but distinct idea — a graph of relationships between _published
topics_, for readers rather than agents — is a different, content-facing
version of this same instinct, already covered by `CLAUDE.md`'s scope
exclusions (tags, and no tracks or ordered curricula over the catalog); that's a product-scope call, not
a process-tooling one, so it isn't repeated here.

### Visual regression / end-to-end (Playwright) testing

**What it is:** Automated screenshot diffing or browser-driven E2E tests
run in CI on every change.
**Why deferred:** Already an explicit, standing decision — `CLAUDE.md`'s
"What's deliberately not built here" already excludes Playwright/E2E
tests, with manual click-through via `npm run dev` as the accepted
substitute. Listed here only for completeness against the source
research, not because it's a new consideration.
**Revisit when:** See `CLAUDE.md` directly — this isn't a
process-tooling-specific trigger, it's the same one already governing
product scope.

### Signed commits / supply-chain provenance (commit signing, SLSA-style attestation)

**What it is:** Cryptographically signing commits and/or attesting to a
build's provenance, common at organizations shipping software other
people's infrastructure depends on. The same family includes pinning
third-party GitHub Actions to a full commit SHA instead of a movable tag
like `@v4` (a retagged action runs new code in the deploy job, which holds
`pages: write` and `id-token: write`); Dependabot can keep SHA pins current.
**Why deferred:** `til` is a static, read-only reference site with no
downstream consumers depending on its supply chain integrity the way a
library or a service would — the actual risk this defends against
doesn't exist here yet.
**Revisit when:** This repo starts shipping something other systems or
people build on top of and trust (a published package, an API, a
template other teams pull dependencies from).

### Feature flags / progressive rollout

**What it is:** Shipping code behind a runtime toggle, rolling out to a
subset of traffic before full release.
**Why deferred:** Structurally inapplicable — a statically-built,
fully-deployed-on-push site has no concept of partial rollout or user
segments to roll out to differently.
**Revisit when:** `til` ever gains a deploy model with distinct
audiences or gradual exposure — unlikely for a static personal site,
but the condition, not "never," is what's recorded here.

### Prompt/spec diff-review enforcement (e.g., a hook flagging an eval scenario file edit)

**What it is:** Treating changes to eval scenario files or skill prompts
with the same enforced review rigor as source code — e.g., a hook that
flags when `evals/**/scenarios.md` changes without a corresponding
results-log entry.
**Why deferred:** `til` already gets most of this benefit from
`skill-routing-eval`/`content-review-eval`'s own Stage 3 ("add a
scenario first, then run it") and the `nudge-sdlc` hook's existing
reminder — adding a dedicated enforcement mechanism on top would be
gating an already-lightly-gated process a second time for a solo
repo where the existing skill discipline hasn't actually been skipped
in practice.
**Revisit when:** A scenario file is edited without a corresponding run
in practice — evidence the existing discipline alone isn't holding.

### PR templates with an embedded verification checklist

**What it is:** A GitHub PR template listing the required verification
commands as checkboxes, nudging a human reviewer/contributor.
**Why deferred:** Solves a coordination problem between multiple
people opening PRs against shared conventions. A solo maintainer
opening their own PRs (if any) already has `CLAUDE.md` loaded by
Claude Code automatically each session; a checklist duplicates
information that's already the first thing read.
**Revisit when:** Another contributor starts opening PRs against this
repo who wouldn't otherwise see `CLAUDE.md`'s verification section.

### Dependabot auto-merge for patch-level bumps

**What it is:** Automatically merging a dependency-update PR once CI
passes, without a manual look, for low-risk patch versions.
**Why deferred:** Not investigated in depth — flagged here as a
plausible small win rather than a fully reasoned rejection, unlike the
entries above. The open question is whether patch-level bumps in this
dependency set have historically been safe enough to skip a manual
glance; that hasn't been checked.
**Status (2026-09-23): the trigger has fired.** Nine Dependabot PRs
(#1–#5, #7–#10) had been open since 2026-09-13 without a look; a review of
each (verify on the branch merged with `main`, release notes for the major
bumps) produced a merge order for the user. Adopting auto-merge still waits
on one fact: whether required status checks are enforced for pull requests,
since without them auto-merge merges immediately.
**Revisit when:** Dependabot PR volume becomes tedious enough that a
manual look at each one stops actually happening (silently trusting them
unreviewed is worse than an explicit auto-merge policy for the ones
proven safe).

### Generic Claude Code session-hygiene advice (e.g., "kitchen sink session," "correcting over and over")

**What it is:** Named failure patterns for how _a person_ should manage
a single Claude Code session — clearing context between unrelated
tasks, restarting after repeated failed corrections rather than
continuing to patch a polluted context.
**Why deferred (and why not just "add it to CLAUDE.md" as literal
advice):** This is real, useful advice — but it's advice for how someone
_works with_ Claude Code in general, not a fact about this repository.
`CLAUDE.md`'s own discipline (documented in this same source material)
says to exclude anything that's generic advice Claude would already
know, on the grounds that a bloated file causes instructions to be
ignored, not just wastes tokens. Recording this here rather than in
`CLAUDE.md` is itself an application of that rule, not an oversight.
**Revisit when:** Never, as a `CLAUDE.md` addition specifically — this
entry exists for completeness against the source material, not because
the trigger condition is expected to fire. If `til` ever needed
repo-specific session-hygiene guidance (unlikely), that would be a
different, genuinely repo-specific entry, not this one promoted
verbatim.

### Aggregating friction across retrospectives

**What it is:** A periodic pass that reads every row of
[pipeline-log.md](pipeline-log.md) (and the eval result logs) together,
groups recurring friction, and proposes structural changes (merge or delete a
stage, a new check, a new doc) instead of the point fixes a single retro
makes.
**Why deferred:** It needs data. The log started on 2026-09-23 with no
backfill, and a pass over a handful of rows finds nothing a single retro
wouldn't. Until then, `/feature` Stage 6 is the only retro, and it only sees
its own run.
**Revisit when:** The log reaches about 20 rows, or the same kind of friction
appears in the Retro column of two or more rows.

### An independent read of the retrospective's judgment

**What it is:** A fresh agent that checks the retro's conclusions (was
"nothing to change" right, was the chosen fix at the right level), not only
the process-file edits it proposes, which already get one.
**Why deferred:** It would add an agent to every run to catch a failure
nobody has seen yet. The pipeline log makes the obvious case mechanical: a
row with gate failures or findings and a retro of "nothing to change" must
say why in the same row, so it is visible without another agent.
**Revisit when:** A logged row shows a "nothing to change" retro whose stated
reason doesn't hold up, or an escaped defect traces back to a run whose retro
was clean.

### A separate spec-clarify step

**What it is:** A dedicated stage (`spec-clarify` in cortex-workspace, a separate design reference at github.com/enbattle/cortex-workspace) that
interrogates the spec for undefined terms, unstated assumptions, missing
error behavior and untestable acceptance criteria before any tests are
written.
**Why deferred:** In `/feature`, the user reads and approves the spec in plan
mode, and a solo maintainer is both the requester and the approver, so the
ambiguity this step hunts for is usually resolved in that same conversation.
**Revisit when:** Twice in the log: a row's Gate failures names a `spec
ambiguity` re-run, or an `## As built` section records a deviation caused by a
spec ambiguity rather than a technical discovery.

### One canonical agent file, with generated adapters for other tools

**What it is:** Keeping agent guidance in a tool-neutral `AGENTS.md` and
generating thin per-tool pointers (`CLAUDE.md` as `@AGENTS.md`, Cursor rules,
Copilot instructions), as cortex-workspace's design rule R8 does.
**Why deferred:** This repo is deliberately built for Claude Code: the skills,
hooks, subagent rules and `settings.json` permissions are Claude Code
mechanisms, and nobody works on it with another tool.
**Revisit when:** A second agent tool is used on this repo, or `til` is used
as a template by people who don't use Claude Code.

### A dedicated security-review pass

**What it is:** A second, separately-scoped reviewer (threat model, input
handling, auth boundaries) that runs when a diff adds an external surface,
instead of security riding along as one item in Stage 4's review.
**Why deferred:** `til` has no runtime input surface: no forms, no API, no
auth, no user content, no third-party scripts. The security lines in
[NON_NEGOTIABLES.md](NON_NEGOTIABLES.md) and Stage 4's review cover what
exists.
**Revisit when:** A change adds any runtime input or trust boundary: a form,
a fetch to an API, authentication, user-generated content, or a third-party
script.

### Splitting CLAUDE.md so each skill loads only what it needs

**What it is:** Moving content-authoring detail (System Design question
rules, "Where you'll meet this", link-extractor edge cases) out of the
always-loaded `CLAUDE.md` into a doc that `add-topic` and the reviewers read
on demand, leaving `CLAUDE.md` as a short router.
**Why deferred:** At about 270 lines `CLAUDE.md` is long, but no eval or run
has yet shown an instruction ignored because of its length, and moving text
risks breaking the routing that `skill-routing-eval` currently passes.
**Revisit when:** An eval result or a logged run traces a miss to an
instruction in `CLAUDE.md` being ignored or crowded out, or before adding
the next large section to it.
