# Writing standard

The bar every published topic and case study meets. Every
reviewer of published prose is given this file;
[docs/NON_NEGOTIABLES.md](NON_NEGOTIABLES.md) #4 makes it binding.

Every topic is written so a reader with **zero prior background** on the
subject can walk away with real understanding — possibly needing a second
pass on denser subjects, not assumed on the first read. Concretely:

- Build up from first principles, at a beginner's pace;
  [Teaching progression](#teaching-progression) below says how.
- Prefer concrete examples (code, a worked scenario) over abstract
  description.
- The `summary` frontmatter field is a one-sentence scannable hook — it's
  the only place terseness is the goal. The body is a teaching write-up,
  not a short "gotcha" note. (Every page has a word budget; the two
  sections below say how catalog topics and case studies meet this standard
  within it.)
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
  alternative it turns down, and it describes a plausible design, not a
  specific company's (see "Named companies" below).
- A systems topic's `Where you'll meet this` section says what the topic does
  in a kind of system, in terms of what the topic just taught; it doesn't
  re-teach the mechanism. It makes claims about generic systems only (see
  "Named companies" below).
- Every substantive technical claim is independently verified against
  real knowledge of the subject before publishing, not assumed correct
  because it reads confidently.
- **Named companies.** This rule covers every published page. A product may
  be named as a familiar example ("a URL shortener like TinyURL"), for its
  documented public behavior (a "Log in with Google" button uses OpenID
  Connect), or as an example of a category of tool. Never describe how a
  specific company builds its systems or runs its teams internally: that can't
  be verified from outside, and it goes stale without anyone noticing.

## Teaching progression

Pace, not length, loses a beginner: a page that moves faster than its reader
loses them however long it is. These rules set the pace for every topic and
case study. Breaking one is a real finding (Medium), not polish. Published
pages meet them when they are next rewritten, and `content-audit` reports the
ones that don't yet.

- **Four stages, in order.** (1) The reader's situation: a concrete scenario,
  with a number where the subject has one, and the question the page answers
  in one plain sentence. (2) The route: before the first `##` heading, one
  sentence naming what the page covers, in order ("the obvious formula, why it
  breaks when you add a server, and the ring that fixes it"). Naming the
  content this way isn't the meta-commentary banned above, which is talk about
  what is interesting or important. (3) The core idea, built one step at a
  time. Where a reader would first suggest something simpler, start there and
  show it fail on the running example. (4) Only then the complications,
  costs, variations and product specifics.
- **Describe, then name.** A new term is any word a zero-background reader
  couldn't define. A term the page teaches is shown before it is named ("bend
  the range into a circle… give this ring 100 positions"), and gets a plain
  sentence of its own plus an example. A term the page only uses gets a short
  gloss where it first appears, as in "entropy (randomness)", at most one gloss
  per sentence, and a link to the page that teaches it. At most two new terms
  per paragraph, and none before its definition or gloss.
- **One job per paragraph**: set up a problem, explain one step, or work one
  example. A paragraph over five sentences is almost always doing two.
- **End each stage on the next problem**, so the reader knows why the next
  section exists ("It works, until the number of servers changes."; "That
  gets codes minted. Serving them fast is the harder part."). Vary the
  wording: these are examples, not a formula. A new heading alone is not a
  transition.
- **Show the arithmetic.** Every derived figure shows its steps from the
  running example's numbers, one operation at a time (a code block is fine),
  ending in the result the prose uses. Never a bare result the reader can't
  check, such as "true for 1 hash value in 5". A chosen input ("give the ring
  100 positions") needs no working.
- **Restate the model after the hardest step**, in one line, so a reader who
  struggled has the gist before going on ("So the ring keeps moves small, and
  virtual nodes keep shares even.").

In a case study, the template ([docs/case-studies.md](case-studies.md)) fixes
the section order. Its intro holds stages 1 and 2. `Start simple` is stage
3's simple version: the design a reader would suggest first, shown breaking on
this design's numbers. The architecture comes before Key numbers, so each
figure sizes a part the reader has already met, and its derivation writes out
its steps (`40 million ÷ 86,400 seconds ≈ 460 a second`). Each decision is a
stage-3 build too: the simpler option, where it breaks in this design's
numbers, then the choice and its cost, with the rule of thumb as the one-line
restatement.

## Catalog topics

A topic under `src/content/` teaches one idea from zero background, and it is
where case studies send a reader for more. It gets more room than those
pages, but not unlimited room: a reader should finish it in one sitting.

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

[docs/content.md](content.md) says which of these rules
`topic-structure.test.ts` enforces.

## Case studies

These pages prepare a reader to talk through a design in an interview. A
reader who zones out halfway learns nothing, so they trade completeness for a
page someone finishes and remembers. Where a rule above
pulls the other way, this section decides for these pages; catalog topics
teach more depth, and they are where these pages send a reader for more.

- **About ten minutes.** At most 2,300 words of prose, about ten minutes at
  230 words a minute; aim for roughly 1,700–2,000, not the cap. Tables count;
  code blocks, diagrams and frontmatter don't. This is the canonical home for
  these numbers; in code, `src/lib/reading-time.ts` owns them as
  `WORDS_PER_MINUTE` and `WORD_BUDGET` (ten minutes' worth);
  `case-study-structure.test.ts` imports `WORD_BUDGET`.
- **Enough to reason, not everything.** An interview never covers every
  scenario, and a reader will be asked things no page mentions. Teach the few
  decisions that shape the answer and the reasoning behind each, well enough
  that the reader can make an educated guess at a question the page never
  asked. Leave out an exception or edge case that doesn't change a decision.
- **Why not the obvious alternative?** Interviewers push on this, so every
  decision starts from the alternative a reader would suggest and shows where
  it breaks in this design's numbers before making its choice. One
  alternative, not a survey of all of them.
- **The rule behind it.** A decision ends with the general rule it
  illustrates ("read-heavy and fine with slightly stale data: cache in
  front"), since the rule is what transfers to the next question.
- **A good lecturer's voice.** Talk to the reader as "you", the way someone
  who loves the subject thinks out loud in front of a class. Ask the question
  the reader is about to ask, then answer it. Carry one running example
  through the page instead of starting a new one per section, and let each
  section hand off to the next, as "Teaching progression" says. The energy comes
  from pace and concrete examples, never from exclamation marks, hype words or
  the stock phrases banned above.
- **Zero background, briefly.** Define a term in a short phrase at first use
  and link the catalog topic for the rest, rather than teaching it here.
