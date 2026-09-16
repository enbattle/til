---
title: Context Window
summary: The shared token budget every model call draws on, why going over it is dangerous in ways that fail silently, and the tradeoffs for staying under it.
date: 2026-09-14
---

The **context window** is the maximum number of [tokens](/ai-and-ml/tokenization)
a language model can process in a single call — everything the model can
"see" at once, from the first instruction to the last word it generates.
It's a single shared budget, not two separate ones: the system prompt,
the conversation history, any documents you've pasted in, the user's
question, and the model's own output all draw from the same pool.

```
system prompt + conversation history + retrieved documents + question + output
  must all fit inside the context window
```

## What happens when you go over

Exceeding the limit doesn't degrade gracefully. Depending on the system,
it either fails outright with an error, or — worse — silently truncates
something to make room. Silent truncation is especially dangerous when
the context is built from retrieved documents: the piece that gets cut to
make room might be the one document that actually answered the question,
and nothing in the response will tell you that happened. Nothing tells
you when that budget is blown, so you have to manage it actively.

## Why bigger isn't simply better

It's tempting to treat a larger context window as a problem-solver on its
own — just paste in everything the model might need, and let it figure
out what's relevant. Two things push back on that:

- **Cost.** Every token in the context is billed on every call, including
  tokens that repeat identically across many requests (a long system
  prompt, a set of few-shot examples). Those repeated tokens are the most
  worth trimming, since their cost multiplies across every single request
  that includes them, not just the one where they were written.
- **Attention isn't free just because the tokens fit.** A model that
  technically accepts a huge amount of text doesn't necessarily reason
  equally well about all of it — information buried in the middle of a
  very long context can get less effective attention than information
  near the beginning or end. Fitting inside the window and being reasoned
  about well aren't the same guarantee.

## Three ways to stay under budget

- **Retrieve only what's relevant, instead of pasting in everything.**
  Rather than stuffing a model's context with an entire knowledge base,
  fetch just the handful of documents most relevant to the current
  question and include only those — the technique this enables is called
  [retrieval-augmented generation](/ai-and-ml/what-is-rag), and it can cut
  the context needed for a given question by one or two orders of
  magnitude compared to including everything up front.
- **Summarize long material before using it**, rather than including it
  in full. A long document can be compressed into a shorter summary in an
  earlier pass, and that summary — not the original — is what actually
  goes into the final prompt.
- **Trim old conversation history.** In a long-running chat, older turns
  contribute less and less to answering the current question; keeping
  only the most recent exchanges (or a running summary of everything
  before them) keeps the context from growing without bound as a
  conversation continues.

## Choosing between a huge context and retrieval

For a small, fixed set of documents — small enough that everything
plausibly relevant fits comfortably inside the budget at once — pasting
it all in and letting a large context window handle it is the simpler
design: no retrieval system to build, no risk of the wrong chunk
being retrieved. Once the underlying knowledge base is too large for that
to hold — dozens or hundreds of documents rather than a handful — the
cost and reasoning-quality tradeoffs above start to favor retrieving only
what's relevant instead. There's no fixed line where one becomes clearly
right; the honest answer for a case in the middle is usually to benchmark
both rather than assume.
