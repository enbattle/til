# Redesign the section/topic nav for scale

## Context

`til` just grew from 3 sections / 6 topics to 5 sections / 35 topics via
a content migration from a sister repo. The left-side nav (`SectionNav`,
shared by the persistent desktop sidebar in `App.tsx` and the mobile
overlay `MobileNav`, added in [`sidebar-navigation.md`](sidebar-navigation.md))
is always fully expanded — every section and every one of its topics
renders flat, all at once. That was the deliberate, simplest choice at 6
topics; at 35 it's a wall of text. Topic titles also now range from 2
words ("CAP Theorem") to a full sentence ("Observability: Metrics, Logs,
and Traces") with no consistent visual rhythm, and the sidebar's
`overflow-y-auto` scroll region shows a full-width native scrollbar that
doesn't match the site's warm, understated "notebook" aesthetic
(`docs/DESIGN.md`).

The user asked for three things: redesign the nav for the new scale, fix
the long/short title inconsistency, and hide the scrollbar. Before
planning, this was researched against current UX/accessibility guidance,
which pushed back on two of the three asks — the user agreed with the
pushback:

- **Hiding the scrollbar entirely goes against accessibility guidance**
  — it removes the "this is scrollable" affordance, which multiple
  accessibility sources specifically warn against. Agreed fix: style it
  thin and on-theme instead of hiding it.
- **Truncating long titles with an ellipsis + tooltip is a worse pattern
  than letting them wrap** — tooltips are unreliable for touch/keyboard
  users, and UX style guides for navigation specifically advise against
  truncation. Agreed fix: let titles wrap, fix the spacing so wrapped and
  single-line items look visually consistent.
- **The actual scale problem is that everything is always expanded.**
  Agreed fix: make sections collapsible, matching the standard docs-site
  pattern, with only the section containing the current page open by
  default.

This spec implements those three agreed fixes as one cohesive change.

## Approach

### 1. Collapsible sections in `SectionNav.tsx`

Add local component state: `expandedSections: Set<string>` (section
slugs), seeded on mount from the current route (the section containing
`pathname`, if any, starts expanded; everything else starts collapsed).

Each section header row becomes `flex items-center justify-between`:

- The existing `<Link to={sectionPath}>` stays exactly as-is (same
  classes, same `aria-current` logic, same click behavior) — it still
  navigates to the section page and is not what toggles expansion.
- A new sibling disclosure `<button>` (a chevron icon) sits next to it:
  `aria-expanded={isExpanded}`, `aria-controls` pointing at the
  section's topic-list id, and an `aria-label` that names the section
  (e.g. "Expand AI & Machine Learning" / "Collapse AI & Machine
  Learning") so it's unambiguous out of context for a screen reader user
  tabbing through buttons. Clicking it toggles that section's entry in
  `expandedSections` — no navigation.

The topic `<ul>` for each section stays in the DOM always (so
`aria-controls` never points at a nonexistent id) and toggles via the
`hidden` attribute rather than conditional rendering or CSS-only hiding
— `hidden` removes it from the accessibility tree and from `getByRole`
queries, which is what makes "collapsed" mean something to assistive
tech, not just visually.

A `useEffect` watching `pathname` adds the _new_ current section's slug
to `expandedSections` whenever the current section changes (so
navigating to a topic in a different section — via search, a cross-link,
or browser back/forward — always reveals it in the nav), without ever
removing a section the user already had open. The user can still
manually collapse the current section if they want; it only reopens if
they navigate away and back.

### 2. Title wrapping and spacing (`SectionNav.tsx`)

No truncation anywhere — remove nothing, just fix the rhythm:

- Add `leading-snug` to topic link text so a wrapped 2-line title has
  sane internal line spacing.
- Add vertical padding directly on each topic `<a>` (not just relying on
  `<li>` gaps) so the clickable area and the left accent border feel
  proportionate whether the label is 1 or 2 lines.
- Loosen the `<ul>` gap between topic items slightly (currently
  `space-y-1.5`, tuned for the old, always-short titles) so short and
  wrapped items read as one consistent list rather than uneven clumps.

### 3. Thin, on-theme scrollbar (`index.css`, `App.tsx`, `MobileNav.tsx`)

Add one small utility in `index.css` using the standard `scrollbar-width`
/ `scrollbar-color` properties (well-supported across current browsers,
no plugin needed), built from existing tokens — no new colors:

```css
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
```

Apply `scrollbar-thin` to the desktop sidebar's scroll wrapper in
`App.tsx` and to `MobileNav`'s panel `div`. This keeps the "you can
scroll this" affordance (the accessibility-correct choice) while making
it subtle and on-palette instead of the default browser bar (the user's
actual underlying want).

### 4. One small addition: a muted topic count per section (optional, easy to cut)

Since sections are now collapsed by default, showing how many topics are
inside each one (e.g. "AI & Machine Learning · 11") helps a reader decide
what to expand without a guess. Rendered as a visually-muted
`aria-hidden="true"` span _inside_ the section link, so it doesn't change
the link's accessible name (existing behavior that looks up the section
link by `name: section.label` keeps working unchanged). Cut this without
touching anything else if it doesn't earn its keep in review.

## Explicitly out of scope

- No persistence of expand/collapse state across a full page reload —
  in-memory only, reseeded from the current route each time the app
  mounts.
- No change to sidebar width (`w-56` desktop / `w-72` mobile), the
  persistent-vs-overlay breakpoint behavior, search, theme toggle, or any
  page outside the nav itself.
- No new colors — every visual change reuses existing tokens from
  `index.css`.
- No drag-reordering, in-nav search/filter, or icons per topic.

## Acceptance criteria (feed directly into Stage 2's tests)

1. At a topic page (e.g. `/security/xss`), that topic's section starts
   expanded (its topic list is queryable in the accessible tree); every
   other section starts collapsed (their topic links are not queryable).
2. At the home page (`/`, no current section), every section starts
   collapsed; section labels are still real links to their section pages.
3. Each section has a disclosure button, distinct from its label link,
   with `aria-expanded` reflecting state and an accessible name that
   includes the section's label.
4. Clicking a section's disclosure button toggles only that section's
   expanded state and does not navigate (pathname unchanged).
5. Clicking a section's label link still navigates to `/${section.slug}`
   exactly as today, and is not itself what toggles expansion.
6. Navigating to a page in a currently-collapsed section (by any means)
   automatically expands that section without collapsing any section
   already open.
7. A user can manually collapse the section containing the current page.
8. No truncation, `text-overflow: ellipsis`, or `line-clamp` is used
   anywhere in the nav; long titles wrap onto multiple lines.
9. Both scroll containers (desktop sidebar wrapper, mobile overlay panel)
   use `scrollbar-thin` (thin, on-theme) rather than the default browser
   scrollbar or a fully hidden one.
10. All pre-existing behavior not changed above still holds:
    `aria-current` marking on the active section/topic, `MobileNav`'s
    focus trap, Escape/backdrop-click close, and closing on navigation.
11. (If kept) the per-section topic count is visible but `aria-hidden`,
    and does not change the section link's accessible name.

Note: criterion 9's actual visual thinness/on-theme look, and the
wrapped-title spacing from step 2, are UI-review criteria for Stage 4's
browser check, not unit-testable assertions — the same kind of CSS-only
concern `sidebar-navigation.md` already called out for its own
breakpoint behavior.

## Files touched

- `src/components/SectionNav.tsx` — the core change (state, disclosure
  buttons, spacing, optional count).
- `src/components/SectionNav.test.tsx` — the existing "renders every
  topic" test assumes full expansion and will need rewriting to expand a
  section (by clicking its disclosure button) before asserting its
  topics are queryable; other existing tests (aria-current marking,
  click-to-navigate, `onNavigate` callback) should still hold but will
  need to account for expand state where they touch topic links.
- `src/components/MobileNav.test.tsx` — same adjustment where it asserts
  a topic link is present without first expanding/navigating.
- `src/index.css` — add the `scrollbar-thin` utility.
- `src/App.tsx` — apply `scrollbar-thin` to the sidebar wrapper.
- `src/components/MobileNav.tsx` — apply `scrollbar-thin` to the panel.
- `docs/DESIGN.md` — document the collapsible-nav behavior and the
  scrollbar-styling decision (and why hiding it outright was rejected),
  the same way the existing persistent/overlay decision is documented.

Has a user-facing UI surface → Stage 4 includes the browser check.

## Verification

```bash
npm run typecheck && npm run lint && npm run format:check && npm run test:run && npm run build
```

Plus a manual/Stage-4 browser pass: load a topic page and confirm only
its section is open; load `/` and confirm all sections are collapsed;
tab to a disclosure button with the keyboard and toggle it with
Enter/Space; confirm the scrollbar is visibly thinner and on-theme in
both light and dark mode; confirm no title is cut off anywhere; resize to
mobile width and repeat inside the `MobileNav` overlay.
