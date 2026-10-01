---
name: add-dsa-entry
description: Add a new entry to the DSA tab of this til repo (a data structure, pattern or algorithm under src/dsa/entries/, with its Python and TypeScript code and tests under src/dsa/code/), with an independent review against the Writing Standard and a DSA checklist before it's considered done. Use when the user asks to add, write or draft a DSA entry ("add the heap entry to DSA", "write up sliding window", "the next batch of DSA entries") — not for a catalog topic under src/content/ (that's add-topic), not for a System Design case study (add-case-study), not for checking or revising the writing of an entry that already exists (content-audit), and not for changes to the DSA pages, loader, code tabs or test tooling (that's app code: /feature).
---

# Add a DSA entry

A DSA entry is content, like a topic or a case study, so it gets the same
treatment as [`add-case-study`](../add-case-study/SKILL.md): no spec or TDD
of the app (there's no app behavior to pin down), but an independent review
before it's done. It gets its own skill because it has more ways to be wrong
than a topic: code that has to be correct and idiomatic in two languages,
tests that have to reach the edge cases, a walkthrough that has to explain
_why_ each line is written that way, complexity claims that have to hold, and
prerequisites that have to be real. The review below checks each of those.
See [docs/dsa.md](../../../docs/dsa.md) for the file layout, templates and
rules, and [docs/SDLC.md](../../../docs/SDLC.md) for why content gets this
lighter process.

The entry's own tests are written in the same pass as its code (Stage 1).
`/feature`'s locked-tests rule and `check:test-lock` don't apply here: nothing
in this skill runs under a test-lock snapshot. The independent check on the
tests is the Stage 3 reviewer, which judges whether they reach the edge cases.

## Stage 0 — Scope check

This skill adds one entry: `src/dsa/entries/<slug>.md` plus the four files
under `src/dsa/code/<slug>/`. If the request also needs a change to the DSA
pages, `src/lib/dsa.ts`, the code tabs, `scripts/test-python.mjs` or anything
else under `src/` or `scripts/`, stop: that's a `/feature`-shaped change. Never
edit files under `src/content/` or `src/system-design/` from this skill, and
don't edit another entry except to link to the new one from prose where it
belongs (a link from an older entry's `## Prerequisites` would make the older
entry depend on the newer one, so it goes elsewhere in the body).

`npm run test:py` needs Python 3.11+ with pytest (`python -m pip install -r
requirements-dev.txt`). If it isn't installed, say so and give that command;
don't finish an entry whose Python tests never ran.

## Stage 1 — Draft the code, its tests, then the entry

Write it yourself, directly, as `add-topic` does. Read the reference entry for
the kind first, `hash-map.md` (data structure), `two-pointers.md` (pattern) or
`binary-search.md` (algorithm), with its code files: they set the depth, the
tone and how a walkthrough explains a chunk.

1. **Code.** `src/dsa/code/<slug>/<slug_underscored>.py` (stdlib only, type
   hints, Python 3.11+) and `<slug>.ts` (no imports, exported API). Each is
   idiomatic in its own language, not a line-by-line transliteration of the
   other, but the APIs match in shape. Keep lines under 90 characters.
2. **Tests.** `test_<slug_underscored>.py` (pytest) and `<slug>.test.ts`
   (vitest), importing the real files. Cover empty input, single elements,
   duplicates, boundaries (the smallest and largest answers), the failure
   case (nothing found, a missing key), and where there's a brute-force or
   standard-library answer, compare against it on many seeded random inputs.
   Run `npm run test:py` and `npx vitest run src/dsa/code/<slug>` until both
   pass, and check that a deliberately broken line makes each fail.
3. **Entry.** `src/dsa/entries/<slug>.md`, slug kebab-case. Frontmatter
   `title`, a one-sentence `summary`, `date` (today) and `kind`. The `##`
   headings are the kind's template from docs/dsa.md, exactly. Then:
   - **Prerequisites** links only the entries the prose really needs
     (`[Hash map](/dsa/hash-map)`), each with a phrase saying what it's needed
     for; with none, say so and name the basics assumed. Link only entries
     that exist (`ls src/dsa/entries/`).
   - **Code chunks** are copied from the finished code files, in file order,
     as pairs: a ` ```python ` fence directly followed by a ` ```typescript `
     fence. Every non-blank line of each file appears once, in order.
   - **Walkthrough** (pattern, algorithm): at least three pairs, each followed
     by a paragraph that explains why those lines are the way they are, for a
     reader with zero background: what would break with the obvious
     alternative (`<=` for `<`, `mid` for `mid + 1`), not a restatement of
     what the line does. **Implementation** (data structure) does the same
     where it helps, and **Tricky lines** names the specific lines.
   - Work a small concrete example by hand (a table of pointer positions, the
     buckets after three inserts) and recompute it before moving on.
   - **Complexity** and **Operations and costs** give time and space with the
     reason, not just the answer, and every figure is checked.
   - Link a catalog topic where the prose uses it, as `[text](/<section>/<slug>)`
     (`ls src/content/*/`); nothing checks these links, so confirm each one.
   - Claims about a language or library (what `bisect_left` returns, Java's
     default load factor) are verified, not remembered.

If the angle is genuinely ambiguous (which variant to implement, which API
shape), ask the user rather than guess.

## Stage 2 — Self-check

```bash
npm run verify
```

`dsa-structure.test.ts` (the heading template, pairs where they belong, a
paragraph after each walkthrough pair), `dsa-code-chunks.test.ts` (the chunks
equal the code files), `dsa.test.ts` (frontmatter, prerequisites that exist
and form no cycle), the entry's own vitest and pytest files, and
`check:bundle` (the body stays out of the main chunk) catch the structural
problems. An entry never needs a new test outside its own code folder.

## Stage 3 — Independent review

Spawn a **fresh** `general-purpose` agent (never `fork`: it must not inherit
your own read of the draft). Give it: the entry's full content; the full
content of its four code files; `docs/writing-standard.md`; the path of
`docs/NON_NEGOTIABLES.md`; the titles and slugs of the existing entries (for
a near-duplicate check); and this instruction, close to verbatim:

> Review this new DSA entry and its code adversarially against the Writing
> Standard below and the DSA checklist after it; assume nothing about it is
> fine until you've checked it yourself. Read docs/NON_NEGOTIABLES.md first;
> a violation of any line there is always a real finding. Writing Standard:
> are terms defined before they're used, would a reader with zero prior
> background follow it, does it use concrete worked examples rather than
> staying abstract, is the frontmatter `summary` one scannable sentence, does
> the prose read as something a knowledgeable person wrote rather than
> generically AI-patterned, is any figurative phrase over-explained, and is
> every substantive technical claim actually true rather than confidently
> stated. DSA checklist: (1) the code is correct in both languages: trace it
> by hand on the entry's worked example and on the edge cases (empty input,
> one element, duplicates, the boundaries), and flag any input it gets wrong;
> (2) the code is idiomatic in each language rather than a transliteration of
> the other; (3) the tests reach the edge cases, not just the happy path: name
> any realistic bug (an off-by-one, a missed empty case) the tests would not
> catch; (4) each walkthrough or implementation paragraph explains why its
> lines are written that way, not only what they do; flag one that just
> narrates; (5) every complexity claim is right, with its reason, and every
> worked example's numbers are right: recompute them; (6) each prerequisite
> is one the prose really needs, and nothing the prose relies on is missing
> from the prerequisites; (7) every claim about a language, library or
> standard function is true. Also check it isn't a near-duplicate of an
> existing entry (listed below). For each finding, quote the text or code, or
> name a realistic input that breaks it; label anything else "theoretical".
> Re-raise a decision listed below as already made only with new evidence.
> Do not edit any file; review only. Report findings ranked by severity,
> quoting the text and saying what's wrong and what's true, or say explicitly
> that you found nothing worth flagging.

- No findings, or only cosmetic ones → done, go to Stage 4.
- Real findings → finding triage, then fix. Confirm each against the files
  yourself, and give it one of `/feature` Stage 4's outcomes; record each
  Reject and Known limitation with a one-line reason in the handoff, and give
  the re-review that list. A Reject must quote the text or code that
  disproves the finding. Fix the rest yourself (a code fix changes the code
  file and its chunk together, plus a test that would have caught it), then
  re-run this stage with a new fresh agent on the updated files. **Cap at 2
  rounds**, matching `add-topic`, `add-case-study` and `/feature`'s fix
  loops. If findings persist after the second round, stop and surface them
  to the user rather than continuing to iterate alone.

## Stage 4 — Final gate

Delete any `__pycache__` or `.pytest_cache` a manual pytest run left (the
code-folder allowlist test fails on them), then re-run `npm run verify` on the
final version and confirm it's green. Confirm
`git status --porcelain -- src/content src/system-design` prints nothing (an
entry never edits a topic or a case study). Summarize the entry and the review
outcome for the user. Append a row for this run to
[docs/pipeline-log.md](../../../docs/pipeline-log.md) (its header defines the
columns; Run is `add-dsa-entry src/dsa/entries/<slug>.md`, Retro is `n/a`,
Gate failures counts failed `verify` runs, Agents counts every agent you
started, a batch drafter included), then run
`npx prettier --write docs/pipeline-log.md` and `npm run check:pipeline-log`.
The row goes in the entry's commit, together with the `.md` and the four code
files. Ask before committing or pushing: this skill leaves the working tree
ready, it doesn't ship it.

## Batch mode — several entries at once

The roadmap in docs/dsa.md is added in batches.

1. Order the batch so every prerequisite is written before the entries that
   link to it; an entry can only link to one that exists.
2. One drafter agent per entry, in parallel, each in its own worktree
   (`isolation: "worktree"`), runs Stages 0–2 only. A drafter whose entry
   needs another entry from the same batch gets that entry's slug and title
   and links to it; its own `verify` fails on the unknown prerequisite until
   integration, which is expected and the only failure it may leave.
3. Each entry gets one fresh Stage 3 reviewer, whose instruction adds:
   "Report only High and Medium correctness findings."
4. Its findings go through Stage 3's finding triage. You apply the fixes once,
   with no re-review of that round (Fix rounds `1`); a High found then goes to
   the user.
5. Integrate: copy each entry's `.md` and code folder from its worktree, run
   `npm run verify`, and add one pipeline-log row per entry.
6. After the user's go-ahead, open one pull request for the batch, then remove
   the worktrees and their `worktree-agent-*` branches.
