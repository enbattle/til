# Spec: retire the template switch now the five-minute migration is done

Approved 2026-10-06.

## Context

`docs/specs/five-minute-templates.md` added a temporary per-page switch so that case studies and DSA entries could move to the five-minute template in batches. The frontmatter line `template: 2` opts a page into the new structure checks; a page without it keeps the old checks.

The migration is now complete:

- all 16 case studies and all 28 DSA entries carry `template: 2` (PRs #71–#80);
- the final content audit is merged (#81).

That spec scoped the cleanup out and said the last batch removes the switch, the old templates and the migration notes. This change does that. The five-minute template becomes the only template, and nothing marks a page as "new".

## Design

**One template per kind.** Each of the two structure tests keeps only its template-2 rules, which are unchanged:

- `src/system-design/case-study-structure.test.ts`
- `src/dsa/dsa-structure.test.ts`

These old-template parts are deleted:

- the old-template constants and checks: case studies' `At a glance` and `Deep dive` rules, and DSA's `Tricky lines`-era data-structure headings and three-pair `Walkthrough`;
- the `GOOD` fixture and its planted cases;
- the `fileProblems` branch on `template`.

Template-2 names lose the "2" (`template2Problems` becomes `structureProblems`, `GOOD_2` becomes `GOOD`), and each file's header comment describes the one template.

**Frontmatter keys are pinned (an allowlist).** Each structure test checks that a page's frontmatter keys are exactly the allowed set, so a stray or leftover key fails:

- case studies: `title`, `summary`, `date`, `order`;
- DSA entries: `title`, `summary`, `date`, `kind`.

The test names the file and the extra or missing key. This replaces the "unknown template value" rule: `template` is now just an extra key. The loaders (`parseCaseStudy`, `parseDsaEntry`) are unchanged.

**Content.** The `template: 2` line is removed from all 44 pages. No prose changes.

**Docs and process files:**

- docs/case-studies.md and docs/dsa.md:
  - drop the `template: 2` frontmatter line and the "Migrating (2026-10)" notes;
  - dsa.md also drops its migration merge table and the "Each merge below…" paragraph. The 28-entry list stays as the scope, and git history keeps the table.
- add-case-study and add-dsa-entry SKILL.md: drop `template: 2` from Stage 1, and drop any "rewrite to the five-minute template" wording that only made sense during the migration. A merge of DSA entries stays a supported task.
- content-audit SKILL.md: drop the "old 6,000-word template" batching note, and the "rewrite to the current template" exclusion in its description.
- README.md: the System Design bullet still describes the old shape ("deep dives, failure modes and trade-offs"). Describe the five-minute shape instead.
- evals: update any scenario or fixture that names `template: 2` or the migration table (SR scenario at evals/skill-routing/scenarios.md:354). Re-run only the affected scenarios.
- `MarkdownRenderer.tsx`'s comment cites "a case study's At a glance section" as its example of an in-page link. Use a current example.

## Acceptance criteria

1. **Case studies.** A case-study file is checked against the five-minute rules, which keep their current content. A file whose body passes today with `template: 2` still passes without the line.
2. **DSA entries.** The same holds for DSA entries, per kind.
3. **No old-template path.**
   - A case-study body in the old shape (`At a glance` first, `Deep dive:` sections) fails the heading-order rule.
   - A DSA data structure with a `Tricky lines` section fails its heading rule.
   - Each has a planted case in the test.
4. **Allowlist, case studies.**
   - Frontmatter keys exactly `title, summary, date, order` passes.
   - An extra key (`template: 2`, `tags: x`) fails, naming the file and the key.
   - A missing `order` fails, naming the file and the key.
   - Each has a planted case.
5. **Allowlist, DSA.** The same as criterion 4 with `title, summary, date, kind`, plus a planted case for each.
6. **Budget boundary.** It still holds for both kinds: exactly 1,150 words passes, and 1,151 fails, naming the count.
7. **Real content.** Every published case study and DSA entry passes, and none has a `template` line. `git grep -n "^template:" src` finds nothing.
8. **Docs.** No doc, skill, eval or the README:
   - tells a reader to add `template: 2`;
   - describes the switch;
   - describes the old template as current.

   The `docs/specs/*` files and `docs/pipeline-log.md` are history and stay as written. `npm run check:claude-md`, `check:npm-refs` and `format:check` pass.

## Scope

**In:**

- the two structure test files;
- the 44 content frontmatters;
- docs/case-studies.md and docs/dsa.md;
- the add-case-study, add-dsa-entry and content-audit skills, including add-case-study/checklist.md if it states the old template as current;
- README.md;
- the affected evals;
- one comment in MarkdownRenderer.tsx.

**Out:**

- any prose change to content;
- the loaders' behavior;
- the "N min read" label, `proseWordCount` and the `?words` view, which all stay;
- the catalog (`src/content/`).

**UI surface:** none. No browser check is needed in Stage 4.

**Roles:**

- The Stage 2 test-writer edits the two structure test files only. They go red on real content, because every file still has `template: 2`.
- The Stage 3 implementer removes the lines and does the docs.

## Non-negotiables check

- No conflict.
- #6 (raw HTML) and #3 (bundle) are untouched.
- Following the Stage 1 guard rule, the frontmatter check is an allowlist, not a list of known-bad keys.

## Verification

- **Stage 2:** the new allowlist tests fail on all 44 real files, because they have `template`. The planted cases fail for their stated reasons. Typecheck is clean.
- **Stage 3:** `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:** review the diff, no browser needed. Try adding a `template: 2` line and a `tags:` line to a scratch copy, and confirm each fails.
- **After merge:** run `docs-audit`, which is due (11 PRs since the last one), and do the browser check of the tall diagrams. Both are the remaining items of the promised final pass.

## Review decisions

- Known limitation: the frontmatter allowlist doesn't catch a duplicate key (the second value silently wins) or a line with no colon (skipped). Both come from `parseFrontmatter`, which predates this change and is shared with the loaders, so the loader sees the same keys the test does. Fixing it means changing the parser for every content kind, which is out of this spec's scope.
- Left for the user: `src/components/MarkdownRenderer.test.tsx` has a comment that still uses "a case study's At a glance section" as its example. The comment was there before this change and doesn't affect behavior. The file is locked, so changing it needs a test-writer run.
