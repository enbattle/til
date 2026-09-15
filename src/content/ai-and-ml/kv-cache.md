---
title: KV Cache
summary: Why generating a long response doesn't get proportionally slower per token, and the memory cost that tradeoff actually creates.
date: 2026-09-14
---

A language model generates its response one token at a time: produce a
token, feed the whole sequence so far back in, produce the next token,
and repeat. Without a specific optimization, each of those steps would
mean recomputing the model's understanding of every token that came
before, from scratch, every single time — the **KV cache** is what makes
that unnecessary, and it's the reason generating a long response doesn't
get proportionally slower with every additional token.

## What "understanding a token" actually involves

Most modern language models are built as a **transformer**: a stack of
identical layers, each of which lets every token exchange information
with every earlier token before passing its updated understanding up to
the next layer. The mechanism that does that exchanging within each layer
is called **attention**, computed from three projections of every token:

- **Query (Q)** — roughly, "what is this token looking for?"
- **Key (K)** — roughly, "what does this token contain, for the purpose
  of being found by something else?"
- **Value (V)** — roughly, "what should get passed along if this token is
  a match?"

A token attends to every earlier token by comparing its own Query against
every earlier token's Key, and pulling in a weighted mix of their Values.
Crucially, once a token has been processed, its Key and Value **never
change again** — they depend only on that token and the ones before it,
not on anything generated afterward. Only a brand-new token, the one
currently being generated, needs a freshly computed Query.

## Caching the part that never changes

That fact is exactly what the KV cache exploits: instead of recomputing
Key and Value for every previous token on every single generation step,
compute each token's Key and Value exactly once, store them, and reuse
them for every future step.

```
Token 1: compute Q₁, K₁, V₁ → store K₁, V₁
Token 2: compute Q₂ only    → reuse stored K₁,V₁ → store K₂, V₂
Token 3: compute Q₃ only    → reuse stored K₁,V₁,K₂,V₂ → store K₃, V₃
...
```

Without this, step _k_ of generating a response would redo the full set of
Key/Value projections — and the surrounding per-layer computation, like
the MLP block — for all _k_ tokens seen so far, from scratch, every time.
With the cache, step _k_ skips all of that for every previously seen
token: it only computes a fresh Query, Key, and Value for the one new
token, and reuses everything stored before. The attention step itself
still has to compare that new Query against all _k_ cached Keys, so the
score computation isn't free — summed over a whole response of length
_n_, that part still adds up to something proportional to _n_². What the
cache actually removes is the far more expensive redundant work: re-running
the full K/V projection and MLP computation for every earlier token on
every step. So the honest framing isn't that generation becomes linear
overall — it's that the expensive part of each step (projection,
MLP) becomes proportional to n instead of n², leaving only cheap vector
comparisons to scale with the growing history, which is what keeps a long
response from getting dramatically slower per token than a short one.

## The tradeoff: memory, not computation, becomes the limit

The cache isn't free — every cached Key and Value has to sit in memory
for as long as that conversation is active, and the cache grows with
every token generated. A model handling many simultaneous conversations
needs a separate, growing cache for each one, all held in memory at the
same time. This is why, in practice, serving a language model to many
users at once is very often limited by how much memory is available to
hold all those caches, not by how fast the underlying computation can
run — the opposite bottleneck from what "the cache makes things cheaper"
might suggest on its own. A meaningful amount of engineering effort
in how models are served goes into exactly this: techniques for sharing
cache memory across requests where it's safe to do so, compressing what's
stored, and organizing memory so it isn't wasted on gaps between
differently sized caches — different names and implementations of this
idea come and go, but the underlying problem they're all solving is the
one described here.
