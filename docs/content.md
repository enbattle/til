# Content: topics and sections

How catalog topics are stored, loaded and added. Read this before adding or
changing a topic or a section; [CLAUDE.md](../CLAUDE.md) routes here.

## Content architecture

```
src/content/
  registry.ts          # every section: slug, label, description
  registry.test.ts      # asserts registry.ts matches the folders on disk
  where-youll-meet-this.test.ts  # systems topics' closing section
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
- **Frontmatter is eager, bodies are lazy.** `content.ts` reads each file's
  frontmatter at load through a `?meta` Vite query (the `markdownMeta` plugin
  in `vite.config.ts`), so `TOPICS` is metadata only and `Topic` has no `body`.
  A body is fetched as its own small chunk by `loadTopicBody(section, slug)`
  (topic page) or `loadAllTopicBodies()` (full-text search, which starts
  loading when the search dialog opens). Case studies work the same way. Don't
  reintroduce an eager `?raw` glob over `src/content` or the case studies:
  `npm run check:bundle` fails if any topic or case-study body ends up in the
  main chunk.
- The frontmatter parser (`src/lib/frontmatter.ts`) is intentionally not a
  real YAML parser — it only understands flat `key: value` lines, with
  optional matching quotes around the value. Don't add nested structures
  or lists to frontmatter; put that in the body instead.
- Link to another topic from within a body using a site-root-relative path,
  e.g. `[prompt engineering](/ai-and-ml/prompt-engineering)` — the
  `MarkdownRenderer`'s `a` override routes these through React Router so
  they navigate client-side and respect the GitHub Pages base path. An
  `https://` link renders as a normal new-tab external link, and an in-page
  `#heading-id` link as a plain same-tab anchor.

## Adding a topic to an existing section

Use the `add-topic` skill — see
[`.claude/skills/add-topic/SKILL.md`](../.claude/skills/add-topic/SKILL.md).
Mechanically, a new topic is just a `.md` file dropped into that
section's folder with the frontmatter above (`src/lib/content.ts` picks
up every file under `src/content/**/*.md` automatically via
`import.meta.glob`, no registry change needed) — but the skill also runs
an independent review against the [Writing Standard](writing-standard.md) (re-run after
fixes, at most two rounds) before
calling it done, since this is the most frequent change in the repo and
otherwise the easiest one to skip review on entirely.

Every `systems-and-infrastructure` topic ends with a
`## Where you'll meet this` section: the exact heading (straight apostrophe),
the last `##` in the body, at least 25 words. It names the two or three kinds
of systems where the topic genuinely matters and says what the topic does
there, drawn from a small fixed set that recurs across topics so the same
systems connect them: payments and checkout, a news feed or timeline, chat
and messaging, a URL shortener, and a notification or email pipeline (name
one outside the set only when none fit).
`src/content/where-youll-meet-this.test.ts` enforces the heading, its position
and its length. If a topic already ends with a section about where it shows
up, rename that section instead of adding a second. Other sections' topics
don't need it.

## Adding a new section

1. Create the folder: `src/content/<new-section-slug>/`.
2. Add an entry to the `SECTIONS` array in `src/content/registry.ts`
   (`slug`, `label`, `description`).
3. Add at least one topic file into the new folder.

`registry.test.ts` fails if the folder and the registry entry don't match
in both directions — a new section is only "done" once that test passes
again.
