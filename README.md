# til

A searchable reference of programming, systems, AI and learning topics, plus
worked System Design case studies.

Topics are grouped into sections, and the whole thing is deployed as a static
site.

**[enbattle.github.io/til](https://enbattle.github.io/til)**

## Features

- **Sections** — every topic lives under one top-level section (see
  [`src/content/registry.ts`](src/content/registry.ts) for the current
  list). The home page, each section page, and a persistent left-side
  navigation (opened as a dismissible overlay on narrow viewports) all
  browse by this grouping — the navigation's own section groups expand
  and collapse independently as you move between them (see
  [docs/DESIGN.md](docs/DESIGN.md)).
- **System Design** — a second tab of worked design case studies ("design a
  URL shortener"), each at most a ten-minute read following an enforced template
  ([docs/case-studies.md](docs/case-studies.md)). Each links into the catalog
  topics it uses, and each of those topics links back. Diagrams are written in
  [D2](https://d2lang.com) and rendered at build time to static SVGs in the
  site's own colors, one per theme.
- **Search** — `Ctrl`/`Cmd`+`K` fuzzy-searches every topic's and case
  study's title, summary, and body
  ([Fuse.js](https://www.fusejs.io)).
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

Then open the printed `localhost` URL. The supported Node versions are
`engines` in `package.json`.

## Commands

```bash
npm run dev             # Start the dev server
npm run build            # Type-check + production build → dist/
npm run preview          # Preview the production build locally
npm run test              # Vitest, watch mode
npm run test:run          # Vitest, run once
npm run format            # Prettier write
npm run diagrams          # Render the .d2 sources to SVGs (needs d2 v0.9.x)
npm run verify            # Everything CI runs: types, lint, format, every check, tests, build, sizes
```

What each `check:*` script proves, and the commands outside `verify`, are in
[docs/verification.md](docs/verification.md).

## Adding content

There's no in-app editor — topics are markdown files added to the
repository and shipped with the next build. Topics and sections are covered in [docs/content.md](docs/content.md),
System Design case studies and their diagrams in
[docs/case-studies.md](docs/case-studies.md), and the bar all prose meets in
[docs/writing-standard.md](docs/writing-standard.md);
[CLAUDE.md](CLAUDE.md) routes to them.

## Repository settings this relies on

These live in GitHub, not in the code, so they are listed here:

- **A ruleset on `main`** (Settings → Rules, not classic branch protection):
  changes land through a pull request; the CI `verify` check must pass on a
  branch that is up to date with `main`; CodeQL code scanning must report no
  high-severity alert; force-pushes and deletion are blocked. When another
  pull request merges first, update the branch (`gh pr update-branch`) and
  wait for CI again rather than bypassing the rule. Dependabot auto-merge
  (`.github/workflows/dependabot-automerge.yml`), which
  merges patch and minor updates on their own once CI passes and leaves major
  ones for a person, depends on it: with no required check, GitHub merges an
  auto-merge pull request immediately, untested.
- **"Allow auto-merge"** and **squash merging** enabled in the repository
  settings (the workflow merges with `--squash`).
- Known effect: a merge made by the workflow's `GITHUB_TOKEN` doesn't start
  other workflows, so an auto-merged dependency bump is not deployed on its
  own. It goes live with the next push to `main` (or a manual run of
  Deploy). Dependency bumps don't change the site's content, so that delay
  is accepted rather than giving the workflow a personal token.
- GitHub Actions are pinned to full commit SHAs; Dependabot updates them
  weekly as one grouped pull request.

## Design

See [docs/DESIGN.md](docs/DESIGN.md) for the visual identity and
accessibility checklist behind the UI.

## Development process

Features and nontrivial app changes go through a spec → TDD →
implementation (+ docs) → adversarial review (code + UI) pipeline — see
[docs/SDLC.md](docs/SDLC.md). Adding a topic or a System Design case study gets
a lighter, separate process instead (draft → an independent
review, with a capped fix loop) — see [docs/content-review.md](docs/content-review.md).
