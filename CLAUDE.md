# CLAUDE.md

Guidance for working in this repository.

## What this is

`til` is a static reference site: markdown topics grouped into top-level
sections, plus a second tab (System Design) of worked design case studies
that draw on the catalog, rendered by a Vite + React +
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
  `https://` link renders as a normal new-tab external link.

## System Design case studies

The header has two tabs: **Catalog** (everything above) and **System
Design**, a numbered list of worked design case studies ("Design a URL
Shortener (like TinyURL)"). Each one takes a product through the standard
approach and links into the catalog wherever it uses a topic; it never holds a
copy of a topic.

```
src/system-design/
  case-studies/<slug>.md              # one case study
  diagrams/<slug>/<name>.d2           # its diagrams' D2 sources
public/diagrams/
  <slug>/<name>.light.svg, .dark.svg  # rendered by `npm run diagrams`
  manifest.json                       # tokens + source/SVG hashes + sizes (the lock file)
```

Case studies live outside `src/content/` on purpose: everything under
`src/content/` is a catalog section, and `registry.test.ts` requires one
registry entry per folder there. They have their own loader
(`src/lib/system-design.ts`) and are not registered in `SECTIONS`. Like topics,
frontmatter is eager (`?meta`) and the body is its own lazy chunk
(`loadCaseStudyBody`, through the same `createBodyStore`). Frontmatter is the
usual flat `key: value`, plus one more required field:

```md
---
title: Design a URL Shortener (like TinyURL)
summary: One plain-text sentence — the hook shown on the landing page and in search.
date: YYYY-MM-DD
order: 2
---
```

- **`order`** is a positive integer, unique across case studies; they are
  listed, numbered and linked prev/next in ascending `order`. `parseCaseStudy`
  throws at load time, naming the file and field, if any of the four fields is
  missing or `order` isn't a positive integer.
- **The template is enforced.** The body's `##` headings are exactly, in
  order: `Requirements`, `Back-of-the-envelope estimates`, `Data model`,
  `API design`, `High-level architecture`, two or more `Deep dive: <topic>`,
  `Failure modes and bottlenecks`, `Trade-offs`
  (`src/system-design/case-study-structure.test.ts`), and
  `High-level architecture` contains at least one diagram, written as an inline
  image, `![alt](/diagrams/<slug>/<name>.svg)` (the test doesn't count the
  reference style there, though `check:diagrams` resolves it for other
  diagrams). The page builds its Contents
  list from these headings, parsed with the renderer's own markdown stack and
  heading-id pass (`h2Headings` in `src/lib/headings.ts`), so every entry links
  to the id its heading renders with; still, keep them plain text. The URL shortener
  (`url-shortener.md`) is the reference example to copy.
- **Links are the data.** A case study's catalog links are extracted at build
  time (the `?links` query, running `extractTopicRefs` from
  `src/lib/markdown-links.ts`), and the page's "Go deeper" list and each
  topic page's "Used in these case studies:" list come from them, so there's
  nothing to keep in sync by hand. Link a topic where the prose uses it, as
  `[text](/<section>/<slug>)`; there is no requirement to cover every topic.
  `src/lib/system-design.test.ts` fails on a link to a topic or case study
  that doesn't exist. The extractor only counts plain inline links written as
  `[text](/section/slug)` (a double-quoted title after the URL is fine).
  Anything else, such as a single-quoted or parenthesised title, a trailing
  slash, `<...>` around the destination, nested brackets in the text, or the
  reference style, still renders as a working link but is silently dropped
  from those lists. A link inside inline code or a 4-space-indented block is
  counted even though it isn't a real link, so don't put example links there.
- **Diagrams are D2, rendered at build time.** Write one diagram per file at
  `src/system-design/diagrams/<slug>/<name>.d2` (lowercase kebab-case, one
  folder deep; both diagram scripts reject anything else), run `npm run diagrams`
  (it needs d2 v0.9.x; install commands under "Verifying a change"), and
  reference it in markdown as
  `![Alt text describing what the diagram shows](/diagrams/<slug>/<name>.svg)`.
  The renderer picks the `.light` or `.dark` file for the current theme, sizes
  it and links it full size (on a phone it keeps a readable minimum size and
  scrolls sideways in its own box). A `.d2` file names no colors: the render
  script derives the D2 theme from the `--color-*` tokens in `src/index.css`
  (and checks text contrast on every fill); `check:diagrams` rejects a `.d2`
  that sets `fill`, `stroke`, `font-color` or a theme by any syntax or uses a
  hex color as a value (`"#ff0000"`, e.g. in `vars`), and `check:colors`
  rejects the same hex values (a `#` inside a label, such as `"Issue #123"`, or
  in a comment is fine). A `.d2` can't import another file (`...@x`,
  `x: @../y`): the imported file would escape the source hash and the color
  guard, so both `check:diagrams` and `npm run diagrams` reject it. Changing a `--color-*` token the
  diagrams use means re-running `npm run diagrams` too. Keep a diagram to roughly 6-10 nodes laid out to fit the ~720px
  content column (`direction: down` usually fits better than `right`), use
  `shape: sequence_diagram` for a request flow, and look at the rendered SVG
  in both themes before committing. Commit the source, both SVGs and
  `manifest.json` together; `npm run check:diagrams` (in `verify`) fails if
  they disagree.
- Use the `add-case-study` skill to write one; see
  [`.claude/skills/add-case-study/SKILL.md`](.claude/skills/add-case-study/SKILL.md).

## Adding a topic to an existing section

Use the `add-topic` skill — see
[`.claude/skills/add-topic/SKILL.md`](.claude/skills/add-topic/SKILL.md).
Mechanically, a new topic is just a `.md` file dropped into that
section's folder with the frontmatter above (`src/lib/content.ts` picks
up every file under `src/content/**/*.md` automatically via
`import.meta.glob`, no registry change needed) — but the skill also runs
an independent review against the Writing Standard below (re-run after
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
- A System Design case study applies topics to one design; it doesn't
  re-teach a topic's mechanism (that's the topic's job, one link away). Where
  the design uses a topic, it says what that choice buys and costs here, in
  this design's numbers, then links. Its estimates are worked arithmetic that
  follows from its stated requirements, every deep dive compares at least two
  options, and it describes a plausible design ("a URL shortener like
  TinyURL"), never how a specific company built theirs.
- A systems topic's `Where you'll meet this` section says what the topic does
  in a kind of system, in terms of what the topic just taught; it doesn't
  re-teach the mechanism. It makes claims about generic systems only, never
  about how a specific company builds something, because every claim has to be
  verifiable.
- Every substantive technical claim is independently verified against
  real knowledge of the subject before publishing, not assumed correct
  because it reads confidently.

## What's deliberately not built here

Tags, interactive step-through pages, Mermaid diagrams, interactive
(pan/zoom) diagrams, end-to-end (Playwright) tests, and an in-app editor or
CMS are all out of scope for now — the app is intentionally kept to sections +
search + markdown rendering + dark mode, plus the System Design case studies
above and their build-time D2 diagrams (static SVGs; D2 itself never runs in
CI or in the browser). The case studies are a bounded exception to the earlier
"no domain split, no reading paths" stance: they add one ordered list of
worked designs that link into the catalog, but not tracks, curricula or a
domain hierarchy over it, and catalog URLs, section pages and the topics' own
prose are unchanged. Add one of the deferred items only if a real need shows up, not
speculatively.

The equivalent list for _process/tooling_ practices (CI gates, hooks,
agent-workflow scaling) considered and deliberately deferred, each with
its actual reasoning and a concrete revisit condition, lives in
[docs/DEFERRED_PRACTICES.md](docs/DEFERRED_PRACTICES.md).

## How changes land

Every change, including a small direct fix, lands through a branch and a pull
request and merges only when CI passes; nothing is committed directly to
`main`. That is how CI runs before a change goes live: two commits with
failing tests once reached `main` and deployed because they were pushed
straight to it. A dependency update (a Dependabot pull request, or a version
bump done by hand) is a direct change, not a `/feature`: run `npm run verify`,
read the release notes for a major version, and let CI decide; patch and minor
Dependabot updates merge on their own once CI passes (README, "Repository
settings this relies on"). The skills still end at "ready to commit"; committing,
pushing and opening the pull request wait for the user's go-ahead.

## Verifying a change

`npm run verify` is exactly what CI runs (`ci.yml` calls it), and
is the gate `/feature`, `add-topic` and `add-case-study` run (the eval and audit skills run
only the checks they name). The deploy workflow runs it too, so a
commit that fails any check never goes live. The individual commands, if you need one:

```bash
npm run typecheck && npm run lint && npm run format:check
npm run check:colors && npm run check:tokens && npm run check:contrast && npm run check:npm-refs && npm run check:pipeline-log && npm run check:raw-html && npm run check:diagrams
npm run test:run
npm run build
npm run size && npm run check:bundle
```

`npm run check:test-lock` and `npm run review:diff` are not part of `verify`
or CI: `/feature` uses them inside a run. `check:test-lock` proves no test
file or test-runner config changed after Stage 2 (`-- --snapshot`, then `-- --verify`, then
`-- --clear`); `review:diff` prints the reviewer's diff, including new
untracked files.

`npx knip --no-progress` is an on-demand dead-code check (unused files,
exports and dependencies), not part of `verify` or CI and not a dependency
(npx fetches it); run it after removing or moving code, and expect no output.
`knip.json` holds its verified false positives: `.claude/hooks/*.js` are entry
points (Claude Code runs them from `.claude/settings.json`, which knip doesn't
read), `src/lib/diagram-refs.d.mts` is used by tsc rather than imported, and
`d2` is an external binary, not an npm package. Why it isn't a CI gate is in
docs/DEFERRED_PRACTICES.md.

`npm run check:diagrams` needs no d2: it proves the committed SVGs match their
`.d2` sources and their own recorded bytes (the source and SVG hashes in
`public/diagrams/manifest.json`), that the `--color-*` tokens recorded there
under `$tokens` still match `src/index.css` (every top-level `:root`/`.dark`
block, the later value winning as in CSS; `check:contrast` and `check:tokens`
read them through the same `readThemeTokens` in `scripts/css-tokens.mjs`,
which fails loudly on a `--color-*` token declared anywhere else, such as
under `@media`, or with a value other than 3- or 6-digit hex)
and keep diagram text at 4.5:1 on every fill, that no `.d2` names a color or imports a file, that every `.d2`
sits at `<case>/<name>.d2` in lowercase kebab-case (the rule `npm run diagrams`
renders by, `SOURCE_PATH`), that no SVG is missing or orphaned and nothing
but `manifest.json` and `<case>/<name>.light.svg`/`.dark.svg` sits under
`public/diagrams/`, that every SVG passes an allowlist built from what d2 v0.9
emits, and that every diagram a case study references exists. References are
found by parsing the case study with the site's own markdown stack
(`diagramReferences` in `src/lib/diagram-refs.mjs`, which also holds the
`isDiagramSrc` rule `MarkdownRenderer` uses), so inline and reference-style
images count and an example inside code doesn't. The SVG allowlist: only listed
elements (no `<script>`, `<foreignObject>`, `<a>`, `<image>`, animation
elements, ...) and listed attributes, no event handlers, no comments, DOCTYPE
or processing instructions, and an XML declaration only in the exact form
`<?xml version="1.0"`, then optionally `encoding="utf-8"`, then optionally
`standalone="yes|no"`, single-spaced, then `?>`; attribute values with no backslash, quote or
character reference, `href`s only to `#fragment`s, and no function but
`url(#fragment)` (plus numeric transform functions in `transform`); `style`
attributes limited to a few numeric or keyword properties (`stroke-width`,
`font-size`, `text-anchor`, ...) with plain values; and in `<style>`, besides
rules with plain values and `font-family: "<name>"`, only `@font-face` blocks
whose one source is an embedded base64 `data:` font. Any other at-rule, quoted
string, function (`url()`, `image-set()`, ...) or CSS escape fails, so the
SVG, opened full size as a document, can't run script or fetch anything. The manifest format and the shared contrast and
safety code live in `scripts/diagram-manifest.mjs`. `npm run diagrams` is the one command that needs d2 (v0.9.x on PATH:
`scoop install d2`, `brew install d2`, or the install script at d2lang.com);
run it after adding or editing a `.d2` file and commit what it writes. It is
not part of `verify`, and CI never runs it.

`npm run dev` for manual checking: click through the home page, a section,
and a topic; open the System Design tab and a case study, follow a Contents
link and open a diagram full size, and check that a topic the case study links
(e.g. `/systems-and-infrastructure/caching`) shows its "Used in these case
studies:" back-link; toggle the theme and check the diagrams switch with it;
open search (`Ctrl`/`Cmd`+K) and confirm a topic and a case study are each
findable by title and by a body phrase.

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
is now about 91 KB brotlied with a 104 KB limit (it was 100 KB until the eager
System Design question pages were replaced by lazily loaded case studies), and
each topic and case-study body is its own chunk. Adding content no longer
touches it; a case study's topic links reach it as a small build-time list (the
`?links` query), not as text. What still grows it is app code.
`npm run check:bundle` guards the split itself: after a build it fails if a
topic's or case study's body text is in the main chunk, or in no chunk at all.
The markdown chunk's entry points at `MarkdownRenderer-*.js` because
`TopicPage` and `CaseStudyPage` share it.
