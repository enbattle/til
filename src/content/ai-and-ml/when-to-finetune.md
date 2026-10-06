---
title: Fine-Tuning vs. Prompting and RAG
summary: Fine-tuning changes how a model behaves, not what it knows today, so try prompting and retrieval first and fine-tune only for a behavior they can't hold.
date: 2026-09-14
---

Say you run support for a software product and want an assistant that answers customer tickets. You have a general-purpose language model, and it isn't good enough yet. What do you change? There are four levers, and they differ a lot in cost, so the order you pull them in matters.

**Fine-tuning** means training the model further on your own examples, so its weights (the numbers that make up the model) shift toward a new behavior. It is the heaviest of the four.

| Lever                                   | What it changes                                              | Typical turnaround |
| --------------------------------------- | ------------------------------------------------------------ | ------------------ |
| **Prompting**                           | The instructions you send; no model change                   | Minutes            |
| **[Retrieval](/ai-and-ml/what-is-rag)** | The text the model sees for each question                    | Days               |
| **Fine-tuning**                         | The model's weights, for a new behavior                      | Weeks              |
| **Continued pre-training**              | The weights, trained on a large corpus of your domain's text | Months             |

Each lever down the table is slower to try and slower to undo. That is the argument for working from the top, not a claim that the bottom ones never win.

## Should the assistant learn your help center?

Your first instinct is probably to train the model on your help center, so that it "knows the product". Fine-tuning is a poor tool for that. Training reliably shifts how a model responds: its tone, its format, the way it handles a certain kind of request. It is unreliable at making the model memorize specific facts and recall them accurately later, and it does nothing for facts that change. Your refund policy changes next quarter, and a model trained on the old policy keeps saying the old thing until you train again.

Retrieval, often called retrieval-augmented generation (RAG), fits that job. When a ticket arrives, the system looks up the relevant help-center pages and puts them in the prompt, and the model answers from text it can see. Updating the policy means editing a page.

So keep two questions apart. "How should the assistant respond?" is a fine-tuning question. "What should it know for this ticket, right now?" is a retrieval question. A common way fine-tuning projects fail is answering the second question with the first.

## When the assistant's behavior is the problem

Suppose retrieval works and the answers are factually right, but two things still go wrong. Your ticketing system needs every reply as a strict structured record, and the model drifts from the schema about one time in fifty. And the replies don't sound like your team.

Before you fine-tune, try the cheap levers properly. The schema drift has one: many providers can enforce a schema while the model generates, so the reply can't come out malformed, with no training at all. For the voice, use clearer instructions and a few worked examples inside the prompt; [prompt engineering](/ai-and-ml/prompt-engineering) fixes more of this than people expect. Then measure. Without an [eval](/ai-and-ml/what-are-evals), a set of test tickets with a way to score the replies, you can't tell whether a prompt fix moved the voice at all, or by how much.

If prompting still falls short on a behavior, fine-tuning starts to earn its cost. The usual cases:

- **A style that must hold across a huge volume**, such as a house voice that can't drift across thousands of replies, where no schema can enforce it.
- **Instructions too long to resend**, where a long, detailed rulebook is repeated on every request. Training the behavior in can shorten every prompt, though cached prompts and higher prices for tuned models can erase the saving.
- **Specialized terminology and reasoning**, such as clinical or legal wording, where the model must apply a field's conventions consistently. This is about how it reasons, not about recalling facts, which stays retrieval's job.
- **A smaller, cheaper model.** A small model fine-tuned on one narrow task can sometimes match a much larger model on that task, which lowers cost and latency per call.

Fine-tuning also comes in cheaper forms than retraining every weight. [LoRA and QLoRA](/ai-and-ml/lora-and-qlora) train a small add-on instead, which lowers the hardware and storage bill considerably.

## What it costs beyond the training run

For the support assistant, the training run itself is likely the smallest line item. The slow part is the examples: you need hundreds or thousands of tickets paired with the reply you'd want, and someone who knows your policies has to check them. Bad examples teach bad behavior faithfully.

The first attempt also rarely lands, so plan for several rounds of train, test, and fix the data. And if you host the tuned model yourself, it costs money every hour it runs, including idle hours, while a per-call API charges only when used.

One more misconception is worth clearing up. Fine-tuning does not keep your tickets private. Privacy depends on where the model and your data run, not on whether its weights were changed. A self-hosted model with retrieval can satisfy the same requirement without any training.

**Rule of thumb.** Put changing knowledge in retrieval, put instructions in the prompt, and fine-tune only when an eval shows a behavior the prompt can't hold. Then the weeks of work buy something you measured.
