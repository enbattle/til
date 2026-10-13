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

**Why deferred:** Claude Code's PreToolUse hooks **fail open on timeout**,
and `npm run verify` can exceed the hooks' 10-second timeout, so the hook
would silently stop blocking the first time a check ran slow. A version gating
only the fast checks is trivially bypassed and duplicates the skills' own
final gate. The server-side layers already cover it and don't fail open:
branch protection with every change landing through a pull request
(CLAUDE.md, "How changes land"), and the deploy workflow running
`npm run verify` before publishing.
**Revisit when:** The server-side layers prove insufficient in practice: a
commit that fails `verify` goes live despite the deploy gate, or red commits
on `main` keep costing enough (broken history to bisect, reverts) that
catching them before the push is worth the hook's complexity.

### LLM-as-judge with a CI-gated automatic threshold

**What it is:** Running eval scenarios automatically on every push/PR,
graded by another model, with a required pass threshold blocking merge —
the automated version of what the eval skills (see `evals/README.md`)
currently do manually.
**Why deferred:** A run costs real time and tokens per scenario, for a
personal site's process check rather than a safety-critical gate
(`evals/README.md`, "How this is run"), and a gate would need a tolerance for
grading errors that manual runs don't.
**Revisit when:** Manual runs are missed often enough that real routing or
review-quality drift goes unnoticed for a long stretch.

### Sandboxed/ephemeral execution per agent run

**What it is:** Running each agent invocation in an isolated, disposable
environment (a container, a fresh VM) rather than directly against the
working machine.
**Why deferred:** `til` is a static site with no backend, no secrets of
consequence and a single operator. Its one real blast radius, a push to
`main` deploying the site, is covered without a sandbox: `.claude/settings.json`
denies force-pushes and asks before any `git push`, and the deploy workflow
runs `npm run verify` before publishing. The rules are a guardrail matched on
command text, not a security boundary: each is written for both the Bash and
PowerShell tools, but forms like `git -c key=value push` or a quoted `'push'`
slip past them.
**Revisit when:** This repo (or a fork of it) starts running agents
against something with real blast radius — deployment credentials,
production data, another system's API keys.

### Knowledge graph / semantic code index for agent context

**What it is:** A derived index sitting between an agent and the
codebase — embeddings for RAG-style retrieval, a symbol/dependency
graph, or a generated repo map — so a session queries a compressed
representation instead of reading source files fresh each time.
**Why deferred:** `src/` is small enough that `CLAUDE.md` plus `Glob`/`Grep`
orient a fresh session quickly, and a derived index is a second copy of the
truth that goes stale like a hand-duplicated doc does. (A graph of published
topics for readers is a product-scope call, covered by `CLAUDE.md`'s scope
exclusions.)
**Revisit when:** `CLAUDE.md` plus `Glob`/`Grep` stop being enough to orient
a fresh session quickly.

### Prompt/spec diff-review enforcement (e.g., a hook flagging an eval scenario file edit)

**What it is:** Treating changes to eval scenario files or skill prompts
with the same enforced review rigor as source code — e.g., a hook that
flags when `evals/**/scenarios.md` changes without a corresponding
results-log entry.
**Why deferred:** The eval skills' "add a scenario first" step and the
`nudge-sdlc` hook's reminder on skill, hook and process-doc edits (not
`evals/` files) already cover most of it, and that discipline hasn't been
skipped in practice in a solo repo.
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
**Why deferred:** As a gate, every false positive (a new hook entry point, a
type-only file, an external binary) would fail CI until `knip.json` learned
it, and `npx` would fetch it on every run; dead code in a repo this size costs
little and is visible in review. It runs on demand (docs/verification.md);
the first hand run, on 2026-09-28, found only a few internal-only exports
(since removed) and false positives, now in `knip.json`.
**Revisit when:** A review or retro finds dead code (an unused export, file
or dependency) that shipped after this entry's date, or `npx knip` reports
real findings on two separate on-demand runs.
