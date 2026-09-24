# til

A running, searchable log of things learned across programming, tech, AI,
and how to focus and learn well — short-to-long write-ups grouped into
sections, deployed as a static site.

**[enbattle.github.io/til](https://enbattle.github.io/til)**

## Features

- **Sections** — every topic lives under one top-level section (see
  [`src/content/registry.ts`](src/content/registry.ts) for the current
  list). The home page, each section page, and a persistent left-side
  navigation (opened as a dismissible overlay on narrow viewports) all
  browse by this grouping — the navigation's own section groups expand
  and collapse independently as you move between them (see
  [docs/DESIGN.md](docs/DESIGN.md)).
- **System Design** — a second tab that starts from a question ("what do I
  do when my database can't keep up with reads?") instead of a topic name.
  Each question page compares the options and links into the catalog
  topics it draws on; every topic links back to the questions it comes up
  in. Its sidebar lists the questions, each expandable to its topics.
- **Search** — `Ctrl`/`Cmd`+`K` fuzzy-searches every topic's and System Design
  question's title, summary, and body ([Fuse.js](https://www.fusejs.io)).
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

Then open the printed `localhost` URL. Node 22.12 or newer is required (see
`engines` in `package.json`).

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
npm run size              # Check built JS chunks against size-limit budgets
npm run check:colors      # Fail if a component references a raw hex color instead of a design token
npm run check:tokens      # Fail if docs/DESIGN.md's token table drifts from src/index.css
npm run check:contrast    # Fail if a text token drops below WCAG AA (4.5:1) on a surface token
npm run check:npm-refs    # Fail if a doc references an npm script that no longer exists
npm run check:bundle      # After a build: fail if topic bodies are in the main chunk instead of lazy chunks
npm run check:raw-html   # Fail if markdown can render raw HTML, or an HTML sink (dangerouslySetInnerHTML outside CodeBlock, innerHTML, outerHTML, insertAdjacentHTML, document.write) appears
npm run check:pipeline-log # Fail if a docs/pipeline-log.md row is malformed or closes friction with a bare "nothing to change"
npm run check:test-lock   # /feature only: -- --snapshot locks test files and test-runner config, -- --verify fails if any changed, -- --clear
npm run review:diff       # /feature only: the reviewer's diff, including new untracked files
npm run verify            # The whole chain: typecheck, lint, format, every check, tests, build, size, bundle check
```

## Adding content

There's no in-app editor — topics are markdown files added to the
repository and shipped with the next build. See [CLAUDE.md](CLAUDE.md) for
the exact steps: adding a topic to an existing section, adding a new
section, System Design questions, and the writing standard topics are held
to.

## Repository settings this relies on

These live in GitHub, not in the code, so they are listed here:

- **Branch protection on `main`** requiring the CI `verify` check to pass.
  Dependabot auto-merge (`.github/workflows/dependabot-automerge.yml`)
  depends on it: with no required check, GitHub merges an auto-merge pull
  request immediately, untested.
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
[docs/SDLC.md](docs/SDLC.md). Adding a topic gets a lighter, separate
process instead (draft → one independent review pass) — see the
`add-topic` skill referenced in [CLAUDE.md](CLAUDE.md).
