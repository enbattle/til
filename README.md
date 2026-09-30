# til

A searchable reference of programming, systems, AI and learning topics, plus
worked System Design case studies for interview prep. Topics are grouped into
sections, and the whole thing is deployed as a static site.

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
  URL shortener"), each taking one product from requirements and
  back-of-the-envelope estimates through the data model, API and
  architecture to deep dives, failure modes and trade-offs. Each links into
  the catalog topics it uses, and each of those topics links back. Diagrams
  are written in [D2](https://d2lang.com) and rendered at build time to
  static SVGs in the site's own colors, one per theme.
- **Search** — `Ctrl`/`Cmd`+`K` fuzzy-searches every topic's and case
  study's title, summary, and body ([Fuse.js](https://www.fusejs.io)).
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

Then open the printed `localhost` URL. Node 22.22.2+ (or 24.15+) is required (see
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
npm run check:colors      # Fail if a component or stylesheet references a raw hex color instead of a design token
npm run check:tokens      # Fail if docs/DESIGN.md's token table drifts from src/index.css
npm run check:contrast    # Fail if a text token drops below WCAG AA (4.5:1) on a surface token
npm run check:npm-refs    # Fail if a doc references an npm script that no longer exists
npm run check:claude-md   # Fail if CLAUDE.md passes 150 lines or links to a missing file
npm run check:bundle      # After a build: fail if topic or case-study bodies are in the main chunk instead of lazy chunks
npm run check:raw-html   # Fail if markdown can render raw HTML, or an HTML sink (dangerouslySetInnerHTML outside CodeBlock, innerHTML, outerHTML, insertAdjacentHTML, document.write) appears
npm run check:diagrams    # Fail if a committed diagram SVG is stale, missing, orphaned or unsafe, its tokens drift from src/index.css or fail contrast, a diagram is wider than 960 px, a .d2 names a color, imports a file or breaks the <case>/<name>.d2 naming rule, a stray file sits in public/diagrams/, or a case study references a missing diagram (no d2 needed)
npm run diagrams          # Render the .d2 sources to light/dark SVGs and rewrite public/diagrams/manifest.json (needs d2 v0.9.x; not in verify or CI)
npm run check:pipeline-log # Fail if a docs/pipeline-log.md row is malformed or closes friction with a bare "nothing to change"
npm run check:test-lock   # /feature only: -- --snapshot locks test files and test-runner config, -- --verify fails if any changed, -- --clear
npm run review:diff       # /feature only: the reviewer's diff, including new untracked files
npm run verify            # The whole chain: typecheck, lint, format, every check:* except test-lock, tests, build, size, bundle check
```

## Adding content

There's no in-app editor — topics are markdown files added to the
repository and shipped with the next build. Topics and sections are covered in [docs/content.md](docs/content.md),
System Design case studies and their diagrams in
[docs/case-studies.md](docs/case-studies.md), and the bar all prose meets in
[docs/writing-standard.md](docs/writing-standard.md);
[CLAUDE.md](CLAUDE.md) routes to them.

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
[docs/SDLC.md](docs/SDLC.md). Adding a topic or a System Design case study gets
a lighter, separate process instead (draft → an independent review, at most
two rounds) — see the `add-topic` and `add-case-study` skills referenced in
[CLAUDE.md](CLAUDE.md).
