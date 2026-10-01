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
