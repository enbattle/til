---
title: MLOps
summary: The operating practices that cover what ordinary software operations miss in a model-driven system, shown on a support-ticket summarizer that quietly gets worse.
date: 2026-09-15
---

Say you run a feature that reads each incoming support ticket and writes a two-line summary for the support agent who picks it up. It launched well. Six months later agents complain the summaries miss the point, yet no deploy happened, no error fired and every dashboard is green. What was there to catch?

**MLOps** (machine learning operations) is the answer to that question: the practices for running a model-driven system in production, built as an extension of ordinary software operations. To see why the extension is needed, look at what makes your summarizer different from a normal backend service.

## Why the summarizer fails differently

A normal function returns the same result for the same input, and when it breaks, it usually says so with an exception or a bad status code. A model-driven feature breaks that contract in four ways.

- **Outputs vary.** Feed the same ticket in twice and you can get two different summaries, so "did it return the right thing" can't be a single stored expected value.
- **Quality drifts without a deploy.** Customers start writing about a new product, or use new slang. The tickets move away from the examples you tuned the prompt on, and the summaries get worse with no code change to blame. This is called **drift**: the live data moving away from what the system was built and tested against. The model can change under you too, when a provider updates or retires the version behind the name you call.
- **Failures are silent.** A bad summary reads as fluently as a good one. Nothing throws, and a normal error monitor sees a healthy service.
- **Judging needs a person who knows the domain.** Whether a summary kept the detail an agent needs, such as the refund amount or the order number, is a question for someone who handles tickets, not someone reading a stack trace.

Run this feature with only ordinary practice and it degrades until the agents complain. That is exactly the situation in the opening paragraph.

## What gets added to each habit

MLOps keeps every habit of software operations and widens what it covers. Here is the summarizer through each one.

| Ordinary practice    | Extended for the summarizer                                                                |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Unit tests           | Plus behavioral tests: run real example tickets and judge the summaries, not just the code |
| Version the code     | Also version the model, the prompt, any fine-tuning data and the test tickets              |
| Deploy the code      | Also deploy the model and any retrieval index (see [RAG](/ai-and-ml/what-is-rag)) it uses  |
| Monitor for errors   | Also monitor summary quality, drift and cost per ticket                                    |
| Fix the bug, rebuild | Change the prompt or retune the model, re-check, then redeploy                             |

Notice the last row. With ordinary software you find the faulty line and fix it. Here the cause may be a model update, a prompt edit or a shift in the tickets, and there is no line to point at. That is why versioning comes first: when quality shifts, you need a record of what changed so you can compare. Version the prompt alongside the code, because a one-word prompt edit can change behavior as much as a code change does ([prompt engineering](/ai-and-ml/prompt-engineering) covers why).

## Checking before users see it

If versioning tells you what changed, how do you know whether the change was good? You run a fixed set of real example tickets through the new version and score the summaries, and you block the release if the score drops. That set, and the scoring, are an [eval suite](/ai-and-ml/what-are-evals). Wired into your release pipeline, it turns "evaluate before deploying" from a step someone must remember into a gate that stops a bad version automatically.

The gate only protects you from what the example tickets cover. Drift is the case where tomorrow's tickets stop resembling them, so you also sample live summaries, have someone who knows the work grade a few each week, and watch cost and latency as well. The general techniques for watching a running system are in [observability](/systems-and-infrastructure/observability). Here the new part is that the thing you measure is output quality, which no log line states directly.

When the grades fall, you decide between rewriting the prompt and retuning the model itself; [when to fine-tune](/ai-and-ml/when-to-finetune) walks through that choice. Either way you re-run the eval suite before the new version ships.

## How much of this do you need?

You don't need all of it on day one. A sensible order is:

1. Version control for code, prompts and example tickets, plus automated deployment.
2. An eval gate and quality monitoring, once real agents depend on the summaries.
3. Automatic rollback, and retraining if the model is fine-tuned, only when the volume and a team to maintain that automation justify it.

Building step 3 for a feature with fifty tickets a week is infrastructure with no problem to solve yet.

**Rule of thumb.** Version everything that changes behavior, including the model, the prompt and any fine-tuning data, along with the examples you test against, and let nothing reach users without passing an eval gate. Pin a dated model version where you can, and re-run the evals on a schedule, since a provider's change never passes through your gate. Add monitoring and automation as the cost of a silent failure grows.
