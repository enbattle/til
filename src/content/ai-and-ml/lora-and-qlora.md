---
title: LoRA and QLoRA
summary: How fine-tuning a huge model on modest hardware works — training a small low-rank update instead of touching every original weight.
date: 2026-09-15
---

**Full fine-tuning** updates every parameter in a model. For a
70-billion-parameter model, that's 70 billion numbers to store,
compute gradients for, and update on every training step — memory far
beyond what most teams have access to. **LoRA (Low-Rank Adaptation)**
makes fine-tuning practical on far more modest hardware by updating only
a small fraction of that many parameters, while leaving the vast
majority of the original model completely untouched.

## Why updating every parameter is so expensive

Just storing a model's weights takes real memory — a 7-billion-parameter
model already needs tens of gigabytes at typical precision. Training
makes this substantially worse, not just larger: on top of the weights
themselves, training needs to store gradients and optimizer state (many
optimizers keep multiple running statistics per parameter), which can
multiply the base memory requirement several times over. Fine-tuning
_every_ parameter of a large model this way needs hardware far beyond a
single consumer GPU, and scales up sharply as the model gets bigger.

## The low-rank insight: most of a fine-tuning update lives in a small subspace

LoRA's starting observation is that the _update_ a model's weights
undergo during fine-tuning tends to be low-rank — most of the useful
information in that update fits inside a much smaller space than the
full weight matrix it's updating. Instead of directly updating the full
weight matrix `W`, LoRA freezes `W` entirely and adds a separate update
built from two much smaller matrices, `A` and `B`, whose product
approximates the change that full fine-tuning would have made:

```
Original: W (a d × k matrix) — frozen, never updated
LoRA adds: W + ΔW, where ΔW = B × A
  A is (r × k), B is (d × r), and r is chosen far smaller than d and k

Concretely, for r = 8 and d = k = 4096:
  training the full matrix:  4096 × 4096 = 16,777,216 parameters
  training A and B instead:  8 × 4096 × 2 = 65,536 parameters
  — about 256× fewer parameters to train
```

Because `W` itself never changes, the vast majority of the model's
memory footprint during training is just the frozen weights sitting
there — no gradients or optimizer state need to be computed for them at
all, only for the comparatively tiny `A` and `B`.

## QLoRA: fine-tuning on top of a compressed base model

**QLoRA** combines LoRA with quantization: the frozen base model is
loaded in a compressed, low-precision format — dramatically cutting the
memory needed just to hold it in place — while the small LoRA update
matrices are still trained at higher precision on top of that
compressed, frozen base. This combination is what makes fine-tuning a
very large model tractable on a single GPU that would never have been
able to hold the full-precision model plus training state at all.

The specific low-precision format QLoRA introduced is built around a
useful fact about trained model weights: they tend to cluster in a
roughly normal (bell-curve) distribution rather than spreading evenly.
A quantization scheme designed around that shape — allocating more of
its limited precision to the values that actually occur most often,
rather than spacing every representable value evenly — preserves
noticeably more information per bit than a naive, uniform quantization
scheme would at the same bit width.

## What you're left with afterward

Because only `A` and `B` were ever trained, the result of a LoRA or
QLoRA fine-tune is a small **adapter** — often a tiny fraction of the
base model's own size — that can either be merged back into the base
model's weights to produce one ordinary model, or kept separate and
loaded on top of the shared base model on demand. The latter is
particularly useful when many different fine-tuned variants share the
same base: each adapter is small enough to store and swap in cheaply,
rather than needing a full separate copy of the entire model for every
variant. This general idea — freezing the bulk of a model and training
a small, targeted update on top — has continued to spawn variants
refining exactly which part of the weights get decomposed and how.
