---
title: LoRA and QLoRA
summary: LoRA fine-tunes a model by freezing its weights and training two small matrices per layer whose product is the update, and QLoRA does the same on a 4-bit compressed copy of the base model.
date: 2026-09-15
---

Say you have a 7-billion-parameter language model and you want it to answer support tickets in your company's voice. You have one GPU. **Fine-tuning** means continuing to train a finished model on your own examples so it changes its behavior. The standard way, **full fine-tuning**, updates every parameter. Can your GPU do that? Let's count.

This page counts the memory full fine-tuning needs, builds LoRA's small update from a toy grid up to a real matrix, then shrinks the frozen model with QLoRA and ends on what you keep afterward.

## Why updating every weight is expensive

Each parameter is a number, and at 16-bit precision (a common choice) each takes 2 bytes. So the weights alone are 7 billion × 2 bytes = 14 GB.

Training needs more than the weights. Count the bytes kept for each parameter, one item at a time:

```text
weight (16-bit)                            2 bytes
gradient, the nudge direction (16-bit)     2 bytes
Adam's two step-size averages (4 each)     8 bytes
32-bit master copy, the precise weight     4 bytes
                                         --------
                                         16 bytes per parameter

7 billion × 16 bytes = 112 billion bytes = 112 GB
```

Adam is the common optimizer, the rule that picks step sizes. Adam's averages plus the master copy are the **optimizer state**.

The total is 112 GB before counting memory for activations, the intermediate results of each pass. Your one GPU does not hold that.

The bill is almost entirely gradients and optimizer state: 14 of the 16 bytes. If most weights never needed either, the cost would collapse. That is LoRA's idea.

## LoRA: train a small update, leave the weights alone

**LoRA (Low-Rank Adaptation)** freezes every original weight, so none of them gets a gradient or optimizer state. Next to each frozen weight matrix `W` it adds a small trainable update.

Before scaling up, try a toy case. Say the update to one weight matrix were a 4 × 4 grid, 16 numbers. Instead of choosing all 16, build it from two thin strips. `B` is a 4 × 2 strip (two columns), and `A` is a 2 × 4 strip (two rows). Each row of the grid is a blend of `A`'s two rows, using the amounts in that row of `B`:

```text
A row 1 = [1 1 0 0]      A row 2 = [0 0 1 1]

B row    blend                    grid row
(1, 1)   1×row1 + 1×row2    ->    [1 1 1 1]
(2, 0)   2×row1 + 0×row2    ->    [2 2 0 0]
(3, 1)   3×row1 + 1×row2    ->    [3 3 1 1]
(4, 0)   4×row1 + 0×row2    ->    [4 4 0 0]
```

You stored 8 numbers (4 × 2 in `B`, 2 × 4 in `A`) and got a full 4 × 4 grid. But not any grid: every row is a blend of the same two strips. That limit is the **rank**, here 2. Rank is the number of strips; a grid of 16 free choices would need rank 4.

Now scale up to one matrix in your model, `W`, of size 4096 × 4096. Full fine-tuning would train all 4096 × 4096 = 16,777,216 numbers of it. LoRA trains two thin matrices of rank `r`, which you choose:

```
A is r × 4096     B is 4096 × r     ΔW = B × A   (4096 × 4096)
New output = W·x + B·(A·x)

With r = 8:
  A: 8 × 4096 = 32,768
  B: 4096 × 8 = 32,768
  trained: 65,536 parameters, against 16,777,216
  16,777,216 / 65,536 = 256, so 256 times fewer
```

The update `ΔW` is a full-size grid whose 4096 rows are all blends of the same 8 strips. Why would that be enough? LoRA bets that the change a model needs to pick up a narrow task such as your support-ticket tone is simple compared with everything the model already knows, simple enough to be built from a few repeating patterns. The bet weakens as the task drifts from what the base model already does; a higher `r` buys capacity for a bigger change at proportionally more parameters.

`B` starts at all zeros, so before any training `B × A` is zero and the model behaves exactly like the original. Training then moves only `A` and `B`. (The 256× figure counts one matrix. You attach adapters to a chosen set of matrices, and the rest train nothing, so across the whole model the trained share is well under 1% of the 7 billion.) But the frozen 14 GB base still has to fit.

## QLoRA: also shrink the frozen part

Your GPU can't hold 14 GB alongside training. **Quantization** stores each number with fewer bits, trading some precision for space. At 4 bits, a weight takes half a byte, so 7 billion weights take about 3.5 GB, plus a little extra for the scaling values quantization needs.

**QLoRA** loads the frozen base model in 4-bit form and trains LoRA matrices on top of it, kept at higher precision. During the forward and backward pass, each 4-bit block of weights is converted back to 16-bit on the fly, used, and discarded. The 4-bit copy is never trained, but the adapter learns to work with the model as it exists after rounding.

QLoRA's 4-bit format spends more of its 16 possible values near zero, where trained weights cluster, so it loses less than evenly spaced values. For your 7B model, the frozen base drops from 14 GB to about 4 GB, so the job fits on a much smaller GPU, at the cost of slower steps from all that converting and possibly some quality, so check it on your own task.

## What you end up with

After training you have not a new 7-billion-parameter model but the adapter, which is `A` and `B` for each chosen matrix. At r = 8, an adapter is about 1/256 of every 4096 × 4096 matrix it touches. You have two choices:

- **Merge it.** Compute `W + B × A` once and store the sum. You get an ordinary model with no extra running cost. After QLoRA, merge into a 16-bit copy of the base, since re-squeezing the sum into 4 bits loses precision.
- **Keep it separate.** Load the shared base once and swap adapters per request. If you need one voice for support tickets, another for legal summaries and a third for code review, that is three small files, not three 14 GB copies.

Whether fine-tuning beats giving the model your documents at question time with [retrieval-augmented generation](/ai-and-ml/what-is-rag) is covered in [when to fine-tune](/ai-and-ml/when-to-finetune).

**Rule of thumb.** Reach for LoRA when you want a model to change its style or behavior on a narrow task and full fine-tuning would not fit your hardware, add QLoRA when even the frozen base is too big to hold, and keep the adapter separate if one base has to serve several variants.
