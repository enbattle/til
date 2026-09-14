# CLAUDE.md

Guidance for working in this repository.

## What this is

`til` is a static reference site: markdown topics grouped into top-level
sections, rendered by a Vite + React + TypeScript app and deployed to
GitHub Pages. There's no backend and no in-app editor — content is added
as files in the repository and shipped with the next build.

## Adding a feature or nontrivial change

Use `/feature <description>` — it runs this repo's full spec → TDD →
implementation → adversarial review (code + UI) pipeline: three separate,
fresh agents (test-writer, implementer, reviewer) with role separation
enforced between them, plus the orchestrating session handling spec and
docs directly. See [docs/SDLC.md](docs/SDLC.md) for why it's shaped this
way — including why it's three agents and not one per named step — and
[`.claude/skills/feature/SKILL.md`](.claude/skills/feature/SKILL.md) for
the exact steps. Skip it for genuinely small, unambiguous changes (a typo,
a one-line fix) — just make those directly.

## Content architecture

```
src/content/
  registry.ts          # every section: slug, label, description
  registry.test.ts      # asserts registry.ts matches the folders on disk
  <section-slug>/
    <topic-slug>.md
```

Each topic is one markdown file with flat frontmatter:

````md
---
title: Human-readable title
summary: One plain-text sentence — the hook shown on cards and in search.
date: YYYY-MM-DD
---

Body markdown. Fenced ```lang code blocks are syntax-highlighted.
````

- **Section** is the file's immediate parent folder — not repeated in
  frontmatter.
- **Slug** is the filename without `.md` (kebab-case).
- **`title`, `summary`, and `date` are required** — `src/lib/content.ts`
  throws at load time if any is missing.
- The frontmatter parser (`src/lib/frontmatter.ts`) is intentionally not a
  real YAML parser — it only understands flat `key: value` lines, with
  optional matching quotes around the value. Don't add nested structures
  or lists to frontmatter; put that in the body instead.
- Link to another topic from within a body using a site-root-relative path,
  e.g. `[prompt engineering](/ai-and-ml/prompt-engineering)` — the
  `MarkdownRenderer`'s `a` override routes these through React Router so
  they navigate client-side and respect the GitHub Pages base path. An
  `https://` link renders as a normal new-tab external link.

## Adding a topic to an existing section

Use the `add-topic` skill — see
[`.claude/skills/add-topic/SKILL.md`](.claude/skills/add-topic/SKILL.md).
Mechanically, a new topic is just a `.md` file dropped into that
section's folder with the frontmatter above (`src/lib/content.ts` loads
every file under `src/content/**/*.md` automatically via
`import.meta.glob`, no registry change needed) — but the skill also runs
one independent review pass against the Writing Standard below before
calling it done, since this is the most frequent change in the repo and
otherwise the easiest one to skip review on entirely.

## Adding a new section

1. Create the folder: `src/content/<new-section-slug>/`.
2. Add an entry to the `SECTIONS` array in `src/content/registry.ts`
   (`slug`, `label`, `description`).
3. Add at least one topic file into the new folder.

`registry.test.ts` fails if the folder and the registry entry don't match
in both directions — a new section is only "done" once that test passes
again.

## Writing standard

Every topic is written so a reader with **zero prior background** on the
subject can walk away with real understanding — possibly needing a second
pass on denser subjects, not assumed on the first read. Concretely:

- Define terms before using them; don't assume the reader already has the
  vocabulary.
- Build up from first principles rather than starting from an assumed
  mental model.
- Prefer concrete examples (code, a worked scenario) over abstract
  description.
- The `summary` frontmatter field is a one-sentence scannable hook — it's
  the only place terseness is the goal. The body is a teaching write-up,
  not a short "gotcha" note.

## What's deliberately not built here

Tags, "tracks" / reading paths, a domain split, interactive step-through
pages, Mermaid diagrams, end-to-end (Playwright) tests, and an in-app
editor or CMS are all out of scope for now — the app is intentionally kept
to sections + search + markdown rendering + dark mode. Add one of these
only if a real need shows up, not speculatively.

## Verifying a change

```bash
npm run typecheck && npm run lint && npm run format:check
npm run test:run
npm run build
npm run size
```

`npm run dev` for manual checking: click through the home page, a section,
and a topic; toggle the theme; open search (`Ctrl`/`Cmd`+K) and confirm a
topic is findable by title and by a body phrase.

`npm run size` checks the built JS chunks against the budgets in
`package.json`'s `size-limit` field — a change that pulls in a heavy new
dependency should fail this rather than silently regressing page-load
size. If a change legitimately needs more room, raise the specific
chunk's limit deliberately rather than letting it drift unnoticed.
