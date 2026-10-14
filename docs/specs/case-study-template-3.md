# Spec: case studies get a ten-minute budget and a teaching-progression template

Approved 2026-10-14.

## Context

Audits on 2026-10-14 scored the case studies about 2.8 out of 5 for a beginner, against about 4.1 for catalog topics. The template causes much of the gap:

- `Key numbers` sizes parts before the architecture introduces them.
- The architecture is a single paragraph naming about 10 parts.
- No section shows a simple design first.
- Each decision leads with its clever choice.
- Every page is written to the 1,150-word cap.

PR #137 added the Writing Standard's "Teaching progression" rules. This change gives case studies a template that follows them, and a ten-minute budget so all current content can stay.

The user chose:

- a per-page switch, so the 17 existing pages keep passing until each is rewritten (precedent: `docs/specs/five-minute-templates.md`, retired by `retire-template-switch.md`);
- rewriting Social Feed in this change, as the first new-template page and its reference example;
- rewriting the content-review eval's Pastebin fixture to the new template in this change.

The catalog is unchanged: `CATALOG_WORD_BUDGET` stays 1,000.

## Design

**The switch.** A case study with the frontmatter line `template: 3` is checked against the new template. A page without it keeps today's checks. When the last page is rewritten, a cleanup change removes the switch and the old template, as `retire-template-switch.md` did.

- `parseCaseStudy` (`src/lib/system-design.ts`) accepts `template` as an optional key whose only valid value is `3`.
- Any other value throws, naming the file and the field: `2`, `three`, or an empty value.
- `checkFields` already separates `required` from `allowed`.

**Budget.** `WORD_BUDGET` = 10 × `WORDS_PER_MINUTE` = 2,300 words, for every case study on either template. Old-template pages are all at most 1,150, so they pass. The Writing Standard's "Case studies" section says "about ten minutes, at most 2,300 words", and aims for roughly 1,700–2,000 so pages aren't padded to the cap.

**Template 3.** The `##` headings, exactly and in order:

1. `Requirements`
2. `Start simple` or `Start simple: <topic>`
3. `High-level architecture`
4. `Key numbers`
5. `API and data model`
6. three `Decision: <topic>` headings
7. `Likely follow-ups`

The rules for each section:

- **Kept as today:**
  - the intro paragraph;
  - Requirements: 4–6 items;
  - Key numbers: a paragraph, then 4–5 bold `Label:` items;
  - each decision ending with a `**Rule of thumb.**` paragraph;
  - Likely follow-ups: 4–6 bold items;
  - the architecture diagram with alt text;
  - in-page links that resolve;
  - the word budget.
- **New and tested:** `Start simple` holds at least one paragraph and at least one fenced code block (the worked arithmetic showing where the simple design breaks).
- **New and doc-only (docs/case-studies.md; enforced by review):**
  - the intro states the interview question, a one-sentence overview and the route through the page;
  - "Start simple" shows the naive design working, then breaking on this design's numbers;
  - the architecture is the diagram plus two or three short paragraphs (for example the write path, then the read path), each with at most two new terms;
  - Key numbers size parts the reader has now met, each derivation written out step by step;
  - each decision is ordered simpler option → where it breaks, with numbers → the choice → its cost → rule of thumb, in about 150–300 words;
  - follow-ups introduce no new concept without a gloss and a link.

## Acceptance criteria

1. **The budget.** `WORD_BUDGET` is 2,300, and `readingMinutes(2300)` is 10. `CATALOG_WORD_BUDGET` stays 1,000.
2. **The budget boundary on both templates.** An old-template body of exactly 2,300 words passes and one of 2,301 fails, naming the count. The same holds for a template-3 body.
3. **The loader's switch.**
   - `parseCaseStudy` accepts `template: 3`.
   - It throws, naming the file and `template`, for `template: 2`, `template: three` and an empty template.
   - It still throws for `tags` and `kind`.
   - The returned case study's shape is unchanged: no `template` field leaks into the metadata.
4. **The structure test's allowlist.**
   - Frontmatter of exactly title, summary, date and order passes.
   - The same four plus `template: 3` passes.
   - An extra `tags` key fails, naming the file and the key.
   - A missing `order` fails, naming the file and the key.
5. **The old template is unchanged for pages without the key.** Every current old-template planted case still fails exactly as before.
6. **Template 3.**
   - The GOOD_3 fixture passes.
   - Each of these fails the heading rule:
     - a template-3 page in the old order;
     - `Start simple` missing;
     - `Key numbers` before `High-level architecture`;
     - `Start simple` after the architecture;
     - two decisions;
     - four decisions.
   - `Start simple: the naive feed` is accepted as the heading.
   - A `Start simple` section with no fenced code block fails, and so does one with no paragraph.
   - Each of these keeps failing on a template-3 page as it does today: the Key numbers rules, the Requirements count, the rule of thumb, the follow-ups, the diagram and broken in-page links.
7. **No cross-over.**
   - A page without `template` laid out in the template-3 order fails the old heading rule.
   - A `template: 3` page in the old order fails the template-3 heading rule.
8. **Real content.**
   - `src/system-design/case-studies/social-feed.md` carries `template: 3` and passes.
   - The other 16 pages pass the old template unchanged.
   - `npm run verify` is green.
9. **The Social Feed pilot.** All current content stays:
   - every requirement, number, decision, rejected alternative and follow-up;
   - the 2⁵³ cursor note;
   - the likes queue.

   It is rewritten to template 3 and every Teaching progression rule:
   - a route sentence in the intro;
   - a "Start simple" section that shows read-time pull breaking on 116 million lookups a second, worked step by step;
   - the architecture split into short paragraphs with at most two new terms each;
   - all arithmetic shown;
   - each decision ordered simpler option → breaks → fix → rule.

   It stays within 2,300 words. Its two diagrams are kept or adjusted (d2 v0.9.0 is installed), and `check:diagrams` passes.

10. **Docs.**
    - docs/case-studies.md:
      - the intro says "about ten minutes";
      - it describes the switch, template 3 (with Social Feed as its reference example) and the old template, labelled as being migrated;
      - it adds a "Migrating (2026-10)" note on how to move a page.
    - docs/writing-standard.md:
      - the "Case studies" budget bullet says ten minutes and 2,300 words;
      - the Teaching progression paragraph about case studies describes template 3's order.
    - add-case-study SKILL.md and checklist.md:
      - drafts use `template: 3` and template 3, with Social Feed as the reference;
      - a rewrite of an existing case study to the current template is in scope, so the description is updated;
      - the length and decision guidance becomes 150–300 words per decision;
      - "five-minute" is gone.
    - README.md: "a ten-minute read".
    - reading-time.ts comments are updated.
    - No live doc describes case studies as five-minute reads (`docs/specs/**` and `docs/pipeline-log.md` are history).
    - `check:claude-md`, `check:npm-refs` and `format:check` pass.
11. **Evals.**
    - The content-review CS base (Pastebin) is rewritten to template 3 and the Teaching progression rules, within the budget.
    - CS-01, CS-02 and CS-04's replacements still apply verbatim to the new base and plant the same problems.
    - CS-03's control description is updated to the new figures.
    - The scenario prose drops "five-minute".
    - A new skill-routing scenario, SR-22 ("rewrite the ride-sharing case study to the new template" → `add-case-study`), replaces the retired SR-19's purpose.

## Review decisions

**Dropped at spec:** guard reject cases removed on purpose.

- The loader's and the structure test's rejection of `template` as an unknown key, for the value `3` only. That value is the switch. Every other `template` value is still rejected (criterion 3).

**Known limitation** (Stage 4, round 1 re-review):

- The Start simple rule's "at least one paragraph" counts a paragraph holding only a non-diagram image (`![x](/images/x.png)` renders `<p><img></p>`). A diagram-only paragraph already fails, since `MarkdownRenderer` renders a `/diagrams/` image paragraph without a `<p>`, and no case study uses a non-diagram image.

**Decisions** (Stage 4, round 2 re-review):

- Known limitation: "code block" in Start simple's rule includes an indented block, not only a fenced one (criterion 6 says "fenced"). docs/case-studies.md and the test agree on "a code block"; both render as `<pre><code>`, so telling them apart would need the markdown source, and an indented block is still excluded from the word count.
- Reject: SR-16 drifting to add-case-study's rewrite mode. Its prompt asks to tighten the writing and names no template; add-case-study's description excludes prose-only revisions. Stage 5's skill-routing run includes SR-16.

**Decisions** (Stage 4, round 3 re-review):

- Accepted: Social Feed's timelines decision no longer gives the tombstone reason against a wide-column store. Round 2's triage found it inaccurate as stated (a few hundred tombstones at a timeline's tail, which a newest-first read barely touches), and criterion 9 keeps content, not a weak claim. The old latency reason was false against the 200 ms target and was replaced by the machine-count argument.
- Known limitation: a duplicate `template` key resolves to its last value (`parseFrontmatter`, which predates this change), so `template: 2` followed by `template: 3` passes. No author following docs/case-studies.md writes the key twice.

**Decisions** (Stage 4, round 5 narrow check; rounds 3–5 were user-authorized past the cap of 2):

- Deferred to the Social Feed pilot review (plan step 3), where the user reviews the page before the batch: one sentence glosses both the outbox pattern and the relay, and "event" has no gloss (Medium); "API" unglossed; "celebrity" used before decision 1 defines it; "The relay publishes it" points back to the follow's event rather than @maya's; the author's own timeline insert sits outside the single write; a follow's two directional rows could sit on different shards; 2,063 words, above the 1,700–2,000 aim. None changes a decision or the arithmetic.
- Deferred to before the next CS-\* eval run: the Pastebin base draws the same true template-3 findings in all four Stage 5 reviews (no one-sentence overview in the intro, Start simple breaking only on what decision 3 fixes, three new terms in architecture paragraph 2, "4 GB" before Key numbers, no load-balancer link, decision 3 without a guessing target). Every plant still ranked first, so the eval passed; the control is weaker than it should be. Logged in evals/content-review/results/README.md.

## Roles and stages

- **Stage 2 (test-writer)** owns:
  - `src/lib/reading-time.test.ts`;
  - `src/lib/system-design.test.ts`;
  - `src/system-design/case-study-structure.test.ts`, including the GOOD_3 fixture and the template-3 planted cases;
  - `src/test/structure.ts`, if `frontmatterProblems` needs a required/optional split;
  - `CaseStudyPage.test.tsx`, only if a 1,150 pin needs the new budget.
- **Stage 3, split into two roles:**
  - The **owner implementer** writes:
    - `reading-time.ts` and `system-design.ts`;
    - every doc and skill in criterion 10;
    - the SR-22 scenario;
    - the evals' "five-minute" wording.
  - One **content agent** gets the spec, NON_NEGOTIABLES, the Writing Standard and only its own files. It writes:
    - `social-feed.md` and its `.d2` files and renders;
    - the content-review CS base fixture and the replacement and control texts that depend on it.
- **UI surface: yes**, a content change only. Stage 4 opens /system-design/social-feed in both themes at 375 px and the widest layout, checks the "10 min read" label and both diagrams, and holds the prose to the Writing Standard.
- **Evals at Stage 5:**
  - content-review-eval: CS-* (the checklist, the Writing Standard's Case studies section and the fixture changed);
  - skill-routing-eval: the scenarios naming add-case-study, plus SR-22 (the SKILL and CLAUDE-routed docs changed).

**Out of scope:**

- rewriting the other 16 case studies (the next batches);
- the catalog;
- retiring the switch (after the last batch).

## Verification

- `npm run check:test-lock -- --verify`, then `npm run verify`, then `npm run diagrams` and `npm run check:diagrams` for Social Feed.
- `git grep -niE "five[- ]minute" -- ':!docs/specs' ':!docs/pipeline-log.md' ':!**/results/**'` returns only unrelated uses.
- Manual check: the dev server; Social Feed shows "10 min read" or less; both themes; 375 px.
