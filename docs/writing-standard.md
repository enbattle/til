# Writing standard

The bar every published topic, case study and DSA entry meets. Every
reviewer of published prose is given this file;
[docs/NON_NEGOTIABLES.md](NON_NEGOTIABLES.md) #4 makes it binding.

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
  not a short "gotcha" note. (Every page has a word budget; the two
  sections below say how catalog topics, case studies and DSA entries meet
  this standard within it.)
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
  follows from its stated requirements, every key decision names the
  alternative it turns down, and it describes a plausible design ("a URL
  shortener like TinyURL"), never how a specific company built theirs.
- A systems topic's `Where you'll meet this` section says what the topic does
  in a kind of system, in terms of what the topic just taught; it doesn't
  re-teach the mechanism. It makes claims about generic systems only, never
  about how a specific company builds something, because every claim has to be
  verifiable.
- Every substantive technical claim is independently verified against
  real knowledge of the subject before publishing, not assumed correct
  because it reads confidently.

## Catalog topics

A topic under `src/content/` teaches one idea from zero background, and it is
where case studies and DSA entries send a reader for more. It gets more room
than those pages, but not unlimited room: a reader should finish it in one
sitting.

- **Five minutes at most.** At most 1,000 words of prose, about 5
  minutes at 230 words a minute; aim for 600–900 (3 or 4 min). Words count as in the section below (tables count; code blocks and
  frontmatter don't). In code, `src/lib/reading-time.ts` owns the number as
  `CATALOG_WORD_BUDGET`, which `src/content/topic-structure.test.ts` imports.
- **The lecturer voice and one running example**, exactly as the section
  below describes them: talk to the reader, ask their next question, and carry
  one example from the first section to the last instead of starting a new one
  per section.
- **A closing rule of thumb.** The body ends with one paragraph that opens
  with bold `**Rule of thumb.**` and gives the rule a reader should carry away
  ("**Rule of thumb.** Cache what is read often and changes rarely."). In
  `systems-and-infrastructure`, it is the last block before
  `## Where you'll meet this` (docs/content.md), which stays the last section.
- **One title pattern.** A plain noun phrase ("Consistent Hashing") or
  "X vs. Y" ("Latency vs. Throughput"). Join with "and", never "&". No
  "What is…", "What are…" or "What's…" opener, and no subtitle of any kind
  (colon, dash, `--` or parenthetical). The one exception is a trailing
  all-caps acronym gloss in parentheses ("Cross-Site Scripting (XSS)"), which
  is allowed and isn't a subtitle.

`topic-structure.test.ts` checks the budget, the title and the rule-of-thumb
paragraph on every topic.

## Case studies and DSA entries

These pages prepare a reader to talk through a design or a problem in an
interview. A reader who zones out halfway learns nothing, so they trade
completeness for a page someone finishes and remembers. Where a rule above
pulls the other way, this section decides for these pages; catalog topics
teach more depth, and they are where these pages send a reader for more.

- **About five minutes.** At most 1,150 words of prose, about five minutes at
  230 words a minute. Tables count; code blocks, diagrams and frontmatter
  don't. This is the canonical home for both numbers; in code,
  `src/lib/reading-time.ts` owns them as `WORDS_PER_MINUTE` and `WORD_BUDGET`
  (five minutes' worth), which both structure tests import.
- **Enough to reason, not everything.** An interview never covers every
  scenario, and a reader will be asked things no page mentions. Teach the few
  decisions that shape the answer and the reasoning behind each, well enough
  that the reader can make an educated guess at a question the page never
  asked. Leave out an exception or edge case that doesn't change a decision.
- **Why not the obvious alternative?** Interviewers push on this, so every
  decision names the alternative a reader would suggest and why it loses here,
  in a sentence or two. One alternative, not a survey of all of them.
- **The rule behind it.** A decision ends with the general rule it
  illustrates ("read-heavy and fine with slightly stale data: cache in
  front"), since the rule is what transfers to the next question.
- **A good lecturer's voice.** Talk to the reader as "you", the way someone
  who loves the subject thinks out loud in front of a class. Ask the question
  the reader is about to ask, then answer it. Carry one running example
  through the page instead of starting a new one per section, and let each
  section hand off to the next ("That gets codes minted. Serving them fast is
  the harder part."). Keep paragraphs to a few sentences. The energy comes
  from pace and concrete examples, never from exclamation marks, hype words or
  the stock phrases banned above.
- **Zero background, briefly.** Define a term in a short phrase at first use
  and link the catalog topic for the rest, rather than teaching it here.
- **Code explains itself.** In a DSA entry, comments carry the reason behind a
  line, at the line where the obvious alternative would break
  (`lo = mid + 1  # mid was already checked; keeping it can loop forever`).
  They don't narrate what each line does. The prose after a chunk of code
  connects it to the next step.
