---
title: What are Evals?
summary: Why an AI system needs the equivalent of a test suite aimed at output quality, and the loop that turns eval results into actual improvements.
date: 2026-09-14
---

Ordinary code has unit tests: run it, check the output against a known
expected result, and a red test tells you something broke. A language
model's output isn't that predictable — ask the same question twice and
you can get two differently worded, both-reasonable answers — so "does
the output exactly match" isn't a usable test. An **eval** is the
equivalent tool built for that reality: a systematic, repeatable way to
score a model's outputs against a dataset of test cases, so you can tell
whether a change made things better or worse without eyeballing outputs
by hand every time.

```
a set of test inputs → run them through the system → score each output → an overall metric
```

## Why "just look at the outputs" doesn't scale

Without evals, every question about a change to a prompt, a model, or a
pipeline has to be answered by spot-checking outputs by hand — which
doesn't scale past a handful of examples, doesn't catch a regression in a
case nobody happened to check, and gives you no way to defend a decision
to anyone else with actual numbers. With an eval dataset in place, the
same question — "did this change help or hurt?" — gets an answer you can
compute automatically, rerun after every change, and point to later if
something in production goes wrong.

## What actually needs measuring depends on what the system does

There's no single metric that works for every kind of AI system, because
different systems can fail in different ways:

- **A retrieval-augmented system** ([RAG](/ai-and-ml/what-is-rag)) can
  fail by retrieving the wrong documents in the first place, or by
  retrieving the right documents and still generating an answer that
  isn't actually supported by them — sometimes called **faithfulness**:
  is the answer grounded in what was retrieved, or invented on top of it?
  A faithfulness eval might take an answer plus its cited source
  documents and check, sentence by sentence, whether each claim is
  actually backed by the source text — catching a case where the model
  retrieved the right document but still stated something it doesn't
  actually say.
- **An [agent](/ai-and-ml/what-are-ai-agents)** can fail by choosing the
  wrong tool, reasoning its way to a bad plan, or technically finishing
  its steps without actually accomplishing the underlying goal — so an
  agent eval typically checks tool choice, the coherence of its
  intermediate reasoning, and whether the end state actually matches what
  was asked for, not just whether the loop terminated.
- **A general-purpose response** can be evaluated for plain correctness,
  whether it's actually useful to the person asking, and whether it stays
  inside whatever behavioral guidelines the system is supposed to follow.

## Closing the loop, not just running the numbers once

An eval that gets run once and filed away isn't doing its job. The value
is in the loop: build or change the system, run the eval dataset against
it, look closely at where it failed and why, use that to decide what to
fix, make the change, and run the eval again to confirm it actually
helped rather than just feeling like it should have. The faster that
loop can run, the faster the underlying system actually improves — an
eval that takes a day to run is far less useful than one that takes a
minute, even if the two measure exactly the same thing, because the slow
one gets run far less often in practice.
