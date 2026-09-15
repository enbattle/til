---
title: The State of LLMs, September 2026: Why "Next-Token Predictor" Undersells What's Built
summary: What's actually built into a frontier language model beyond next-token prediction, and why that extra machinery is what makes modern models take so much time, money, and compute to build.
date: 2026-09-14
---

You'll often hear that large language models are "just next-token
predictors" — a system that looks at some text and guesses the single
most likely next word, over and over. That description is technically
accurate. It's also seriously incomplete, in a way that hides almost
everything that makes a frontier model expensive, slow, and hard to
build. This topic is explicitly dated because the specific techniques
and systems named below will keep evolving — but the general shape of
"there's a lot more than next-token prediction going on" is likely to
stay true for a while yet.

## What "next-token prediction" actually is

Start with what's real: the foundational training step for a language
model — called **pretraining** — really does work by feeding the model
enormous amounts of text and training it to predict, one piece at a
time, what comes next. Get shown "the capital of France is," predict
"Paris." Do this across a large fraction of the internet's text,
adjusting the model's internal parameters a tiny bit every time it's
wrong, and you get a system that's very good at this one narrow task.
That's what pretraining optimizes for. The description isn't false, but
it only covers the starting point, not what gets built on top of it.

## Why "just" is the misleading part

Here's the reasoning error in stopping there: the objective a system was
trained on doesn't fully describe what that training produces. Human
brains, at the level of physical mechanism, are "just" networks of
neurons firing electrochemical signals — a true statement that tells you
almost nothing useful about what a brain can actually do, from recognizing
a face to writing a poem.

The same gap shows up in language models. To get good at predicting the
next word across a huge, varied body of text, a model has to build
internal structure that goes well beyond word-frequency tables: patterns
representing grammar and factual relationships, at minimum. Recent
interpretability research (work looking directly at what's happening
inside a trained model, not just its outputs) goes further, finding
evidence of structured, belief-like internal representations — most
rigorously demonstrated so far in small, controlled setups built
specifically to test for this, with earlier-stage and still-debated
evidence that something similar shows up in full-scale models processing
real text. None of this was explicitly programmed in. Where it does show
up, it emerged because representing that structure turned out to help
with the prediction task — the same way a brain optimized for survival
"discovers" abstract reasoning because abstract reasoning helps you
survive.

## What's actually built on top of pretraining

A pretrained model — one that's only ever done next-token prediction — is
not what you're talking to when you use a modern AI assistant. Getting
from "predicts plausible next words" to "follows instructions, reasons
through a hard problem, and behaves safely" takes several more expensive
stages, layered on afterward:

- **Supervised fine-tuning (SFT).** The model is trained further on a
  curated set of example instructions paired with high-quality responses,
  teaching it the specific behavior of _following instructions_ rather
  than just continuing text in whatever direction is statistically
  likely.
- **Reasoning-focused reinforcement learning.** Starting around 2024–2025,
  labs began training models specifically to reason through hard math,
  coding, and logic problems using **reinforcement learning with
  verifiable rewards** — the model attempts a problem with a checkable
  right answer (a math proof, a piece of code that either passes tests or
  doesn't), and is rewarded when its reasoning leads to a correct result.
  Repeated at scale, this is what produced the current wave of
  "reasoning models" (OpenAI's o-series and DeepSeek's R1 among the
  earliest widely known examples) that visibly work through a problem
  step by step before answering, instead of producing an answer in one
  shot.
- **Preference optimization.** A further training pass — commonly
  reinforcement learning from human feedback (RLHF) or a related
  technique — where the model's outputs are ranked by human or AI
  preference (which response is more helpful, more honest, appropriately
  cautious) and the model is adjusted toward the preferred style. This is
  what shapes tone, refusals, and general "helpfulness" behavior, as
  distinct from raw capability.

Each of these stages requires its own large-scale infrastructure: curated
datasets, human feedback pipelines, automated verifiers for reasoning
tasks, and enormous amounts of additional compute — on top of, not
instead of, the original pretraining run.

## Thinking before answering: test-time compute

One of the more significant recent shifts is that some models now spend
extra computation **at the moment you ask a question**, not just during
training. Instead of generating an answer in a single pass, a reasoning
model can generate an extended internal chain of reasoning first —
working through the problem step by step, sometimes checking its own
intermediate logic — before producing a final answer. Some approaches
take this further and generate multiple candidate solution paths in
parallel, then select the best one. This is called **test-time** or
**inference-time compute scaling**, and it's a genuinely different
paradigm from classic next-token prediction: the model isn't just
guessing one word forward, it's allocating variable amounts of "thinking"
depending on how hard the problem seems, at the cost of taking longer and
consuming more compute per answer.

## Why all of this takes so much time, money, and compute

This is the direct answer to why frontier models are so expensive to
build: it's not one big expensive step, it's several. The pretraining run
alone requires tens of thousands of specialized processors running for
weeks or months, at a cost that (based on figures the major labs have
disclosed or that have been credibly estimated) runs into the hundreds of
millions of dollars for a single frontier-scale model — and that's before
adding the cost of the SFT, reasoning-RL, and preference-optimization
stages on top, each of which needs its own data curation, human feedback
collection, and compute budget. Reasoning models add a further ongoing
cost: because they spend more compute per answer at inference time, every
individual response is more expensive to serve, not just the one-time
training run. None of this is disclosed in exact detail by the labs
building these systems, but the broad shape — several expensive,
compute-hungry stages stacked on top of each other, not one — is well
documented.

## What's still unsettled

It's worth being honest that not everything here is settled science. How
much of what a language model does reflects something like genuine
understanding, versus extremely sophisticated pattern-matching that
merely behaves as if it understands, is an active, unresolved research
question — interpretability researchers are still working out how to
even ask that question rigorously, let alone answer it. A narrower,
more defensible claim holds up regardless of how that question gets
settled: describing the training objective correctly (predict the next
token) doesn't describe the system that objective, plus several more
expensive stages of training on top of it, actually produces. That gap —
not "these systems secretly think like humans" — is where the "just a
next-token predictor" framing goes wrong.
