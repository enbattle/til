---
name: docs-audit
description: Audit every documentation file in this repo (CLAUDE.md, README.md, docs/**, evals/**, every SKILL.md) against the current code, config, and process for staleness — a fact that's no longer true, a convention nothing describes, a reference to something removed. Use when asked to check for stale docs, after a batch of changes has landed, or when nudged by the nudge-precommit hook before a commit/push.
---

# Docs audit

Manual/periodic, same cadence philosophy as the `evals/` suite — not run
on every commit (`.claude/hooks/nudge-precommit.js` reminds a session to
_consider_ it before shipping, it doesn't run it automatically, because a
full-repo audit is too slow and too much to review to fire on every
commit without it becoming noise people start ignoring).

## Why an independent read, not a self-check

Whoever just made a change is the worst-positioned person to notice a
doc gap it left behind — they already hold the new state in mind, so an
omission looks unremarkable to them the same way a typo you just typed is
invisible to your own proofreading. That's exactly the bias a fresh
`general-purpose` agent (never `fork`) removes: no memory of what was
just built, so a stale claim reads as wrong on sight instead of "obviously
fine, I was just there."

## Stage 1 — Enumerate the documentation surface

List every file this audit covers (do this yourself, mechanical, no bias
risk) — re-glob at run time rather than trusting this list to have stayed
complete, since a category being missing here is itself exactly the kind
of staleness this skill exists to catch:

- `CLAUDE.md`, `README.md`
- everything under `docs/`
- everything under `evals/` (`README.md`, every scenario/how-to-run file,
  and the `results/` logs)
- every `SKILL.md` under `.claude/skills/`, and the reminder text in
  `.claude/hooks/*.js` (it names skills and docs, so it can go stale the same way)
- (explicitly **not** in scope: `src/content/**` and
  `src/system-design/questions/**` — the published topic and question
  files themselves. Their prose quality against the Writing Standard is
  `content-audit`'s job, not this skill's.)
- explanatory comments in `.github/workflows/*.yml` and
  `.github/dependabot.yml` — these describe _why_ a CI/CD choice was
  made, which goes stale exactly like prose documentation does
- the descriptive text duplicated across `package.json`'s `description`,
  `index.html`'s meta tags, and `README.md`'s intro line — these repeat
  the same fact in multiple places by necessity (SEO/social-preview tags
  can't reference another file), so check they still agree with each
  other rather than just checking each is internally plausible

## Stage 2 — Independent audit

Spawn a **fresh** `general-purpose` agent. Give it the file list from
Stage 1 and this instruction, close to verbatim:

> Read every file listed below in full. For each one, extract every
> checkable claim it makes — a specific file/folder path, a specific
> command, a specific list (section names, skill names, npm scripts), a
> cross-reference to another doc or skill, a description of a process or
> convention — and verify it against the actual current state of the
> repository (read the referenced files, check `package.json`'s scripts,
> check `src/content/registry.ts`, list `.claude/skills/`, etc. — don't
> assume, check). Report every claim that's now inaccurate, incomplete,
> or references something that no longer exists, with: which file, the
> claim as written, what's actually true now, and a suggested fix. Also
> flag any doc that hardcodes a fact that's really owned by code
> elsewhere (a duplicated list, a copied value) as a candidate to instead
> reference the source, the same way `README.md`'s Features section
> points at `registry.ts` instead of naming sections directly — that
> class of fix prevents the same staleness from recurring, not just
> patches it once. **Separately, also flag a fact that's hand-duplicated
> across two or more docs with no single canonical source** (as opposed
> to a doc restating something code owns) — e.g. the same named list
> spelled out independently in more than one file — even if every copy
> currently agrees with every other one; the risk here isn't that one is
> wrong yet, it's that nothing stops the next edit from updating only one
> copy. Name every location the fact appears and suggest which one should
> become canonical. Do not edit anything — audit only. Report findings
> ranked by how misleading they'd be to someone reading the doc cold, or
> say explicitly you found nothing worth flagging.
>
> `docs/specs/*.md` are records of what was decided at a point in time, and
> `evals/*/results/*.md` and the rows of `docs/pipeline-log.md` are dated run
> logs: don't flag them for describing the past, but do flag one that states something as a present-tense rule that is
> now wrong.
>
> Files to audit: <Stage 1's list>

## Stage 3 — Apply fixes

Confirmed findings are low-risk text edits (not behavioral code), so
apply them yourself directly — no separate fix agent needed, the
independent audit in Stage 2 already was the check. For a finding you
disagree with or that needs a judgment call the audit agent couldn't
make (e.g. which of two conflicting descriptions is actually correct),
resolve it yourself or ask the user rather than applying it blindly.

## Stage 4 — Final gate

```bash
npm run format:check
npm run check:tokens
npm run check:npm-refs
```

The latter two are exactly this skill's own failure mode caught
mechanically — run them even though Stage 2 already checked by hand, the
same reasoning `/feature`'s Stage 5 re-runs its full suite instead of
trusting an earlier stage's self-report.

(Run `npm run verify` instead if any fix touched actual code rather than only
documentation.)

Append a short dated entry to `evals/docs-audit/results/<YYYY-MM-DD>.md`
(trigger, files audited, findings, what was fixed, what was left open), so
whether an audit happened after a batch of changes is checkable later.

Summarize for the user: what was audited, what was found, what was
fixed, and anything left open for their judgment. Ask before committing
or pushing, same as always — this skill leaves the working tree ready,
it doesn't ship it.
