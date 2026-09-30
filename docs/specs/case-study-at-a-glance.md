# Spec: "At a glance" summaries for System Design case studies

Status: approved 2026-09-29.

## Context

All 16 case studies are merged. They're thorough, but each is a 20–35 minute
read with no fast way in. A reader can't easily pull out the 45-minute interview
answer, or review a study the night before. The Instagram posts that inspired
the tab show the opposite trade-off: one screen, good for recall, but no
reasoning behind the choices. This change adds a one-screen, interview-ready
summary to the top of every case study, linked into the depth below it. It also
sets the length target that the follow-up trim pass will use.

## Design

A new required `## At a glance` heading comes after the intro paragraph(s) and
before `## Requirements`. The full template is:

`At a glance`, `Requirements`, `Back-of-the-envelope estimates`, `Data model`,
`API design`, `High-level architecture`, 2+ `Deep dive: …`,
`Failure modes and bottlenecks`, `Trade-offs`.

The section holds four parts, each a paragraph that starts with a bold lead-in
label, in this order, followed by a list:

1. **`**Requirements.**`**: 4–6 bullets covering the core functional and
   non-functional requirements, with their numbers.
2. **`**Key numbers.**`**: 4–5 bullets taken from the estimates, each with the
   one-line derivation (for example "≈ 115,000 redirects/s at peak (10× average)").
   Every figure must match the body.
3. **`**Key decisions.**`**: exactly 3 bullets, each "decision: one-line reason"
   and each linking to the section that argues it
   (`[…](#deep-dive-…)`).
4. **`**Likely follow-ups.**`**: 4–6 questions an interviewer typically asks
   next. Each gets a one-sentence answer and an in-page link to the section that
   answers it in full.

The section doesn't embed the architecture diagram, which is 1,000–2,000 px
tall. It ends with a sentence linking to `#high-level-architecture`. Target
length is about 250–400 words, one screen on a laptop.

**In-page links:** today `MarkdownRenderer`'s `a` override opens every href
that doesn't start with `/` in a new tab, including `#…`. A `#…` href must
instead render as a plain same-tab `<a href="#id">`, with no `target` or `rel`.
The app uses `BrowserRouter`, so the browser handles the scroll natively. The
Contents list already relies on those ids.

**Length target** (the add-case-study checklist): a full case study is about
5,000–5,500 words of prose, with 3 deep dives and 2 diagrams. This replaces
"about 4,500". It isn't enforced by a test, because orders 2–11 exceed it until
the trim pass.

## Acceptance criteria

1. The structure test fails a case study whose first `##` heading isn't
   `At a glance`. The rest of the template is unchanged. The test's own GOOD
   fixture includes the new heading.
2. The structure test fails an `At a glance` section that lacks any of the four
   bold lead-ins (`**Requirements.**`, `**Key numbers.**`, `**Key decisions.**`,
   `**Likely follow-ups.**`), or has them out of order.
3. The structure test fails when an in-page link (`](#id)`) anywhere in a case
   study's body doesn't match an id its headings render with. Ids are computed
   with `h2Headings` from `src/lib/headings.ts`, not a re-implementation.
4. The structure test fails an `At a glance` section with fewer than one in-page
   link in `Key decisions` or fewer than one in `Likely follow-ups`.
5. `MarkdownRenderer` renders `[x](#some-id)` as an `<a>` with `href="#some-id"`
   and no `target` or `rel` attribute. `/…` links still render as router
   `Link`s, and `https://…` links still open in a new tab with `rel="noreferrer"`.
6. All 16 case studies have an `At a glance` section that passes 1–4. Every
   figure in it matches the body, and it's held to the Writing Standard.
7. `docs/case-studies.md` (template list), `add-case-study/SKILL.md` (template
   and drafting steps, Stage 3 review prompt checks the summary against the
   body) and `add-case-study/checklist.md` (summary item, new length target) all
   describe the new section and target. The `content-review` eval's case-study
   scenarios still parse under the new template, updated if needed.
8. `npm run verify` passes.

## Scope

**In:** the structure test, the `MarkdownRenderer` `#` link change and its test,
docs and skill updates, the section for all 16 studies, and an eval fixture
update if one is needed.

**Out:**

- trimming orders 2–11 (a separate content pass right after this);
- a word-count check;
- any UI change beyond the link behavior (no new component; the section renders
  as ordinary markdown and appears in Contents automatically);
- `src/content/` topics.

## Files

- Tests (Stage 2): `src/system-design/case-study-structure.test.ts`,
  `src/components/MarkdownRenderer.test.tsx`
- Implementation (Stage 3):
  - `src/components/MarkdownRenderer.tsx` (the `a` override)
  - the 16 files under `src/system-design/case-studies/*.md`
  - `docs/case-studies.md`
  - `.claude/skills/add-case-study/SKILL.md` and `checklist.md`
  - `evals/content-review/` case-study scenarios, if they no longer fit the template
- Reuse: `h2Headings` and `headingId` (`src/lib/headings.ts`), and the existing
  `sections()` helper in the structure test.

## UI surface

Yes, but small: the new section and same-tab anchor links on the case-study
page. The Stage 4 browser check covers:

- clicking a follow-up link scrolls in the same tab;
- the Contents list shows "At a glance" first;
- both themes and a 375 px width.

## NON_NEGOTIABLES check

No conflict expected: no raw HTML, no new dependency, no content under
`src/content/`. Stage 4 re-checks.

## Verification

- `npm run test:run` for the new structure and renderer tests;
- `npm run verify`;
- the browser check in Stage 4;
- `check:test-lock` gates, as in the skill.
