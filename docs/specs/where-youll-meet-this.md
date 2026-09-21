# "Where you'll meet this" on every systems topic

## Context

The System Design tab starts from a question and routes into catalog topics.
The reverse direction is missing: a topic explains a mechanism well, but
doesn't say which kinds of real systems a reader would need it for. That
matters because people rarely meet a topic in isolation; they meet it inside
a system (a checkout flow, a news feed, a chat app), and knowing which
systems a topic belongs to is what connects the topics to each other.

Some topics already do this informally under a closing heading of their own
("Where this shows up constantly", "Where it applies", "What this actually
coordinates in practice", ...), unevenly and without a shared vocabulary.
This change makes it a convention: every `systems-and-infrastructure` topic
ends with one section, `## Where you'll meet this`, that names concrete kinds
of systems and what the topic does in them.

## Decisions already made (with the user)

- The section is written by hand per topic, not generated (a generated list of
  "used in these questions" already exists on every topic page).
- It applies to `systems-and-infrastructure` topics only; topics in other
  sections don't need it.
- A small fixed set of recurring reference systems is used across topics, so
  seeing the same systems again and again is what connects the topics.
  Walkthroughs of whole systems ("design a news feed") may come later and would
  reuse the same set; nothing here should make that harder.
- Claims stay general ("a payment system"), never about how a specific
  company implements something, because the Writing Standard requires every
  claim to be verified and internals of a named company can't be.

## The convention

Every topic under `src/content/systems-and-infrastructure/` ends with a
final `##` section named exactly `Where you'll meet this` (straight
apostrophe).

**Reference systems** (choose the two or three where the topic genuinely
matters; name a system outside the set only when none of these fit):

- **Payments and checkout**: charging a card, placing an order, reserving stock.
- **A news feed or timeline**: many readers, fewer writers, personalized per reader.
- **Chat and messaging**: real-time delivery, per-conversation ordering, history.
- **A URL shortener**: an extreme read-to-write ratio over a simple key-value lookup.
- **A notification or email pipeline**: fan-out to many recipients, queues, retries.

**Content rules:**

1. Two to five sentences, or a short list of at most four items. Vary the
   shape from topic to topic; not every section is a bullet list.
2. For each system named, say what the topic does there, in terms of what the
   topic just taught. Don't re-teach the mechanism.
3. General kinds of systems only. No claims about how a named company builds
   something. Every claim must be true of the generic system described.
4. A topic that already ends with a "where this shows up" style section gets
   that section **renamed and reworked into this one**, not a second section
   added beside it. Keep any correct, useful content from the old section.
5. Change nothing else in the topic (the rest of its prose is out of scope).

## Acceptance criteria

These become tests (a content-structure test over the real topics).

1. Every topic whose section is `systems-and-infrastructure` has exactly one
   `##` heading whose text is exactly `Where you'll meet this`. Headings inside
   fenced code blocks don't count.
2. That heading is the **last** `##` heading in the body.
3. The text under it (to the end of the body) is at least 25 words.
4. Topics in other sections are not held to it (a test that names no other
   section must not fail on them).
5. The check enumerates topics from the real content (via `TOPICS`), so a
   new systems topic without the section fails until it has one.

## Docs, skills and process to update

- `CLAUDE.md`: Content architecture (the convention and reference systems) and
  the Writing standard (the section is held to the same rules; general claims only).
- `.claude/skills/add-topic/SKILL.md`: a new systems topic gets the section in
  Stage 1, and the Stage 3 reviewer is told to check it.
- `.claude/skills/content-audit/SKILL.md`: add a check that these sections stay
  general and accurate.

## Explicitly out of scope

- Topics in other sections; changes to any part of a topic other than the
  closing section; new topics (those come later and will include the section);
  walkthroughs; generated content.
