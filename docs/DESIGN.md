# Design

The visual identity behind `til` and the checklist any UI change should
hold up against.

## Identity: a notebook, not a dashboard

The content is personal, written reference material — closer to a
notebook than a product. The UI follows that:

- **Type**: a serif (Lora) for headings paired with a plain sans (IBM Plex
  Sans) for body text and a distinct mono (IBM Plex Mono) for code. The
  serif headings are what mark this as "writing" rather than "app UI."
  The faces come from one Google Fonts stylesheet in `index.html`;
  `src/main.tsx` starts loading the few only the lazy markdown bodies use at
  startup, and lists them by hand, so a face dropped or renamed in one must
  change in the other too (each file's comment points at the other).
- **Color**: warm paper tones instead of neutral gray — an off-white
  background in light mode, a warm charcoal (not pure black) in dark mode
  — with a warm amber/ochre accent standing in for a highlighter pen
  rather than a generic interface blue.
- **Layout**: a persistent left-side section/topic nav (`SectionNav`, or
  `CaseStudyNav` on System Design routes and `DsaNav` on DSA routes — see
  "Case study navigation" and "DSA navigation" below)
  alongside a reading column capped at 800px (`max-w-[50rem]`) at every
  width, inside a 1440px shell (`max-w-[90rem]`, the header's inner row
  shares the cap). From `xl` (1280px) the shell adds a 224px right column
  after the reading column, on every route (empty on pages without sections,
  so the reading column never moves sideways between pages), and space past
  the three columns goes into the gaps, not the reading column. Above the `lg` breakpoint the nav is a sticky panel
  that scrolls with the page and then holds in place once it reaches its
  offset, with its own independent scroll region so it stays reachable
  on a long page instead of scrolling out of view; below it, the panel
  is replaced by a text "Menu" button in the header that opens the same
  nav tree in a dismissible left-edge overlay (`MobileNav`) — exactly one
  of the two is present at a time.
- **Collapsible sections**: once the site grew past a handful of topics,
  `SectionNav` (shared by the desktop sidebar and `MobileNav`) switched
  from always-fully-expanded to collapsible — only the section containing
  the current page starts open, everything else starts collapsed. Each
  section header is a `flex items-center justify-between` row: the
  existing label `<Link>` (still just navigation, unchanged) plus a
  sibling disclosure `<button>` (`aria-expanded`, `aria-controls`
  pointing at that section's topic `<ul>` id, an `aria-label` naming the
  section) that toggles expansion only. The topic `<ul>` stays in the DOM
  always and toggles via the `hidden` attribute — not conditional
  rendering, not CSS-only — so a collapsed section's topics are actually
  removed from the accessibility tree, not just hidden visually.
  Navigating into a different section (search, a cross-link, browser
  back/forward) auto-expands that section without collapsing one the
  user already opened manually. Long topic titles wrap onto multiple
  lines rather than being truncated — a UX and accessibility tradeoff:
  ellipsis-plus-tooltip patterns are unreliable for touch/keyboard users,
  so titles get `leading-snug` and vertical padding on each link instead
  so wrapped and single-line items read as one consistent list.
- **Header tabs**: the header carries a `<nav aria-label="Primary">` with
  three links, **Catalog** (`/`), **System Design** (`/system-design`) and
  **DSA** (`/dsa`).
  The active one has `aria-current="page"` plus a non-color signal — bold
  weight and an accent-colored bottom border, the same treatment the
  sidebar navs use for the current page — so it isn't marked by color
  alone. System Design is active on `/system-design` and everything under
  it, DSA on `/dsa` and everything under it; Catalog is active on every other route, including topic pages a
  case study links to (following a link into the catalog switches tabs). The
  tabs are visible at every width. Above the `sm` breakpoint they sit in
  the logo row right after the logo; below it they wrap onto their own row
  under it (the header is `flex-wrap`, the nav `w-full`), so 375 px shows
  them without crowding the Menu / Search / theme controls or scrolling the
  page sideways. The theme toggle is an icon-only button of fixed size (see
  the accessibility checklist), so the header wraps to the same number of
  rows whichever theme is stored; a text label ("System" vs. "Light") once
  made it three rows at 375px with no stored theme and two otherwise.
- **Case study navigation**: on `/system-design` and `/system-design/*` the
  persistent sidebar and `MobileNav` show `CaseStudyNav` instead of
  `SectionNav`; every other route, including topic pages and not-found,
  keeps `SectionNav`. It is a flat ordered list, one link per case study
  (its number, hidden from screen readers since the `<ol>` already conveys
  order, then its title, wrapping rather than truncating), with the same bold
  plus accent-border current signal and `aria-current="page"`. There is
  nothing to expand: each case study page (and each DSA entry and catalog
  topic) carries its own **On this page** list (`OnThisPage`): the body's
  `##` sections as in-page anchors, from `h2Headings`, in two copies of which
  exactly one shows at any width. From `xl` it's a
  `<nav aria-label="On this page">` portalled into the shell's right column (a plain `<div>` slot
  provided through `PageAsideContext`, so an empty one adds no landmark),
  sticky like the left nav with its own scroll, under a small uppercase label
  styled like `OrderedNav`'s, its links in the left nav's non-current style
  and no current-section highlighting. Below `xl` the same nav sits at the
  top of the body in a native `<details>` on `bg-secondary`, closed by
  default, whose `<summary>` reads "On this page". Both render inside
  `LazyBody`'s children, so they appear once the body loads and unmount with
  the page; a body with no `##` headings gets neither. The headings' `scroll-margin-top` is the
  sticky header's measured height plus 0.75rem, which `Header` publishes as
  `--header-height`, because the header's height varies with width: one row
  of about 68px from `sm` up, two rows of about 105px at 375px, three on the
  narrowest phones. So the header never covers a heading an "On this page" link
  jumps to. The same goes for in-body links: a markdown link whose href
  starts with `#` (the "At a glance" section's links to headings) renders as
  a plain same-tab anchor, a `/…` link is a router `Link`, and an external
  link opens in a new tab with `rel="noreferrer"`. Opening a topic or case study at a `#<heading-id>` URL works too:
  the body loads after the browser's own jump, so `LazyBody` scrolls the
  heading into view once the body renders, and the same scroll margin applies;
  after that it re-aligns the heading whenever layout above it shifts, for at
  least 1.5 seconds and until `document.fonts.ready`, never past 5 seconds. It
  stops at once on the reader's first wheel, touch, key or pointer press, and
  on any scroll it didn't cause itself (a scrollbar drag, find-in-page,
  assistive technology), so it never fights the reader). The way back from a catalog topic is the
  "Used in these case studies:" list a topic page shows for the case studies
  that link to it. On desktop all three navs stay mounted and the inactive ones sit
  in a `hidden`, `display: contents` wrapper (out of the accessibility tree
  at every width), so a section group the user opened survives a round trip
  between the tabs.
- **DSA navigation**: on `/dsa` and `/dsa/*` the sidebar and `MobileNav` show
  `DsaNav`, built like `CaseStudyNav`: a flat ordered list of the entries
  (prerequisites first; docs/dsa.md), the same bold plus accent-border current
  signal and `aria-current="page"`. The landing page's cards and each entry
  page show the entry's kind ("Data structure", "Pattern", "Algorithm") as
  text, never as a color alone. An entry page lists its prerequisites under
  the title as **Before this** (a `<nav aria-label="Before this">`, absent when
  there are none), then the same "On this page" list as a case study.
- **Code tabs**: on a DSA entry page each Python/TypeScript code pair is one
  block (`CodeTabs`) with a two-tab `role="tablist"` ("Python",
  "TypeScript") over a single code block. It follows the WAI-ARIA tabs
  pattern with manual activation: the selected tab is the one tab stop
  (roving tabindex), Left/Right (and Home/End) move focus between the tabs,
  and Enter or Space selects, so moving focus never re-renders every code
  block on the page. The selected tab has the header tabs' treatment: bold
  weight and an accent bottom border. The choice is shared by every pair on
  the site (`CodeLanguageProvider`, stored under `til-code-language` like the
  theme, Python by default). Other pages never pass `codeTabs` to
  `MarkdownRenderer`, so their code blocks are unchanged. A long line scrolls
  inside the code block, as in any code block, never the page.
- **Diagrams**: case-study diagrams are D2 sources rendered at build time to
  one SVG per theme, colored from the tokens below (the render script maps
  them onto D2's theme slots: paper surfaces and `accent-soft` for fills,
  `accent` for strokes and arrows, the text tokens for labels, and checks
  label contrast on every fill). The page swaps the `.light`/`.dark` file
  with the theme rather than recoloring at runtime, shows it as a plain
  `<img>` scaled to the content column, and wraps it in a link that opens it
  full size in a new tab (focus ring from the global `:focus-visible` style).
  That link is its one tab stop on a wide screen; on a narrow one, where the
  diagram scrolls sideways (below), the scroll region is a second. The alt text is announced once: the link is named
  "Open diagram full size: <alt>", and the scroll region below is named only
  "Diagram, scrolls sideways". A diagram on its own line renders without a
  wrapping `<p>`, and its box is a block `span`, so the HTML stays valid. It never scales below 75% of its rendered size
  (labels stay about 12px): on a narrower column, such as 375px, it keeps that
  width inside its own horizontally scrolling box, which becomes a focusable
  `role="region"` with an aria-label only while it overflows, so the page
  itself never scrolls sideways. That box is `useSideScroll`
  (`src/hooks/useSideScroll.ts`), shared with tables.
- **Tables**: every markdown table sits in its own horizontally scrolling box
  (the same `useSideScroll` as a diagram's), so a wide one scrolls inside the
  content column instead of widening the page at 375px. While the table
  overflows, the box is a focusable `role="region"` named "Table, scrolls
  sideways", so a keyboard user can Tab to it and scroll with the arrow keys;
  a table that fits adds no tab stop and no region. The table itself is
  unchanged.
- **Thin, on-theme scrollbar**: both nav scroll containers (the desktop
  sidebar wrapper in `App.tsx` and `MobileNav`'s panel), and the
  sideways-scrolling box of a diagram or table, use a
  `.scrollbar-thin` utility (`src/index.css`) built from the standard
  `scrollbar-width: thin` / `scrollbar-color` properties, colored from the
  existing `--color-border` token. Deliberately styled rather than hidden
  outright — a fully hidden scrollbar removes the "this is scrollable"
  affordance, which accessibility guidance specifically warns against; a
  thin on-theme bar keeps that affordance while fitting the site's warm,
  understated look.

## Tokens

Every color is a CSS custom property (`src/index.css`), redefined under a
`.dark` class rather than the OS `prefers-color-scheme` media query, so
the in-app theme toggle (light/dark/system, in `ThemeContext`) can win
regardless of the system setting. Components reference the tokens
(`bg-bg-primary`, `text-text-secondary`, `border-border`, `text-accent`,
…) — never a raw hex value — so a future palette change happens in one
file. `npm run check:colors` (`scripts/check-hex-colors.mjs`, wired into
CI) enforces this mechanically rather than relying on review to catch a
raw hex literal creeping into a component — it fails if one shows up
in any `.ts`, `.tsx`, `.mjs` or `.css` file under `src/` outside `src/index.css` itself (where the tokens
are defined) or `src/content/` (published prose, not app code). A `.d2`
diagram source is checked by `check:diagrams` instead.

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| `bg-primary`     | `#faf6f0` | `#201a14` |
| `bg-secondary`   | `#f2ebe0` | `#2a231b` |
| `bg-tertiary`    | `#ece2d3` | `#342c22` |
| `text-primary`   | `#2b2420` | `#f2e9dc` |
| `text-secondary` | `#5c5147` | `#c9bba6` |
| `text-tertiary`  | `#6e6356` | `#a39683` |
| `border`         | `#ddd1bf` | `#3d3428` |
| `accent`         | `#92400e` | `#f0a83c` |
| `accent-hover`   | `#7c3609` | `#f7bb5c` |
| `accent-soft`    | `#f3e3c8` | `#3d2f16` |

`accent-soft` is not referenced by any component; its one use is as the
node fill in the rendered case-study diagrams (see "Diagrams" above), where
it marks a diagram's boxes with the accent without the contrast cost of the
full accent color. The theme is meant to be extended from these tokens rather
than a new one added ad hoc.

## Accessibility checklist

- **Contrast**: every text token (`text-primary`, `text-secondary`,
  `text-tertiary`, `accent`, `accent-hover`) clears WCAG AA for normal text
  (4.5:1) against every surface token (`bg-primary`, `bg-secondary`,
  `bg-tertiary`) in both themes, and `npm run check:contrast`
  (`scripts/check-contrast.mjs`, wired into CI) fails if a palette change
  breaks that. `accent` was deliberately darkened in light mode (`#92400e`
  rather than a brighter, lower-contrast orange) to hold the bar for link
  text, and `text-tertiary` was adjusted in both themes (darkened in light mode, `#857a6d`
  -> `#6e6356`, where it was below AA on every surface; lightened in dark mode,
  `#9c8f7a` -> `#a39683`, where it was below AA on the reserved `bg-tertiary`
  surface). It remains the lowest-contrast of the three text tones in both
  themes, so the hierarchy holds.
- **Focus states**: every interactive element gets a visible focus ring
  (`:focus-visible` in `src/index.css`) — never `outline: none` without a
  replacement.
- **Semantic headings**: one `h1` per page, no skipped levels, so the
  document structure a screen reader announces matches the visual
  hierarchy.
- **Color isn't the only signal**: links are underlined (not
  color-only), and section labels are text, not icon-only. The theme toggle
  is the one icon-only control: a different outline shape per state (sun,
  moon, monitor), all the same size, with the state and the next action in
  its `aria-label` and `title` ("Theme: System. Click for Light.").
- **Every control has an accessible name**: visible text, or for an
  icon-only control (whose icon is `aria-hidden`) an `aria-label`, so a
  screen reader never announces an unnamed "button".
- **Keyboard reachability**: search opens via `Ctrl`/`Cmd`+K, closes via
  `Escape`, `Enter` in the box opens the first result, and every result is a
  real `<button>` — reachable and activatable without a mouse. Code tabs move
  with the arrow keys and select with Enter or Space. A diagram or
  table that scrolls sideways is a focusable region, scrolled with the arrow
  keys.

Any new component should be checked against this list before it's
considered done, not just against "does it look right."
