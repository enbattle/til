# Spec: one definition each for tabs, page paths, numbering and modals

Status: approved 2026-10-12.

Saved on approval as `docs/specs/ui-dedupe.md`. Branch `refactor/ui-dedupe`, from `main`.

## Context

This is the UI half of step 4 of this session's cleanup order. The content half merged as #123. The redundancy audit found the following.

- **Tabs and their routes are defined in five places.**
  - `Header.tsx:40` holds the `TABS` list.
  - `src/lib/tabs.ts` holds `tabForPath`.
  - `isSystemDesignPath` (`system-design.ts:144`) and `isDsaPath` (`dsa.ts:241`) exist only for `tabs.ts`.
  - `App.tsx` holds the routes.
  - Tab selection is tested in six places: the two predicates, `Header.tabs` against `Header.dsa`, two App sidebar tests, and two MobileNav tests.
- **Page paths are built by hand.** `` `/system-design/${slug}` `` and `` `/dsa/${slug}` `` appear 11 times across `CaseStudyNav`, `DsaNav`, `search.ts`, `CaseStudyPage`, `DsaEntryPage`, `DsaPage`, `SystemDesignPage` and `TopicPage`. Topic paths are built the same way in about 6 more places.
- **DSA's running number is computed twice:** `++number` in `DsaNav.tsx:14` and in `DsaPage.tsx:35`.
- **Modals repeat the same setup.**
  - `MobileNav.tsx:9` copies `FOCUSABLE_SELECTOR` from `useFocusTrap.ts:3`.
  - `MobileNav` and `SearchDialog` each set up their own Escape listener and initial-focus effect.
- **Tests repeat each other.**
  - "On this page" is re-tested for one case study (`App.system-design.test.tsx:127-175`) and one DSA entry (`App.dsa.test.tsx:156-184`), on top of `App.on-this-page.test.tsx`'s `describe.each(PAGES)`.
  - Prev/next adjacency and "unknown slug → not found" are each tested separately per kind.
  - `CaseStudyNav.test.tsx` and `DsaNav.test.tsx` both test shared `OrderedNav` behaviour.
- **Small repeats.**
  - `TOPICS.filter(t => t.section === …)` appears in `HomePage`, `SectionPage` and `TopicPage`, although `topicsBySection()` exists.
  - `HomePage`'s `totalTopics` is a reduce that equals `TOPICS.length`.
  - The allowed-value arrays in `ThemeContext.tsx` and `CodeLanguageContext.tsx` duplicate the union types in `useTheme.ts`/`useCodeLanguage.ts` and `CodeTabs.tsx`'s `CODE_LANGUAGES`.

The outcome is one definition of each, with behaviour and visuals unchanged.

## Design

1. **Tabs.** `src/lib/tabs.ts` exports `TABS = [{ id, label, to }]` in header order. `tabForPath(pathname)` returns the tab whose `to` equals the path or prefixes it as `<to>/…`; anything else is `catalog`. `Header` maps over `TABS`. `isSystemDesignPath` and `isDsaPath` are removed, along with their tests.
2. **Paths.** Each loaded item carries its page path:
   - `Topic.path` is `/<section>/<slug>`.
   - `CaseStudy.path` is `/system-design/<slug>`.
   - `DsaEntry.path` is `/dsa/<slug>`.
   - The loaders set it, and every component, page and `search.ts` uses `item.path`.
   - Section paths (`/<section>`) and tab paths stay as they are.
3. **Numbering.** `DsaEntry.number` (1-based, across groups in `DSA_ENTRIES` order) is set once in `dsa.ts`. `DsaNav` and `DsaPage` read it.
4. **Modal behaviour in one hook.**
   - `useFocusTrap` (or a `useModal` beside it) owns:
     - the single `FOCUSABLE_SELECTOR`
     - Tab trapping
     - Escape → `onClose`
     - initial focus: a given ref, or else the first focusable element
   - `MobileNav` and `SearchDialog` use it, and neither keeps its own Escape listener or selector.
   - This follows the WAI-ARIA APG modal dialog pattern:
     - On open, focus moves inside: the search input for search, the first focusable element for the mobile nav.
     - Tab and Shift+Tab stay inside.
     - Escape closes.
     - On close, focus returns to the element that opened it.
5. **Small repeats.**
   - `HomePage`, `SectionPage` and `TopicPage` use `topicsBySection()`, or a `topicsInSection(id)` added to `content.ts`.
   - `totalTopics` becomes `TOPICS.length`. First the test confirms every topic belongs to a registered section, which `registry.test.ts` already pins.
   - Theme and code-language values come from one `as const` array each, with the union type derived from it.
6. **Tests** (Stage 2's work):
   - One table test of `tabForPath` over representative paths, plus one App test per tab, replaces the six.
   - The duplicate "on this page" tests in `App.system-design` and `App.dsa` go.
   - Prev/next and not-found each become a `describe.each` over the three kinds.
   - One `OrderedNav.test.tsx` holds the shared nav behaviour: landmark name, `aria-current`, `onNavigate`, `className`, nothing current on the landing page. `CaseStudyNav` and `DsaNav` tests keep only their own data and order.
   - Each removal is listed with what covers it now.

## Acceptance criteria

1. **Tabs:**
   - `tabForPath` maps `/`, `/networking`, `/networking/dns`, `/system-design`, `/system-design/x`, `/dsa`, `/dsa/heap`, `/dsa-notes` (catalog) and `/system-designer` (catalog) correctly.
   - The header renders the three tabs from `TABS` in order, with `aria-current` on the right one for each route.
   - The sidebar and the mobile nav show the matching nav.
2. **Paths:** every `TOPICS`, `CASE_STUDIES` and `DSA_ENTRIES` item's `path` equals its route. Every rendered link to a topic, case study or entry (nav, landing cards, prev/next, prerequisites, "Go deeper", search results) points to `item.path`. Orchestrator check: a repo grep for `` `/dsa/${`` and `` `/system-design/${`` in non-test source finds nothing.
3. **Numbering:** `DSA_ENTRIES[i].number === i + 1`. The landing page and the sidebar show the same numbers as today.
4. **Modals:**
   - For the mobile nav and for search:
     - on open, focus lands on the specified element;
     - Tab from the last focusable element wraps to the first, and Shift+Tab wraps back;
     - Escape closes;
     - on close, focus returns to the opener.
   - Only one `FOCUSABLE_SELECTOR` definition exists (orchestrator grep).
5. **Small repeats:** the home and section pages list the same topics and counts as before. Theme and code-language values are each defined once.
6. **Tests:** no behaviour loses coverage. The Stage 2 report maps every removed test to its replacement.
7. **Visual and behaviour parity:** `npm run verify` is green. Stage 4 drives the app in a browser:
   - header tabs on each kind of page
   - the mobile nav at 375px: open, Tab cycling, Escape, focus return
   - search: open, Escape, focus return
   - prev/next links
   - DSA numbers on the landing page and in the sidebar
   - both themes

## Scope

- **In:**
  - `src/lib/{tabs,content,system-design,dsa,search}.ts`
  - `src/types.ts`
  - `src/hooks/useFocusTrap.ts`
  - `src/components/{Header,MobileNav,SearchDialog,CaseStudyNav,DsaNav,OrderedNav}.tsx`
  - `src/pages/*.tsx`
  - `src/contexts/*`, `src/hooks/useTheme.ts`, `src/hooks/useCodeLanguage.ts`, `CodeTabs.tsx`
  - their tests
  - docs that name removed functions or tests
- **Out:**
  - removing exported-only-for-tests wrappers
  - any visual change
  - content
- **UI:** yes. Parity only, checked in a browser as in criterion 7.

## Roles

- **Stage 2 test-writer:** every test change, including the consolidation and new `OrderedNav.test.tsx`. Written red where the new fields and exports don't exist yet.
- **Stage 3 implementer:** the app code and docs.

## Evals

None expected. The run says so if a doc CLAUDE.md routes to changes.

## Verification

- Stage gates as usual.
- Orchestrator greps for `` `/dsa/${`` / `` `/system-design/${`` / `FOCUSABLE_SELECTOR`.
- The reviewer's browser pass covers criterion 7.

## As built

- The path grep (criterion 2) finds exactly the two loaders that build each path once (`dsa.ts` and `system-design.ts`, as Design 2 says); no component, page or `search.ts` builds one.
- The modal hook is `useModal(ref, { onClose, initialFocusRef? })` beside `useFocusTrap` in `src/hooks/useFocusTrap.ts`, which holds the one `FOCUSABLE_SELECTOR`. The mobile nav's initial focus now comes from the trap's visible-only list (the same first section link in practice).
- `topicsInSection(sectionSlug)` was added to `content.ts`. Theme and code-language values are `THEME_PREFERENCES` / `CODE_LANGUAGES` in `src/contexts/useTheme.ts` / `useCodeLanguage.ts`.
- `evals/feature-review/scenarios.md`: FR-02, FR-03, FR-04 and FR-05's diffs and premises were moved to the new code (`useModal`, `item.path`, `topicsInSection`), each keeping its planted defect and intent; `check:eval-premises` passes. These `evals/` and `docs/DESIGN.md` edits name `feature-review-eval` and `skill-routing-eval` respectively; they run with the docs-dedupe change.

## Review decisions

- Fixed in round 1: DsaNav's link titles had lost their only check in the consolidation; `expectGroupedLists` asserts each title (caught a title→summary mutation).
- Fixed in round 2: nothing checked that CaseStudyNav/DsaNav forward `className`/`onNavigate` or that MobileNav passes `onNavigate={onClose}` to DsaNav; `App.tabs.test.tsx` now asserts the sidebar's `lg:block` and closes the mobile nav by clicking the current page's own link, and a `describe.each` over both navs checks forwarding (each of three mutations caught).
- Known limitation, after the fix-round cap (theoretical): no test tells useModal's initialFocusRef apart from the first-focusable fallback, since the search input is its panel's first focusable element; a future modal whose chosen element isn't first would be unguarded.
- Known limitation (theoretical): topicsInSection returns the shared per-section array, as topicsBySection already did; no caller mutates it.
- Stage 5 list (already on main): evals/feature-review/scenarios.md FR-04 and FR-05 planted diffs no longer apply (git apply --check); check:eval-premises checks premises only. For the eval run.
