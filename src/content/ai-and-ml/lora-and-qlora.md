---
title: LoRA and QLoRA
summary: LoRA fine-tunes a model by freezing its weights and training two small matrices per layer whose product is the update, and QLoRA does the same on a 4-bit compressed copy of the base model.
date: 2026-09-15
---

Say you have a 7-billion-parameter language model and you want it to answer support tickets in your company's voice. You have one GPU. **Fine-tuning** means continuing to train a finished model on your own examples so it changes its behavior. Done the standard way, **full fine-tuning**, it updates every parameter. Can your GPU do that? Let's count.

## Why updating every weight is expensive

Each parameter is a number, and at 16-bit precision (a common choice) each takes 2 bytes. So the weights alone are 7 billion × 2 bytes = 14 GB.

Training needs more than the weights. For each parameter it also keeps a **gradient** (the direction to nudge that weight, 2 bytes) and **optimizer state**. The common Adam optimizer keeps two running statistics per weight to pick step sizes, 4 bytes each, and mixed-precision training, which computes in 16-bit but updates a 32-bit master copy of the weights, adds 4 more: 12 bytes. That is 2 + 2 + 12 = 16 bytes per parameter, or about 112 GB for the 7-billion-parameter model, before counting the memory for activations. Your one GPU does not hold that. The exact figure varies with the setup, but the multiple of the weights is large in any common one.

The bill is almost entirely gradients and optimizer state. If most weights never needed either, the cost would collapse. That is LoRA's idea.

## LoRA: train a small update, leave the weights alone

**LoRA (Low-Rank Adaptation)** freezes every original weight, so none of them gets a gradient or optimizer state. Next to each frozen weight matrix `W` it adds a small trainable update, and only that update is trained.

Take one matrix in your model, `W`, of size 4096 × 4096. Full fine-tuning would train all 4096 × 4096 = 16,777,216 numbers of it. LoRA instead trains two thin matrices:

```
A is r × 4096     B is 4096 × r     ΔW = B × A   (4096 × 4096)
New output = W·x + B·(A·x)

With r = 8:
  A: 8 × 4096 = 32,768
  B: 4096 × 8 = 32,768
  trained: 65,536 parameters, against 16,777,216
  16,777,216 / 65,536 = 256, so 256 times fewer
```

The number `r` is the **rank**, which you choose. Multiplying a 4096 × 8 matrix by an 8 × 4096 matrix gives a full-size 4096 × 4096 result, but one built from only 8 independent directions. Why would that be enough? LoRA bets that the change a model needs to pick up a narrow task such as your support-ticket tone is simple compared with everything the model already knows. The bet usually pays off when the task is narrow, and it gets weaker as the task drifts further from what the base model already does. A higher `r` buys more capacity for a bigger change and costs proportionally more parameters.

`B` starts at all zeros, so before any training `B × A` is zero and the model behaves exactly like the original. Training then moves only `A` and `B`. (The 256× figure counts one matrix. In practice you attach adapters to a chosen set of matrices, sometimes only a few and increasingly every large one. Matrices without an adapter train nothing, so across the whole model the trained share is smaller still, well under 1% of the 7 billion. Choosing which matrices get one is a setting you tune.)

## QLoRA: also shrink the frozen part

With LoRA, the 7-billion-parameter base still sits in memory at 14 GB, and your GPU may be small enough that even that hurts. **Quantization** stores each number with fewer bits, trading some precision for space. At 4 bits, a weight takes half a byte, so 7 billion weights take about 3.5 GB, plus a little extra for the scaling values quantization needs.

**QLoRA** loads the frozen base model in 4-bit form and trains LoRA matrices on top of it, kept at higher precision. During the forward and backward pass, each 4-bit block of weights is converted back to 16-bit on the fly, used, and discarded. The 4-bit copy is never trained, so its rounding error isn't corrected by updates, but the adapter learns to work with the model as it exists after rounding.

QLoRA also used a 4-bit format built around the shape of trained weights. They cluster in a bell curve, with most values near zero. A format that spends more of its 16 possible values near zero loses less than one that spaces them evenly. For your 7B model, the frozen base drops from 14 GB to about 4 GB, so the job fits on a much smaller GPU, at the cost of slower steps from all that converting. Some quality loss from quantizing is possible, so check it on your own task.

## What you end up with

After training you have not a new 7-billion-parameter model but the adapter, which is `A` and `B` for each chosen matrix. At r = 8 over every 4096 × 4096 matrix it touches, an adapter is about 1/256 the size of those matrices. You have two choices:

- **Merge it.** Compute `W + B × A` once and store the sum. You get an ordinary model with no extra cost when you run it. After QLoRA, you merge into a 16-bit copy of the base, since squeezing the sum back into 4 bits loses precision.
- **Keep it separate.** Load the shared base once and swap adapters per request. If you need one voice for support tickets, another for legal summaries and a third for code review, that is three small files, not three 14 GB copies.

Whether fine-tuning is the right tool in the first place, versus giving the model your documents at question time with [retrieval-augmented generation](/ai-and-ml/what-is-rag), is a separate question covered in [when to fine-tune](/ai-and-ml/when-to-finetune).

**Rule of thumb.** Reach for LoRA when you want a model to change its style or behavior on a narrow task and full fine-tuning would not fit your hardware, add QLoRA when even the frozen base is too big to hold, and keep the adapter separate if one base has to serve several variants.
