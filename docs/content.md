# Content: topics and sections

How catalog topics are stored, loaded and added. Read this before adding or
changing a topic or a section; [CLAUDE.md](../CLAUDE.md) routes here.

## Content architecture

```
src/content/
  registry.ts          # every section: slug, label, description
  registry.test.ts      # asserts registry.ts matches the folders on disk
  redirects.ts          # old section/slug -> new, for moved or merged topics
  redirects.test.ts     # every redirect's shape, target and lack of chains
  topic-structure.test.ts  # the catalog standard (budget, title, rule of thumb,
                           # systems topics' closing section)
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
- **`title`, `summary`, and `date` are required, and are the only keys** (`TOPIC_FIELDS` in `src/lib/content.ts`) —
  `src/lib/content.ts` throws at load time, naming the file and the field, if
  any is missing or empty or if there's any other key (`checkFields` in
  `src/lib/frontmatter.ts`, shared with case studies), so
  `src/lib/content.test.ts`, which loads every topic, fails.
- **Frontmatter is eager, bodies are lazy.** `content.ts` reads each file's
  frontmatter at load through a `?meta` Vite query (the `markdownMeta` plugin
  in `vite.config.ts`), and each body's prose word count through a `?words`
  query (the read-time label), so `TOPICS` is metadata only and `Topic` has no
  `body`. Each loaded item carries its page route as `path` (`/<section>/<slug>`;
  `/system-design/<slug>` for a case study),
  set by its loader: link to an item with `item.path`, never a route built by
  hand.
  A body is fetched as its own small chunk by `loadTopicBody(section, slug)`
  (topic page) or `loadAllTopicBodies()` (full-text search, which starts
  loading when the search dialog opens). Case studies work the
  same way. Don't reintroduce an eager `?raw` glob over any of them:
  `npm run check:bundle` fails if any topic or case-study body ends
  up in the main chunk.
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
- The topic page builds an "On this page" list from the body's `##`
  headings: the right-hand nav from `xl` up, a sticky bar above the body that
  names the current section and opens the list on demand below that (no list when there are no `##` headings). Each entry links
  to the id its heading renders with (`h2Headings` in `src/lib/headings.ts`)
  and shows the heading's text with any inline markdown stripped; still, keep
  `##` headings plain text.

## Adding a topic to an existing section

Use the `add-topic` skill — see
[`.claude/skills/add-topic/SKILL.md`](../.claude/skills/add-topic/SKILL.md).
Mechanically, a new topic is just a `.md` file dropped into that
section's folder with the frontmatter above (`src/lib/content.ts` picks
up every file under `src/content/**/*.md` automatically via
`import.meta.glob`, no registry change needed) — but the skill also runs
an independent review against the [Writing Standard](writing-standard.md) (re-run after
fixes, capped as [content-review.md](content-review.md) says) before
calling it done, since this is the most frequent change in the repo and
otherwise the easiest one to skip review on entirely.

Every `systems-and-infrastructure` topic ends with a
`## Where you'll meet this` section: the exact heading (straight apostrophe),
with no `#` or `##` heading after it (nested ones in a blockquote or list
included), at least 25 words. It names the two or three kinds
of systems where the topic genuinely matters and says what the topic does
there, drawn from a small fixed set that recurs across topics so the same
systems connect them: payments and checkout, a news feed or timeline, chat
and messaging, a URL shortener, and a notification or email pipeline (name
one outside the set only when none fit).
`src/content/topic-structure.test.ts` enforces the heading, its position
and its length (prose words, as the read-time count has them). If a topic
already ends with a section about where it shows up, rename that section
instead of adding a second. Other sections' topics don't need it.

## The catalog standard

Every topic is held to the Writing Standard's
["Catalog topics"](writing-standard.md#catalog-topics) section.
`src/content/topic-structure.test.ts` enforces its mechanical parts on every
topic, with no exceptions: the word budget, the title pattern, the closing
rule-of-thumb paragraph, and a `systems-and-infrastructure` topic's closing
section. It runs the same checks on the content-review eval's drafts in
`evals/content-review/scenarios.md` (see
[verification.md](verification.md)). The running example and the lecturer
voice are checked in review.

## Moving, merging or renaming a topic

A catalog URL keeps working after its topic moves, so a bookmark or an
external link never breaks.

1. Move the file with `git mv` (to another section's folder, or to a new
   slug), so history follows it. For a merge, fold the old topic's content into
   the surviving one and delete the old file in the same change.
2. Repoint every link to the old path across `src/content` and
   `src/system-design` (`git grep -n "/<section>/<old-slug>"`).
   `src/lib/catalog-gaps.test.ts` fails on a dead internal link (to a topic or
   case study) in any topic or case-study body, so it
   catches any link this step misses; `src/lib/system-design.test.ts` also
   fails a case study's link to a topic that no longer exists.
3. Add an entry to `REDIRECTS` in `src/content/redirects.ts`, from the old
   `section/slug` to the new one. `TopicPage` checks it before falling back to
   /not-found and replaces the old URL with the new one; a hard load reaches it
   through `public/404.html`. If an existing entry pointed at the old path,
   repoint it at the new one too, since `redirects.test.ts` fails a chain.

Never remove a redirect: someone may still hold the old link. The one
exception is moving a topic back to a path a redirect starts from: delete that
entry in the same change, since the path is live again and
`redirects.test.ts` fails a redirect from a live topic.

## Adding a new section

1. Create the folder: `src/content/<new-section-slug>/`.
2. Add an entry to the `SECTIONS` array in `src/content/registry.ts`
   (`slug`, `label`, `description`). A label joins words with "and", never
   "&".
3. Add the new slug, in its place, to the pinned slug order in
   `src/content/registry.test.ts`, and its label to the pinned slug-to-label
   map there.
4. Add at least one topic file into the new folder.

`registry.test.ts` fails if the folder and the registry entry don't match
in both directions, if a label contains "&", or if the order or labels differ
from the pinned ones — a new section is only "done" once that test passes
again.
