---
title: Tokens and Context Windows
summary: What a language model actually reads text as, and why there's a limit to how much it can consider at once.
date: 2026-09-13
---

If you've used an AI chat assistant, you've probably seen the word
"token" mentioned — in pricing pages, error messages, or API
documentation. It's one of the most basic building blocks of how these
models actually work, and it's worth understanding directly rather than
treating it as jargon.

## Text isn't read as words or letters

A language model doesn't process text one character at a time, and it
doesn't process it one whole word at a time either. Instead, text is
broken into **tokens** — chunks that are often smaller than a word, using
a process called **tokenization**.

A common word like `the` might be a single token. A longer or less common
word, like `internationalization`, often gets split into several pieces —
something like `intern` + `ational` + `ization`. Punctuation, whitespace,
and even parts of code syntax each become their own tokens too.

Why not just use whole words? Two reasons:

- **Vocabulary size.** A model that had to know every possible whole word
  in every language, plus every misspelling, plus every made-up product
  name, would need an enormous lookup table. Breaking words into smaller,
  reusable pieces means the model can represent _any_ text — including
  words it's never seen before — out of a much smaller set of building
  blocks.
- **Consistency.** The same sub-word pieces show up constantly across
  different words (`-ing`, `-tion`, `un-`), so the model can learn what
  those pieces tend to mean once and reuse that knowledge everywhere they
  appear.

As a rough rule of thumb in English, a token is close to ¾ of a word on
average — so 100 tokens is roughly 75 words. This ratio shifts for other
languages and for code, where punctuation-heavy syntax tends to produce
more tokens per character.

## Why this matters practically

Tokens are the unit everything else is measured and priced in:

- **Cost.** API pricing for language models is typically quoted per
  million tokens, split between input tokens (what you send) and output
  tokens (what the model generates). A longer prompt or a longer
  conversation history costs more, token for token.
- **Speed.** Generating output happens roughly token by token, so a
  longer requested response takes proportionally longer to produce.

## The context window

A **context window** is the maximum number of tokens a model can consider
at once — combining the system instructions, the conversation history,
any documents you've included, and the response it's generating. It's
best thought of as the model's short-term working memory: anything that
doesn't fit inside it simply isn't visible to the model when it's
producing a response.

Context windows have grown enormously as models have improved — early
widely-used chat models could hold only a few thousand tokens at once,
while modern frontier models can hold context equivalent to a long book
or more. But "bigger" doesn't erase the underlying constraint, it just
raises the ceiling:

- A conversation, or a document, can still eventually exceed even a very
  large window, at which point the oldest content has to be dropped or
  summarized to make room.
- Very long contexts can be more expensive and slower to process than
  short, focused ones, even when they technically fit.
- A model can only act on what's actually inside the window at generation
  time — information mentioned earlier in a very long conversation may
  effectively be "forgotten" once it scrolls out of the window entirely,
  or become harder for the model to weigh correctly among everything
  else competing for attention.

## The practical takeaway

When you're building something on top of a language model rather than
just chatting with one, token counts stop being trivia and start being a
design constraint: how much of a document to include, how much
conversation history to keep versus summarize, and how to keep a prompt
focused instead of padding it with everything that might conceivably be
relevant. Keeping the context window in mind — instead of assuming "more
context is always better" — is one of the first practical skills in
working with these models effectively, and is a prerequisite for topics
like [prompt engineering](/ai-and-ml/prompt-engineering).
