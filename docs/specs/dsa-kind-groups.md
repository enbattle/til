# Spec: group the DSA tab by kind

Status: approved 2026-10-03.

## Context

The DSA tab lists 42 entries as one flat, prerequisites-first sequence, both in
the left nav (`DsaNav` on top of `OrderedNav`) and on the landing page
(`DsaPage` on top of `NumberedCardList`). Kinds are interleaved, so a reader
can't see where the data structures end and the algorithms start. The user
wants three headed groups (Data structures, Patterns, Algorithms) in the nav
and on the landing page. Agreed with the user beforehand:

- Each group keeps the current prerequisites-first order inside it. One
  prerequisite crosses groups backwards: `binary-search-tree` (a data structure)
  lists `binary-search` (an algorithm). The user accepted that it now comes
  first, and its **Before this** link still points to binary search.
- Numbering stays one sequence, 1–42, across the groups, matching
  Previous/Next.
- Groups don't collapse.
- Landing cards drop the kind label because the group heading says it. Entry
  pages keep theirs.
- The landing intro's "Every entry comes after the ones it builds on" is
  reworded.

## Design

**Order.** `orderDsaEntries` (`src/lib/dsa.ts`) is unchanged: it still
validates prerequisites (a cycle, an unknown slug or a self-link throws) and
returns the topological order. A new exported pure function,
`groupDsaEntries(entries: DsaEntry[]): DsaGroup[]`, partitions an ordered list
by kind:

- `DsaGroup` is `{ kind: DsaKind; heading: string; entries: DsaEntry[] }`.
- Groups come in kind order (data structures, patterns, algorithms), using the
  existing `KINDS` array.
- Each group keeps its entries in input order.
- A kind with no entries gets no group.
- Headings are the plurals "Data structures", "Patterns" and "Algorithms".

New exports:

- `DSA_GROUPS = groupDsaEntries(orderDsaEntries(...))`.
- `DSA_ENTRIES` becomes `DSA_GROUPS.flatMap((g) => g.entries)`, so the landing
  page, the sidebar, Previous/Next and the numbering all share one sequence.

Because a stable partition keeps relative order, every same-group prerequisite
still comes before its dependent. A cross-group prerequisite can point forward,
which is the one case the user accepted. Search, "Before this" and the entry
page are unchanged.

**Left nav.** `DsaNav` renders the existing "DSA" label, then one block per
group:

- a group label (a `<p>` styled like the nav's small label, not a heading,
  matching the nav's existing label);
- an `<ol>` of that group's links, with `aria-labelledby` pointing at the
  label, so each list is announced by its group's name;
- a `start` attribute carrying the continuing number.

Visible numbers run 1–42 across the groups and stay `aria-hidden`. Link
styling, the current-page signal (bold plus accent border plus
`aria-current="page"`) and `onNavigate` are unchanged. `OrderedNav` gains
optional grouping without changing what `CaseStudyNav` renders: a flat list,
no group labels. `MobileNav` gets the groups automatically, since it renders
`DsaNav`.

**Landing page.** `DsaPage` keeps its `h1`. Under it, each group is a
`<section aria-labelledby>` with an `<h2>` (the group heading, serif, as on
other pages' `h2`s) and a `NumberedCardList` of its entries. Card numbers
continue across groups. No card shows a kind label. `NumberedCardList`'s
`label` prop has no remaining user, so it's removed. The intro is reworded so
it no longer claims that every entry comes after everything it builds on. It
says the entries are grouped into data structures, patterns and algorithms,
each group in the order its entries build on each other.

## Acceptance criteria

1. `groupDsaEntries` on fixtures:
   - It returns groups in kind order, whatever the input order.
   - Each group keeps its entries in input order.
   - A kind with no entries gets no group.
   - The headings are "Data structures", "Patterns" and "Algorithms".
   - Concatenating the groups' entries gives back exactly the input entries
     (no loss or duplication).
2. Real data:
   - `DSA_GROUPS` has three groups in kind order.
   - `DSA_ENTRIES` equals the concatenation of `DSA_GROUPS`' entries, and
     equals `groupDsaEntries(orderDsaEntries(...))` over the real entries
     and prerequisites.
   - Every prerequisite of the same kind comes before its dependent in
     `DSA_ENTRIES`.
   - The only prerequisite that comes after its dependent is
     `binary-search-tree -> binary-search`. The list is pinned, so a new
     backwards cross-group link fails the test and has to be accepted on
     purpose.
3. The existing `orderDsaEntries` errors (cycle, unknown prerequisite,
   self-link) and its topological-order tests stay as they are.
4. `DsaNav` (desktop and inside `MobileNav` on a `/dsa` route):
   - It shows the group labels "Data structures", "Patterns" and
     "Algorithms" in that order.
   - Each label is followed by a list whose accessible name is that label,
     holding that group's links in `DSA_ENTRIES` order.
   - Across the lists, the links are exactly `DSA_ENTRIES` in order.
   - The visible numbers run 1..N continuously.
   - The current entry still has `aria-current="page"`.
5. `CaseStudyNav` still renders one flat numbered list with no group labels.
6. The `/dsa` landing page:
   - It has exactly one `h1`.
   - It has `h2`s "Data structures", "Patterns" and "Algorithms" in order,
     each labelling a section.
   - Each section holds its group's cards in order, with numbers continuing
     across sections (the first Patterns card is 13 with today's 12 data
     structures; compute it, don't hardcode it).
   - No card shows a kind label.
   - The page no longer contains "Every entry comes after the ones it builds
     on".
7. An entry page still shows its kind label, and Previous/Next still follows
   `DSA_ENTRIES` order, so it crosses from the last data structure to the
   first pattern.

## Scope

In:

- `src/lib/dsa.ts` (`groupDsaEntries`, `DSA_GROUPS`, `DSA_ENTRIES`), `src/types.ts` (`DsaGroup`, if it lives there).
- `src/components/DsaNav.tsx` and `src/components/OrderedNav.tsx`.
- `src/pages/DsaPage.tsx` and `src/components/NumberedCardList.tsx`.

Tests the Stage 2 test-writer updates:

- `src/lib/dsa.test.ts` (the "puts every real entry's prerequisites before it" test becomes criterion 2's version).
- `src/App.dsa.test.tsx` (the landing-page test).
- `src/components/DsaNav.test.tsx`, plus new cases where needed.

Docs:

- `docs/dsa.md` "Prerequisites and order".
- `docs/DESIGN.md`, the "DSA navigation" bullet.

Out: changing any entry's kind or prerequisites, collapsible groups, group
counts or descriptions, catalog and System Design navs, search.

User-facing UI: yes, so Stage 4 includes the browser check.

## Non-negotiables check

- #1: one `h1`, `h2` group headings with no skipped level, lists named by
  their group labels, text labels (never color), checked in both themes and
  at 375px (the mobile nav included).
- #2: colors from existing tokens only.
- #3: a few lines in the main chunk; no budget raise.
- Nothing conflicts.

## Verification

- Stage 2: the new and edited tests fail.
- Stage 3: `check:test-lock -- --verify` and `npm run verify` pass.
- Stage 4: the reviewer drives `/dsa` and an entry page in both themes, at 375px with the Menu overlay, and at 1024 and 1440px. The reviewer also checks Previous/Next across a group boundary.

## As built

- `OrderedNav`'s `items` takes either a flat list (unchanged markup, so
  `CaseStudyNav` is untouched) or a list of labelled groups.
- `NumberedCardList` sets `start` from its first card's number, so a screen
  reader's list numbering continues across the landing page's sections (on the
  System Design landing it is `start=1`). The spec didn't ask for this.
- `.claude/skills/add-dsa-entry/SKILL.md` now says that a prerequisite of a later
  kind fails `dsa.test.ts`'s pinned list, and that the user decides whether to
  extend it.

## Review decisions

- Known limitation: `OrderedNav` given an empty groups array falls back to an
  empty flat list. It can't be reached: `groupDsaEntries` drops empty groups
  and there are 42 entries, and the rendered result would be empty either way.
