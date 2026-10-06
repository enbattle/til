---
title: KV Cache
summary: The KV cache stores each token's attention keys and values so generation never recomputes them, trading repeated computation for memory that grows with every token.
date: 2026-09-14
---

Suppose you are chatting with a model, and the conversation so far is 4,000 [tokens](/ai-and-ml/tokenization) long. The model writes its reply one token at a time: it reads everything so far, produces one token, appends it, and reads everything again for the next one. Do that naively and token 4,001 costs a full pass over 4,000 tokens, token 4,002 costs a full pass over 4,001, and so on. Why doesn't a long reply crawl? Because most of that rereading is wasted, and the **KV cache** is how the model skips it. This page follows that one 4,000-token conversation through what the cache saves and what it costs.

## What gets reused

Most of today's large language models are **transformers**: a stack of layers, each of which lets every token look at the tokens before it. That looking is called **attention**. In each layer, every token is turned into three vectors (lists of numbers):

- A **query**, which says what this token is looking for.
- A **key**, which says what this token offers to other tokens' searches.
- A **value**, which is the content passed along if the key matches.

A token compares its query against the key of every earlier token, then takes a weighted mix of their values, weighted by how well each key matched. A token's key and value depend only on that token and the ones before it. Tokens generated later cannot change them. So when your 4,000-token conversation gets its 4,001st token, the keys and values for the first 4,000 are exactly what they were a step ago.

The cache is simply that observation put to work. Compute each token's key and value once, in every layer, store them, and on each later step compute only the new token's query, key and value. Compare the new query against the stored keys and read off the stored values.

## What the cache saves

Without the cache, each step redoes the projections that produce keys and values, and the rest of each layer's per-token work, for every token so far. With it, each step does that work for one token. The expensive work per step stops growing with the length of the history.

The cache does not make attention free. What disappears is every earlier token's repeated work: its projections and its own attention, recomputed at every step without a cache. Only the new token's comparison against the stored keys remains, and that part still grows with the history, adding up over a whole reply to roughly the square of the conversation's length.

One more detail. Before the first new token, the model must process your whole prompt, which fills the cache with the prompt's keys and values. Systems call this **prefill**, and it can run over many prompt tokens at once. After that comes the one-token-at-a-time stage, called **decode**, where the cache pays off on every step.

## What the cache costs

The cache has to sit in memory for as long as the conversation is live. How much? Every token stores one key and one value in every layer. Take a model with these numbers:

- 32 layers.
- 8 key-value heads per layer. A **head** is one of several attention computations run side by side, each with its own keys and values. Some models give several query heads the same key-value head to shrink the cache, which is why this count can be smaller than the model's number of query heads.
- 128 numbers per key or value in each head, called the head dimension.
- 2 bytes per number, as in a 16-bit format.

One token then needs 2 (a key and a value) × 32 layers × 8 heads × 128 numbers × 2 bytes = 131,072 bytes, which is 128 KiB. Your 4,000-token conversation needs 4,000 × 128 KiB = 500 MiB, and it grows by 128 KiB with every token added.

Now serve 20 such conversations at once. That is 10,000 MiB, close to 10 GiB, just for caches, on top of the memory holding the model's own weights. The weights are shared by every conversation, but each conversation needs its own cache. This is why serving many users at once is often limited by memory rather than arithmetic speed, and why a longer [context window](/ai-and-ml/context-window) is not free: the cache grows in direct proportion to the tokens held.

## How serving systems cope

Several tricks follow from the arithmetic above. You can shrink the per-token cost: fewer key-value heads, as noted earlier, or storing keys and values in fewer bytes per number, which trades a little accuracy for memory. You can stop wasting space: conversations grow unpredictably, so reserving one contiguous block sized for the longest possible reply strands memory, and serving systems instead hand out cache memory in small chunks as it is needed. And you can share: if many requests begin with the same text, such as one long system prompt, the cache for that shared start can be computed once and reused instead of recomputed per request. Some providers expose this as prompt caching, which usually makes a repeated prefix cheaper or faster, though the terms vary by provider.

**Rule of thumb.** The cache turns repeated computation into stored memory, so cost scales with tokens held times the number of conversations. To estimate it, multiply two (key and value) by layers, key-value heads, head dimension and bytes per number to get bytes per token, then multiply by tokens, and keep a shared prompt prefix identical across requests so it can be cached once.
