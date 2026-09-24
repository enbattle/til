# CLAUDE.md

Guidance for working in this repository.

## What this is

`til` is a static reference site: markdown topics grouped into top-level
sections, plus a second, question-first way in (System Design) over the
`systems-and-infrastructure` material, rendered by a Vite + React +
TypeScript app and deployed to GitHub Pages. There's no backend and no in-app editor — content is added
as files in the repository and shipped with the next build.

## Adding a feature or nontrivial change

Use `/feature <description>` — it runs this repo's full spec → TDD →
implementation → adversarial review (code + UI) → retrospective pipeline: three separate,
fresh agents (test-writer, implementer, reviewer; a fixer or a process-edit
reader joins only when a stage calls for one) with role separation
enforced between them, plus the orchestrating session handling spec
directly (docs stay with the implementer agent, as part of finishing the
change). See [docs/SDLC.md](docs/SDLC.md) for why it's shaped this
way — including why it's three agents and not one per named step — and
[`.claude/skills/feature/SKILL.md`](.claude/skills/feature/SKILL.md) for
the exact steps. Skip it for genuinely small, unambiguous changes (a typo,
a one-line fix) — just make those directly. A bug of unknown size is
triaged first (reproduce it, find the cause), then routed by what was found;
see the skill's Stage 0. If a direct fix repairs a bug
that a run in [docs/pipeline-log.md](docs/pipeline-log.md) introduced, fill
in that row's **Escaped defect** cell.

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
- **Frontmatter is eager, bodies are lazy.** `content.ts` reads each file's
  frontmatter at load through a `?meta` Vite query (the `markdownMeta` plugin
  in `vite.config.ts`), so `TOPICS` is metadata only and `Topic` has no `body`.
  A body is fetched as its own small chunk by `loadTopicBody(section, slug)`
  (topic page) or `loadAllTopicBodies()` (full-text search, which starts
  loading when the search dialog opens). Question bodies stay eager. Don't
  reintroduce an eager `?raw` glob over `src/content`: `npm run check:bundle`
  fails if any topic body ends up in the main chunk.
- The frontmatter parser (`src/lib/frontmatter.ts`) is intentionally not a
  real YAML parser — it only understands flat `key: value` lines, with
  optional matching quotes around the value. Don't add nested structures
  or lists to frontmatter; put that in the body instead.
- Link to another topic from within a body using a site-root-relative path,
  e.g. `[prompt engineering](/ai-and-ml/prompt-engineering)` — the
  `MarkdownRenderer`'s `a` override routes these through React Router so
  they navigate client-side and respect the GitHub Pages base path. An
  `https://` link renders as a normal new-tab external link.

## System Design questions

The header has two tabs: **Catalog** (everything above) and **System
Design**, which is browsed by question ("what do I do when my database can't
keep up with reads?") instead of by topic name. Each question page answers
its question by routing and comparing options, and links into the catalog;
it never holds a copy of a topic.

```
src/system-design/questions/<slug>.md
```

Questions live outside `src/content/` on purpose: everything under
`src/content/` is a catalog section, and `registry.test.ts` requires one
registry entry per folder there. A question has its own loader
(`src/lib/system-design.ts`, which reuses `parseFrontmatter`) and is not
registered in `SECTIONS`; the two are independent. Frontmatter is the usual
flat `key: value`, plus one more required field:

```md
---
title: The question itself, ending in a question mark?
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
order: 2
---
```

- **`order`** is a positive integer, unique across questions; questions are
  listed in ascending `order`. `parseQuestion` throws at load time, naming
  the file and field, if any of the four fields is missing or `order` isn't a
  positive integer.
- **Links are the data.** A question's topic list is generated from the
  `[text](/<section>/<slug>)` links in its body (first appearance order,
  fenced code ignored). The sidebar's topic list, the "Go deeper" list on the
  question page and the "This comes up in:" list on each topic page are all
  derived from those links, so there's nothing to keep in sync by hand.
  `src/lib/system-design.test.ts` fails on a link to a topic or question that
  doesn't exist. The extractor only counts plain inline links written as
  `[text](/section/slug)` (a double-quoted title after the URL is fine).
  Anything else, such as a single-quoted or parenthesised title, a trailing
  slash, `<...>` around the destination, nested brackets in the text, or the
  reference style, still renders as a working link but is silently dropped
  from those lists. A link inside inline code or a 4-space-indented block is
  counted even though it isn't a real link, so don't put example links there.
- Every `systems-and-infrastructure` topic must be linked from at least one
  question, or that test fails (there is no allowlist). See the next section.
- Body convention, reviewed by a person or agent rather than enforced by a
  test: what the problem looks like, how to confirm it, options cheapest
  first (2-3 sentences each: what it buys, what it costs, when to pick it,
  then the link), how they combine, and when it isn't this problem
  (pointing at a neighboring question).

## Adding a topic to an existing section

Use the `add-topic` skill — see
[`.claude/skills/add-topic/SKILL.md`](.claude/skills/add-topic/SKILL.md).
Mechanically, a new topic is just a `.md` file dropped into that
section's folder with the frontmatter above (`src/lib/content.ts` picks
up every file under `src/content/**/*.md` automatically via
`import.meta.glob`, no registry change needed) — but the skill also runs
one independent review pass against the Writing Standard below before
calling it done, since this is the most frequent change in the repo and
otherwise the easiest one to skip review on entirely.

A new `systems-and-infrastructure` topic must also be linked from a System
Design question (in the body, as a normal `/<section>/<slug>` link), or
`src/lib/system-design.test.ts`'s coverage check fails. Add it to the
question whose problem it helps solve; if none fits, that is the signal a
new question is needed (a file under `src/system-design/questions/` with the
next free `order`). Topics in other sections don't need one.

Every `systems-and-infrastructure` topic also ends with a
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
- Prose reads like something a knowledgeable person actually wrote, not
  a generically AI-patterned draft: avoid stock rhetorical crutches
  ("not just X — it's Y," "that's the real/actual X" as a closer),
  bullet lists where every item follows an identical rhythm with no
  variation, filler intensifiers stacked for emphasis ("genuinely,"
  "actually," "real"), a header's point immediately restated
  almost verbatim in the sentence right under it, meta-commentary about
  the explanation itself ("here's the interesting part," "the key
  insight is"), and exhaustive, evenly-weighted lists that read as
  trying to cover every angle rather than a selective, opinionated take.
- A figurative or casual phrase (an analogy, a shorthand term like
  "dopamine detox") is used naturally and trusted to land — not
  over-explained or defended against a literal misreading nobody would
  actually make.
- A System Design question page routes and compares; it doesn't re-explain
  a topic's mechanism (that's the topic's job, one link away). A snippet of
  a topic states what the option buys, what it costs and when to pick it
  here, then links. A fact that belongs to a topic is stated there and only
  linked from the question, never restated in both places.
- A systems topic's `Where you'll meet this` section says what the topic does
  in a kind of system, in terms of what the topic just taught; it doesn't
  re-teach the mechanism. It makes claims about generic systems only, never
  about how a specific company builds something, because every claim has to be
  verifiable.
- Every substantive technical claim is independently verified against
  real knowledge of the subject before publishing, not assumed correct
  because it reads confidently.

## What's deliberately not built here

Tags, interactive step-through pages, Mermaid diagrams, end-to-end
(Playwright) tests, and an in-app editor or CMS are all out of scope for
now — the app is intentionally kept to sections + search + markdown
rendering + dark mode, plus the System Design question layer above. That
layer is a bounded exception to the earlier "no domain split, no reading
paths" stance: it adds one alternate route into `systems-and-infrastructure`
by question, but not tracks, ordered curricula or a domain hierarchy over
the catalog, and catalog URLs, section pages and the topics' own prose are
unchanged. Add one of the deferred items only if a real need shows up, not
speculatively.

The equivalent list for _process/tooling_ practices (CI gates, hooks,
agent-workflow scaling) considered and deliberately deferred, each with
its actual reasoning and a concrete revisit condition, lives in
[docs/DEFERRED_PRACTICES.md](docs/DEFERRED_PRACTICES.md).

## Verifying a change

`npm run verify` is exactly what CI runs (`ci.yml` calls it), and
is what the skills tell a session to run. The deploy workflow runs it too, so a
commit that fails any check never goes live. The individual commands, if you need one:

```bash
npm run typecheck && npm run lint && npm run format:check
npm run check:colors && npm run check:tokens && npm run check:contrast && npm run check:npm-refs && npm run check:pipeline-log && npm run check:raw-html
npm run test:run
npm run build
npm run size && npm run check:bundle
```

`npm run check:test-lock` and `npm run review:diff` are not part of `verify`
or CI: `/feature` uses them inside a run. `check:test-lock` proves no test
file or test-runner config changed after Stage 2 (`-- --snapshot`, then `-- --verify`, then
`-- --clear`); `review:diff` prints the reviewer's diff, including new
untracked files.

`npm run dev` for manual checking: click through the home page, a section,
and a topic; open the System Design tab and a question page, and check that a
`systems-and-infrastructure` topic shows its "This comes up in:" back-link;
toggle the theme; open search (`Ctrl`/`Cmd`+K) and confirm a topic and a
question are each findable by title and by a body phrase.

`npm run size` checks the built JS chunks against the budgets in
`package.json`'s `size-limit` field — a change that pulls in a heavy new
dependency should fail this rather than silently regressing page-load
size. If a change legitimately needs more room, raise the specific
chunk's limit deliberately rather than letting it drift unnoticed. The limits
live in `package.json`, and the commit history records each raise with its
measured numbers.

The main chunk used to carry every topic body (search indexed them at load), so
each new topic grew it: its limit was raised three times for content alone, up
to 183 KB (179 KB brotlied). Loading bodies on demand is done: the main chunk
is now 100 KB brotlied with a 104 KB limit, and each topic body is its own
chunk of a few kB. Adding topics no longer touches it. What still grows it is
question pages (kept eager, since the sidebar and each topic's "This comes up
in" links read their text at first render) and app code; if questions multiply,
loading their bodies lazily is the next lever. `npm run check:bundle` guards the
split itself: after a build it fails if a topic's body text is in the main chunk,
or in no chunk at all. The markdown chunk's entry points at
`MarkdownRenderer-*.js` because `TopicPage` and `QuestionPage` share it.
