---
title: Fine-Tuning vs. Prompting and RAG
summary: Fine-tuning changes how a model behaves, not what it knows today, so try prompting and retrieval first and fine-tune only for a behavior they can't hold.
date: 2026-09-14
---

Say you run support for a software product that gets 5,000 tickets a day, and you want a language model to draft the replies. The general-purpose model you start with isn't good enough yet. What do you change? There are several levers, and they differ a lot in cost, so the order you pull them in matters.

This page starts with the cheapest lever, shows why training the model on your help center is the wrong next move, covers the retrieval that does that job, and ends on when fine-tuning earns its cost and what it costs.

## Start with the prompt

The **prompt** is the text you send the model with each ticket: your instructions, plus the ticket itself. Changing it takes minutes and needs no model change, so every problem starts here. Tell the model the tone you want, the format you need, and paste in a few example replies you like.

When that isn't enough, you have two heavier levers: giving the model the right text for each ticket, and training it. They solve different problems, and mixing them up is how projects go wrong.

## Should the assistant learn your help center?

Your first instinct is probably to train the model on your help center, so that it "knows the product". Training a model further on your own examples is called **fine-tuning**, and it shifts the model's **weights**, the numbers inside it that decide what it writes.

It reliably changes how a model responds: its tone, its format, the way it handles a certain kind of request. It is unreliable at making the model memorize specific facts and recall them accurately later. It also does nothing for facts that change. Your refund policy changes next quarter, and a model trained on the old policy keeps stating it until you train again.

The lever for facts is **retrieval**, often called retrieval-augmented generation or [RAG](/ai-and-ml/what-is-rag). When a ticket arrives, the system looks up the relevant help-center pages and puts them in the prompt, so the model answers from text it can see. Updating the policy means editing a page.

So keep two questions apart. "What should it know for this ticket, right now?" is a retrieval question. "How should it respond?" is the one fine-tuning might answer. Mixing them up sinks these projects.

Suppose retrieval is in place and the answers are factually right. Two things still go wrong.

## When the behavior is the problem

First, your ticketing system needs every reply as a strict structured record, and the model drifts from that format about one time in fifty. At 5,000 tickets a day, that is a lot of bad records:

```text
5,000 tickets a day ÷ 50 = 100 malformed replies a day
```

Second, the replies don't sound like your team.

Fine-tuning looks tempting for both, but cheaper fixes come first. Many providers can enforce a schema (the exact fields and format a reply must have) while the model generates, so a malformed reply can't come out at all, with no training. For the voice, clearer instructions and a few worked examples in the prompt fix more than people expect; [prompt engineering](/ai-and-ml/prompt-engineering) covers how.

Then measure. An [eval](/ai-and-ml/what-are-evals) is a set of test tickets with a way to score the replies. Without one you can't tell whether a prompt change moved the voice at all, or by how much. With one, you know whether the prompt has really hit its limit.

If it has, fine-tuning starts to earn its cost.

## When fine-tuning earns its cost

You fine-tune on tickets paired with the reply you'd want. The usual cases for the support assistant:

- **A style that must hold across huge volume.** A house voice that can't drift, which no schema can enforce.
- **Instructions too long to resend.** A detailed rulebook repeated on every request. You pay per [token](/ai-and-ml/tokenization) (a word or word piece) sent, so training it in shortens every prompt. Providers that discount a repeated prompt (prompt caching), and higher prices for tuned models, can erase the saving.
- **Specialized terminology and reasoning.** If the product is medical software, the model must apply clinical wording consistently. This is about how it writes, not recalling facts, which stays retrieval's job.
- **A smaller, cheaper model.** A small model fine-tuned on one narrow task can sometimes match a much larger one on that task, which lowers cost and latency (how long each reply takes) per ticket.

Fine-tuning also comes in cheaper forms than retraining every weight. [LoRA and QLoRA](/ai-and-ml/lora-and-qlora) train a small add-on instead, which lowers the hardware and storage bill considerably. A heavier option, continued pre-training on a large corpus of your field's text, takes months and is rarely the right start.

Each lever is slower to try and slower to undo than the one before it: prompting takes minutes, retrieval days, fine-tuning weeks. That is the argument for working from the cheapest, not a claim that fine-tuning never wins. Even when it does, the training run is only part of the bill.

## What it costs beyond the training run

For the support assistant, the training run itself is likely the smallest line item. The slow part is the examples: hundreds or thousands of tickets paired with the reply you'd want, checked by someone who knows your policies. Bad examples teach bad behavior faithfully.

The first attempt also rarely lands, so plan for several rounds of train, test, and fix the data. And a tuned model you host yourself costs money every hour it runs, idle hours included, while a per-call API charges only when used.

One misconception is worth clearing up. Fine-tuning does not keep your tickets private. Privacy depends on where the model and your data run, not on whether its weights were changed. A self-hosted model with retrieval can meet the same requirement without any training.

**Rule of thumb.** Put changing knowledge in retrieval, put instructions in the prompt, and fine-tune only when an eval shows the prompt can't hold a behavior, or the prompt holds it only at a cost you can't afford. Then the weeks of work buy something measured.
