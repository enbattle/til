# Spec: retire the case-study `template: 3` switch

Approved 2026-10-15.

## Context

`docs/specs/case-study-template-3.md` added a per-page switch so the 17 case studies could move to template 3 in batches:

- A page with `template: 3` is checked against template 3.
- A page without it keeps the old template.

That migration is done. All 17 pages carry `template: 3` (#138 and #142–#145), and the 32 catalog rewrites are merged (#141 and #146–#148). The template-3 spec scoped the cleanup out, saying "When the last page is rewritten, a cleanup change removes the switch and the old template." This change does that. It follows `docs/specs/retire-template-switch.md`, which retired the previous switch the same way.

At the user's request, the same PR also carries two follow-ups:

- a docs-audit run, which is overdue at 12 PRs;
- a content-review-eval CR-01 recheck, which the teaching-progression plan scheduled for after the rewrites.

Neither is part of the `/feature` stages. Both run after Stage 5, on the same branch.

## Design

**One template.**

- `src/system-design/case-study-structure.test.ts` keeps only template 3's rules, which are unchanged.
- These are deleted:
  - the old-template heading list and its branches in `structureProblems` and `fileProblems`;
  - the `GOOD` (old) fixture and its old-template-only planted cases;
  - the "no cross-over" cases.
- `GOOD_3` becomes `GOOD`, and the header comment describes the one template.

**Frontmatter is an exact allowlist again, with no optional keys.**

- The allowlist is `title`, `summary`, `date`, `order`.
- `template` is now an unknown key in both the loader (`parseCaseStudy` in `src/lib/system-design.ts`) and the structure test.
  - In the loader, `CASE_STUDY_ALLOWED`, `TEMPLATE_3` and the template-value check are removed.
  - `checkFields` (`src/lib/frontmatter.ts`) then throws on `template` as it does on `tags`, naming the file and the key.

**Content.** The `template: 3` line is removed from all 17 case studies. There are no prose changes.

**Docs and process files:**

- `docs/case-studies.md`:
  - The frontmatter example drops `template: 3`.
  - The key rule reads "these four keys and no others".
  - "The template is enforced, per page" becomes "The template is enforced", describing template 3 only.
  - The "old template" paragraph and the "Migrating (2026-10)" note are deleted. Social Feed stays the reference example.
- `docs/writing-standard.md`: delete the two "a page still on the old template…" sentences, in Teaching progression and in Case studies.
- `.claude/skills/add-case-study/SKILL.md` and `checklist.md`:
  - Stage 1's frontmatter loses `template: 3`.
  - Rewrite mode stays, as "rewriting an existing case study", like add-topic's rewrite mode, but it no longer points to the Migrating note. Its rules are kept inline: keep the file, slug, `order` and all content.
  - The review item drops "a page still on the old template…" and "on a `template: 3` page".
  - The description drops "to the current template" wording that only made sense during the migration.
- `evals/content-review/scenarios.md`: the Pastebin CS base drops its `template: 3` line, and the scenario text drops "(`template: 3`; …)". CS-01–04's replacements don't touch frontmatter, so they still apply.
- `evals/skill-routing/scenarios.md`: SR-22's retirement note replaces "Retiring the `template: 3` switch revisits that rewrite mode" with a line saying the switch is retired and rewrite mode stays for rewrites in general.
- `README.md`: no change. It already says "a ten-minute read following an enforced template".

## Acceptance criteria

1. **One template.** Every rule now passing on a `template: 3` page still passes on the same body without the line.
2. **No old-template path.** A body in the old order (Key numbers before the architecture, no `Start simple`) fails the heading rule. Each of these fails as it does today on template 3, with a planted case:
   - a missing `Start simple`;
   - `Key numbers` before the architecture;
   - two decisions;
   - four decisions.
3. **Structure-test allowlist.**
   - Exactly `title, summary, date, order` passes.
   - An extra `template: 3`, `template: 2` or `tags: x` fails, naming the file and the key.
   - A missing `order` fails, naming the file and the key.
4. **Loader.**
   - `parseCaseStudy` throws `"<name> has an unknown frontmatter field \"template\""` for `template: 3`, and for `2` and the empty value, exactly as for `tags` and `kind`.
   - The valid-fields case and the `order` cases are unchanged.
5. **Budget.** Exactly 2,300 words passes. 2,301 fails, naming the count.
6. **The other rules are unchanged on the one template.** Each of these still fails as before:
   - the Start-simple paragraph and code block;
   - Requirements count;
   - Key numbers shape;
   - rule of thumb;
   - follow-ups;
   - diagram;
   - broken in-page link.
7. **Real content.**
   - All 17 case studies pass.
   - `git grep -n "^template:" src evals` finds nothing.
   - `npm run verify` is green.
8. **Docs.** No live doc, skill or eval tells a reader to add `template`, describes the switch, or describes the old template as current.
   - `git grep -niE "template: 3|old template|Migrating \(2026" -- ':!docs/specs' ':!docs/pipeline-log.md' ':!**/results/**'` returns nothing stale.
   - `check:claude-md`, `check:npm-refs` and `format:check` pass.

## Review decisions

**Dropped at spec** (guard reject cases removed on purpose):

- **The old-template heading rule and its planted cases.** The old template is no longer accepted, so a body in that shape is covered by criterion 2.
- **The "no cross-over" cases** (case-study-template-3 criterion 7). With one template there is nothing to cross over to.
- **The loader's per-value template cases.** These were `'2'`, `'three'`, `''`, `'03'` and `' 3'`. They are replaced by criterion 4: `template` is rejected as an unknown key, whatever its value. No reject class is lost, because every value now throws.

## Scope and roles

**In:**

- the two test files (structure, loader);
- `system-design.ts`;
- the 17 frontmatters;
- the docs, skill and eval files above.

**Out:**

- any prose change to content;
- the catalog;
- the word budget;
- `readingMinutes`.

**UI surface:** none. No browser check at Stage 4.

**Roles:**

- **Stage 2 test-writer:** edits `case-study-structure.test.ts` and `system-design.test.ts` only. They go red on real content, since every file still has `template: 3`, and on the loader.
- **Stage 3 implementer:** writes the loader, the 17 frontmatters and every doc, skill and eval edit.

**Evals at Stage 5** (`evals/README.md`'s table):

- skill-routing-eval for the scenarios naming add-case-study, since its SKILL changed;
- content-review-eval CS-01–04, since the Writing Standard, checklist and CS base changed. CR-01 runs as well, as the bundled recheck.

## Non-negotiables check

There is no conflict. The frontmatter check stays an allowlist (the Stage 1 guard rule), and nothing touches #3 or #6.

## After Stage 5 (same branch, same PR)

1. **CR-01 recheck:** content-review-eval for scenario CR-01, logged in `evals/content-review/results/README.md` with the other CS runs.
2. **docs-audit:** the full skill, run on the post-change docs. Stale-fact fixes are applied. Duplication and restructuring suggestions, and the Stage 2b friction proposals if due, are listed for the user.

## Verification

- **Stage 2 gate:** `git status` shows test files only. The new tests fail on the 17 real files and the loader, and typecheck is clean.
- **Snapshot**, then Stage 3: `check:test-lock -- --verify`, then `npm run verify`.
- **Stage 4:** review of `npm run review:diff`. In a scratch copy, add `template: 3` and `tags:` lines to a case study and confirm each one fails in both the loader and the structure test.
- **Stage 5:**
  - `npm run verify`, then `check:test-lock -- --clear`;
  - the evals above;
  - the git grep from criterion 8;
  - then the docs audit's final gate.

## As built

- The loader calls `checkFields` with `allowed: CASE_STUDY_FIELDS`, as `content.ts` does for topics.
- Three stale mentions the spec's list missed were also updated:
  - CS-03's "with `template: 3` in its frontmatter" in the content-review scenarios;
  - SR-16's "moves a page to the current template" in the skill-routing scenarios;
  - the add-case-study checklist's "template 3's decision order".

## Review decisions (Stage 4)

Fix, no new test:

- content-audit's description still uses the migration-era wording, "a rewrite of one to the current case-study template".
- SR-19's pointer to the retired SR-22 is stale.
- A new skill-routing scenario, SR-23, covers routing "rewrite a case study from scratch" to add-case-study. No live scenario covered that.

These docs and eval edits were applied with the docs-audit fixes.

Known limitation:

- `frontmatterProblems` in `src/test/structure.ts` keeps an `optional` parameter that nothing calls now. It is dead but harmless, and the file is locked, so removing it needs a test-writer run for no behavior change.
