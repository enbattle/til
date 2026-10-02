# Deferred agentic-engineering practices

This is the process-tooling equivalent of `CLAUDE.md`'s "What's
deliberately not built here" — except that section covers product
features, and this covers practices for building the site itself
(hooks, evals, CI gates, agent-workflow scaling) that were considered
and explicitly **not** adopted, rather than never considered at all.

Most of what follows is real best practice _at a scale this repo doesn't
have_. Recording the reasoning lets a later session tell "considered and
deferred for a stated reason" from "never occurred to anyone", and
re-evaluate cheaply when the condition changes. The practices were reviewed
against `til`'s tooling on 2026-09-16, from a Cursor engineering workshop
("pstack") and Anthropic's
[Claude Code best practices](https://code.claude.com/docs/en/best-practices).

## Adding or using an entry

An entry earns a place only when someone would otherwise propose the
practice. Each has three parts: **what it is**, **why it's deferred** (the
actual reasoning), and **revisit when** (a condition that can be checked as
true or false). A bug or process gap found in a run is fixed where it lives
(a check, a doc, a skill), not recorded here; the `/feature` retrospective
decides that. Before adopting a practice, check that its condition is true
now. When one becomes true, adopt the practice and update or remove its
entry; adopted practices are documented where they live, not here.

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
suite (`npm run verify`; docs/verification.md describes each check) can exceed that, which means a naive version of this hook would
silently stop blocking the first time a check ran slow — a false sense
of security, which is worse than no hook. A narrower version (gating
only the fast checks — `format:check` + `lint`) avoids the timeout risk
but only protects commits made through this exact hook config on this
exact machine; it's trivially bypassed and duplicates gate logic that
the skills already own (every skill's final gate runs `npm run verify`).
The mechanism that
actually matches "don't let a bad change get merged" is GitHub branch
protection requiring the existing CI check to pass — server-side,
doesn't fail open, can't be bypassed by local config. Branch protection is
enabled, and every change now lands through a pull request (CLAUDE.md, "How changes
land"); before that rule, commits were pushed straight to `main` (as of
2026-09-24, no human-authored change had arrived through a PR; Dependabot's
auto-merged PRs are the exception), and on 2026-09-21 two commits whose CI failed
(fdd0db5, 00f2f84) reached `main` and deployed. That was this entry's
revisit condition firing. The response was a second server-side layer rather
than this local hook: the deploy workflow now runs `npm run verify` itself,
so a red commit can land on `main` but can't go live. The local hook's
fail-open problem is unchanged, so it stays deferred.
**Revisit when:** The server-side layers prove insufficient in practice: a
commit that fails `verify` goes live despite the deploy gate, or red commits
on `main` keep costing enough (broken history to bisect, reverts) that
catching them before the push is worth the hook's complexity.

### LLM-as-judge with a CI-gated automatic threshold

**What it is:** Running eval scenarios automatically on every push/PR,
graded by another model, with a required pass threshold blocking merge —
the automated version of what the eval skills (see `evals/README.md`)
currently do manually.
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

### Prompt/spec diff-review enforcement (e.g., a hook flagging an eval scenario file edit)

**What it is:** Treating changes to eval scenario files or skill prompts
with the same enforced review rigor as source code — e.g., a hook that
flags when `evals/**/scenarios.md` changes without a corresponding
results-log entry.
**Why deferred:** `til` already gets most of this benefit from
the eval skills' own "add a scenario first" step ("add a
scenario first, then run it") and the `nudge-sdlc` hook's reminder on
skill, hook and process-doc edits (it doesn't fire on `evals/` files) — adding a dedicated enforcement mechanism on top would be
gating an already-lightly-gated process a second time for a solo
repo where the existing skill discipline hasn't actually been skipped
in practice.
**Revisit when:** A scenario file is edited without a corresponding run
in practice — evidence the existing discipline alone isn't holding.

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

### A dead-code check (knip) as a CI gate

**What it is:** Running [knip](https://knip.dev) (unused files, exports and
dependencies) in `verify`, so dead code fails CI instead of waiting for
someone to look.
**Why deferred:** It was run by hand on 2026-09-28 and found a handful of
internal-only exports, since removed; everything else it reported was a false
positive, now recorded in `knip.json` (see docs/verification.md).
As a gate, every false positive (a new hook entry point, a type-only file, an
external binary) would fail CI until someone taught `knip.json` about it,
and it isn't a dependency, so `npx` would fetch it on every CI run. Dead code
in a repo this size costs little and is visible in review.
**Revisit when:** A review or retro finds dead code (an unused export, file
or dependency) that shipped after this entry's date, or `npx knip` reports
real findings on two separate on-demand runs.
