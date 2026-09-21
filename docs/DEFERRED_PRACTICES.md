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
doesn't fail open, can't be bypassed by local config.
**Revisit when:** Branch protection alone proves insufficient in
practice (e.g., a bad commit reaches `main` despite the CI gate because
of a race or a misconfiguration) — that would be evidence the local
layer is worth the added complexity, rather than a guess that it might
be.

### Token/compute cost tracking per agent task

**What it is:** Measuring and logging token spend per verified
successful task, not just raw agent output volume.

**Why deferred:** Real advice for a team or org where inefficient agent
usage compounds across many people and a shared budget. For a solo
personal-site repo, there's no budget being pooled and no one else's
spend to keep visible — the cost of a wasteful session is fully borne
and immediately felt by the one person running it.
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
isolation.
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
people's infrastructure depends on.
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
