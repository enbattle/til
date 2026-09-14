# Design

The visual identity behind `til` and the checklist any UI change should
hold up against.

## Identity: a notebook, not a dashboard

The content is personal, written reference material — closer to a
notebook than a product. The UI follows that:

- **Type**: a serif (Lora) for headings paired with a plain sans (IBM Plex
  Sans) for body text and a distinct mono (IBM Plex Mono) for code. The
  serif headings are what mark this as "writing" rather than "app UI."
- **Color**: warm paper tones instead of neutral gray — an off-white
  background in light mode, a warm charcoal (not pure black) in dark mode
  — with a warm amber/ochre accent standing in for a highlighter pen
  rather than a generic interface blue.
- **Layout**: a single centered content column (`max-w-3xl`), no
  persistent sidebar. At the current content volume, the home page and
  section pages already function as navigation — a sidebar would be extra
  chrome with nothing yet to justify it. Revisit this once section/topic
  counts grow enough that jumping between sections while reading becomes
  common.

## Tokens

Every color is a CSS custom property (`src/index.css`), redefined under a
`.dark` class rather than the OS `prefers-color-scheme` media query, so
the in-app theme toggle (light/dark/system, in `ThemeContext`) can win
regardless of the system setting. Components reference the tokens
(`bg-bg-primary`, `text-text-secondary`, `border-border`, `text-accent`,
…) — never a raw hex value — so a future palette change happens in one
file.

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| `bg-primary`     | `#faf6f0` | `#201a14` |
| `bg-secondary`   | `#f2ebe0` | `#2a231b` |
| `bg-tertiary`    | `#ece2d3` | `#342c22` |
| `text-primary`   | `#2b2420` | `#f2e9dc` |
| `text-secondary` | `#5c5147` | `#c9bba6` |
| `text-tertiary`  | `#857a6d` | `#9c8f7a` |
| `border`         | `#ddd1bf` | `#3d3428` |
| `accent`         | `#92400e` | `#f0a83c` |
| `accent-hover`   | `#7c3609` | `#f7bb5c` |

## Accessibility checklist

- **Contrast**: `text-primary`, `text-secondary`, and `accent` (used for
  body text and links) are each checked against `bg-primary` in both
  themes and clear WCAG AA for normal text (4.5:1) — `accent` in
  particular was deliberately darkened in light mode (`#92400e` rather
  than a brighter, lower-contrast orange) specifically to hold that bar
  for link text, not just for large UI elements.
- **Focus states**: every interactive element gets a visible focus ring
  (`:focus-visible` in `src/index.css`) — never `outline: none` without a
  replacement.
- **Semantic headings**: one `h1` per page, no skipped levels, so the
  document structure a screen reader announces matches the visual
  hierarchy.
- **Color isn't the only signal**: links are underlined (not
  color-only), and the theme toggle and section labels are text, not
  icon-only.
- **Keyboard reachability**: search opens via `Ctrl`/`Cmd`+K, closes via
  `Escape`, and every result is a real `<button>` — reachable and
  activatable without a mouse.

Any new component should be checked against this list before it's
considered done, not just against "does it look right."
