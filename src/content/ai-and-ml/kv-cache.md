---
title: KV Cache
summary: The KV cache stores each token's attention keys and values so generation never recomputes them, trading repeated computation for memory that grows with every token.
date: 2026-09-14
---

Suppose you are chatting with a model, and the conversation so far is 4,000 [tokens](/ai-and-ml/tokenization) long, the small pieces of text a model reads and writes. You ask a question and the reply streams back, a few tokens at a time. A long reply doesn't crawl, yet the obvious way to generate it would redo almost all of its work at every token. How does the model avoid that?

This page covers how a model writes one token at a time, the work that would be repeated if it did nothing about it, the **KV cache** that skips that work, and the memory the cache costs.

## How a model writes a reply

A model never writes a whole reply in one go. It reads the whole conversation, picks one next token, adds it to the end, and then reads the longer conversation to pick the one after. Your 4,000 tokens become 4,001, then 4,002, and the loop runs until the reply is done.

Inside the model, the text passes through a stack of **layers**, steps it goes through in turn. In each layer, every token looks back at the tokens before it and pulls in whatever is useful, so that "it" can pick up what "the cat" referred to. This looking back is called **attention**.

Here is how one token looks back. Each earlier token has put out a label, a list of numbers saying what it is about, and a content, another list of numbers holding what it can pass along. The new token makes up a question, a third list, and compares it with every label. The better a label matches, the more of that token's content it takes in. That gives three lists per token, in every layer:

- A **query**: the question this token asks.
- A **key**: the label other tokens' questions are compared against.
- A **value**: the content handed over when a key matches.

Building these three lists takes computation, and it happens for every token in every layer. That sets up the trouble.

## The work that gets repeated

Suppose the model keeps nothing between steps. To pick token 4,001, it builds keys and values for all 4,000 earlier tokens, in every layer. To pick token 4,002, it builds them for 4,001 tokens, and so on. For a 500-token reply:

```text
tokens rebuilt per reply:  500 steps × at least 4,000 tokens = at least 2,000,000
```

But look at what a key and a value depend on: only their own token and the tokens before it. Tokens added later can't change them. So the keys and values for the first 4,000 tokens are exactly what they were a step ago, and nearly all of those 2,000,000 rebuilds produce a number already known.

## Keeping them

The fix is to store them. Build each token's key and value once, in every layer, and keep them in memory. This store is the **KV cache** (K for key, V for value). Each new step then builds the query, key and value for the new token only, compares the new query against the stored keys, and reads off the stored values.

```text
tokens rebuilt per reply:  500 steps × 1 token = 500, instead of 2,000,000
```

So the cache rebuilds nothing old. The comparison of the new query with every stored key still happens, so a step still costs more as the history grows, but that is far cheaper than redoing every token's work.

One more detail. Before the first new token, the model must read your whole prompt, which fills the cache with the prompt's keys and values. This stage is called **prefill**, and it can run over many prompt tokens at once. The one-token-at-a-time stage after it is called **decode**, and the cache pays off on every decode step.

The cache saves computation, but it has to be stored somewhere.

## What the cache costs

The cache stays in memory as long as the conversation is live, because the next token needs it. Every token stores one key and one value in every layer. Take a model with these numbers:

- 32 layers.
- 8 key-value heads per layer. A **head** is one of several attention computations run side by side, each with its own keys and values. Some models let several question-asking heads share one key-value head to shrink the cache, so this count can be smaller than the model's total number of heads.
- 128 numbers per key or value in each head (the head dimension).
- 2 bytes per number, as in a 16-bit format.

```text
one token:   2 (key and value) × 32 layers × 8 heads × 128 numbers × 2 bytes
           = 131,072 bytes = 128 KiB
your chat:   4,000 tokens × 128 KiB = 512,000 KiB, about 500 MiB
```

It grows by 128 KiB with every token added.

Now serve 20 such conversations at once: 20 × 500 MiB = 10,000 MiB, close to 10 GiB, just for caches. The model's own weights, the learned numbers that make up the model, are shared by every conversation, but each conversation needs its own cache. This is why serving many users at once is often limited by memory, not arithmetic speed, and why a longer [context window](/ai-and-ml/context-window), the most tokens a model can hold at once, isn't free: the cache grows in direct proportion to the tokens held.

## How serving systems cope

Several tricks follow from that arithmetic. Shrink the per-token cost with fewer key-value heads, as above, or by storing numbers in fewer bytes, which trades a little accuracy for memory. Stop wasting space: conversations grow unpredictably, so reserving one contiguous block sized for the longest possible reply strands memory, and serving systems hand out cache memory in small chunks as needed. And share: if many requests begin with the same text, such as the same long instructions sent ahead of every conversation, the cache for that start can be computed once and reused. Some providers offer this as prompt caching, usually at a lower price.

**Rule of thumb.** The cache turns repeated computation into stored memory, so cost scales with tokens held times the number of conversations. Multiply two (key and value) by layers, key-value heads, head dimension and bytes per number to get bytes per token, then multiply by tokens, and keep a shared prompt prefix identical across requests so it can be cached once.
