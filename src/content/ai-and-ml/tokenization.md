---
title: Tokenization
summary: Why a language model never actually sees letters or words, and how that changes what it can and can't do reliably.
date: 2026-09-14
---

A language model never reads your text the way you do. Before anything
else happens, a **tokenizer** converts the raw string into a sequence of
integer IDs — the model's entire universe, going in and coming out, is
these IDs, never individual characters or whole words. Every quirk in
this piece explains something a model does that otherwise looks like a
bug.

## How a vocabulary of chunks gets built

The dominant approach, **byte-pair encoding (BPE)**, builds its
vocabulary by starting from individual bytes and repeatedly merging
whichever pair of symbols shows up most often in a huge body of training
text:

```
Start: every byte is its own token

Round 1: "t" + "h" appears constantly — merge into a single token "th"
Round 2: "h" + "e" appears constantly — merge into a single token "he"
Round 3: "th" + "e" appears constantly — merge into a single token "the"
...continue merging until the vocabulary reaches a target size
```

The result is a fixed set of chunks — some as short as a single letter,
some as long as a whole common word — learned from statistics, not from
any dictionary. Common English words like "the" end up as one token
apiece. Rare or unfamiliar words get split into multiple subword pieces,
and truly novel character sequences fall back to individual bytes. A
fixed vocabulary built this way can represent literally any string, even
ones the tokenizer never saw during training, which is exactly the
property that makes it usable at all.

## Why the model can't count the letters in a word it just split

The word "strawberry" is a good illustration of what this costs you. A
typical tokenizer doesn't see `s-t-r-a-w-b-e-r-r-y`; it sees something
closer to two chunks, roughly `["straw", "berry"]`. The model receives
two opaque token IDs, not ten characters — it has no direct way to look
inside a token and count how many times the letter "r" shows up, because
the letters inside a token were never presented to it as separate units
in the first place. Ask a model to count letters in a word and you're
asking it to reason about structure it was never actually shown.

The same effect shows up anywhere a task depends on structure _inside_ a
token rather than the token as a whole:

- **Arithmetic on large numbers.** A number like `1234567` might be split
  into pieces like `["123", "456", "7"]` rather than one digit at a time,
  which is part of why multi-digit arithmetic is a place models
  reliably struggle without extra help (writing out the steps, using a
  tool) — the digits aren't lined up the way a human doing long addition
  would see them.
- **Whitespace-sensitive code.** Four spaces of indentation and a tab
  character can tokenize completely differently, even though they might
  render identically in an editor, which can subtly affect how a model
  generates or edits indented code.

## Why some text costs more than other text

Because the vocabulary is learned from a training corpus, how well a
given language or format is represented in that corpus determines how
efficiently it tokenizes. English prose, heavily represented in most
training data, tends to compress into relatively few tokens per word.
Languages with less representation in that data — and scripts that don't
share an alphabet with the majority of the training text — routinely take
several times as many tokens to express the same meaning. Since every
API-based use of a model is billed per token, this isn't just a curiosity:
a support system handling a less-represented language can end up paying a
real multiple more per equivalent conversation than one handling English,
for no reason other than which language happened to dominate the training
data.

The same logic runs in reverse for compression: a verbose, padded
instruction like "Please carefully analyze the following passage and
provide a comprehensive summary of its key points" tokenizes into
noticeably more pieces than a terser instruction that asks for the exact
same thing, with no loss of what the model is actually being asked to do.
Stripped of filler words, a prompt can often shrink substantially in
token count while staying just as clear — a small, mechanical way to cut
cost, since every one of those tokens is charged on every call.
