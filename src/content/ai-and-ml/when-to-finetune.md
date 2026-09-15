---
title: When to Fine-Tune vs. Everything Else
summary: Why fine-tuning is usually the wrong first move for teaching a model new knowledge, and the decision framework for when it actually wins.
date: 2026-09-14
---

**Fine-tuning** — training a model further on your own examples so its
weights shift toward a new behavior — is one of several ways to adapt a
general-purpose model to a specific use case, not the default one. Picking
it when a cheaper option would have worked burns real time and money for
little gain, so it's worth being deliberate about when it's actually the
right tool.

## Four ways to adapt a model, and what each one changes

| Strategy                                | What it actually changes                                      | Roughly how long it takes |
| --------------------------------------- | ------------------------------------------------------------- | ------------------------- |
| **Prompting**                           | Nothing — the model is unchanged                              | Minutes                   |
| **[Retrieval](/ai-and-ml/what-is-rag)** | What the model has access to, not its weights                 | Hours to days             |
| **Fine-tuning**                         | The model's weights, for a specific new behavior              | Weeks                     |
| **Continued pre-training**              | The model's weights, trained further on a large domain corpus | Months                    |

The strategies aren't mutually exclusive, and the further down this list
you go, the more expensive and slower each iteration gets — which is
exactly why it's worth ruling out the cheaper options first, not because
fine-tuning never wins.

## The mistake almost everyone makes first: fine-tuning for knowledge

The most common misstep is reaching for fine-tuning to "teach the model
our company's information" — but fine-tuning shifts _behavior_, not
_stored facts_. A model fine-tuned on a pile of internal documentation
doesn't reliably retain and recall specific facts from that documentation
much better than the base model did; it's simply not what the training
process is good at. If the goal is "the model should know this specific,
changeable information," [retrieval](/ai-and-ml/what-is-rag) is almost
always the right tool — it hands the model the actual relevant text at
answer time, rather than hoping the information got absorbed into the
weights somewhere.

A useful way to keep the two straight: fine-tuning answers "how should
the model respond, and in what style or format?" Retrieval answers "what
should the model know, right now, for this specific question?" Confusing
which question you're actually trying to solve is most of what makes
this mistake happen.

## Where fine-tuning actually wins

Fine-tuning has a real advantage in a specific set of situations:

- **A format or style the model doesn't reliably produce from prompting
  alone** — a strict, consistent output schema, a specialized notation,
  a house style that needs to hold across thousands of outputs without
  drifting.
- **Domain-heavy vocabulary and reasoning** — a medical, legal, or
  scientific domain where the model needs to consistently use precise
  terminology and reason correctly within that domain's specific
  constraints, not just recall domain facts (which is still retrieval's
  job).
- **Cutting inference cost or latency** — a smaller model, fine-tuned
  tightly for one narrow task, can sometimes match a much larger
  general-purpose model's quality on just that task, without paying for
  either the larger model's size or a retrieval step on top of it.
- **Data that can't leave your environment** — if a task involves
  sensitive data that can't be sent to an external retrieval system or
  third-party API, a model fine-tuned and hosted entirely within your own
  environment avoids that data ever leaving it.
- **A complex instruction that has to be followed reliably, every time**
  — if a long, detailed system prompt needs to be followed exactly across
  a huge volume of calls, training that behavior directly into the model
  can end up more reliable than repeating the same lengthy instruction on
  every single call and hoping it's followed consistently.

## What it actually costs, beyond the training run itself

The training run is rarely the biggest cost. Collecting enough
high-quality labeled examples of the behavior you want is often the
slowest and most expensive part, especially if it requires domain
expertise to label correctly. First attempts rarely get the behavior
exactly right, so budget for several iteration cycles, not one. And a
fine-tuned model you host yourself keeps costing money for every hour
it's running, whether or not it's actively handling a request — unlike
a per-call API cost that only accrues when it's actually used. Before
committing, it's worth confirming that prompting and retrieval have
genuinely been ruled out, and that the quality improvement fine-tuning
would buy is worth a multi-week cycle to get there.
