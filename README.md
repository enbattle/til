# til

A running, searchable log of things learned across programming, tech, and
AI — short-to-long write-ups grouped into sections, deployed as a static
site.

**[enbattle.github.io/til](https://enbattle.github.io/til)**

## Features

- **Sections** — every topic lives under one top-level section (Engineering
  Practices, AI & Machine Learning, Languages & Runtimes, Tools & Workflow,
  and more as they're added). The home page and each section page browse by
  this grouping.
- **Search** — `Ctrl`/`Cmd`+`K` fuzzy-searches every topic's title, summary,
  and body ([Fuse.js](https://www.fusejs.io)).
- **Markdown content** — fenced code blocks are syntax-highlighted (via
  [Shiki](https://shiki.style)) with a copy button; long-form writing reads
  through the [Tailwind Typography](https://github.com/tailwindlabs/tailwindcss-typography)
  plugin.
- **Dark / light mode** — follows your system preference by default,
  toggleable, persisted locally.
- **No backend** — it's a reference to read, not a note-taking app. Content
  is written into the codebase as markdown files and shipped with the next
  build, not created from the UI.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL.

## Commands

```bash
npm run dev             # Start the dev server
npm run build            # Type-check + production build → dist/
npm run preview          # Preview the production build locally
npm run lint             # oxlint
npm run typecheck        # tsc -b
npm run format            # Prettier write
npm run format:check      # Prettier check
npm run test              # Vitest, watch mode
npm run test:run          # Vitest, run once (CI mode)
```

## Adding content

There's no in-app editor — topics are markdown files added to the
repository and shipped with the next build. See [CLAUDE.md](CLAUDE.md) for
the exact steps: adding a topic to an existing section, adding a new
section, and the writing standard topics are held to.

## Design

See [docs/DESIGN.md](docs/DESIGN.md) for the visual identity and
accessibility checklist behind the UI.

## Development process

Features and nontrivial changes go through a spec → TDD → implementation →
adversarial review → UI check → docs pipeline — see
[docs/SDLC.md](docs/SDLC.md).
