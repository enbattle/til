---
title: What is MLOps?
summary: What operating an AI system in production adds on top of ordinary software operations, and why the same "just fix the bug" instinct doesn't work here.
date: 2026-09-15
---

Running an AI system in production takes on a layer of operational
practice beyond ordinary software operations, because AI systems fail
in ways ordinary software mostly doesn't. **MLOps** (machine learning
operations) is the set of practices built specifically to catch and
manage that difference — the same underlying discipline as regular
software operations, extended to cover what's genuinely new about
running a model rather than a normal deterministic program.

## Why AI systems fail differently than ordinary software

A handful of properties make a model-driven system behave unlike a
typical backend service:

- **Outputs are non-deterministic.** The same input can produce a
  different output on two separate runs, so "did this call return the
  right thing" isn't always a fixed, repeatable question the way a
  normal function's return value is.
- **Quality drifts over time even when nothing was deployed.** As the
  real-world data a model encounters shifts away from what it was
  trained or tuned on, its effective quality can decline gradually with
  no corresponding code change to point to as the cause.
- **Failures are often silent.** A wrong answer frequently _looks_ just
  as plausible as a correct one — there's no exception thrown, no
  non-zero exit code, nothing an ordinary error monitor would catch.
- **Judging quality itself needs domain expertise**, not just an error
  log. Deciding whether a generated summary is actually good, or a
  classification is actually correct, often needs a person who
  understands the subject matter, not just someone reading a stack
  trace.

A system built and operated with only ordinary software practices will
tend to degrade quietly under these conditions until users start
noticing and complaining — by which point real damage may already have
been done.

## The same lifecycle, with more to version and more to watch

MLOps isn't a replacement for standard software practice — it's the
same lifecycle extended to cover more surface area:

| Traditional software practice | Its MLOps extension                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit tests                    | Unit tests, plus behavioral tests (checking response quality on real example inputs, not just code paths) |
| Version the code              | Version the code, the model, and the data it was trained or tuned on                                      |
| Deploy the code               | Deploy the code, the model, and any retrieval index it depends on                                         |
| Monitor for errors            | Monitor for errors, plus output quality, drift, and cost                                                  |
| Fix the bug, redeploy         | Retrain or re-tune, re-evaluate, then redeploy                                                            |

Every row on the right still includes everything on the left — MLOps
adds new things to track, it doesn't remove the ones software operations
already handled.

## A maturity model, not a single correct setup

Not every team needs the most sophisticated version of this discipline
on day one. A useful way to think about it as a set of levels to grow
into deliberately, rather than a bar to clear all at once: starting with
just version control and basic deployment automation, then adding
automated quality gates and monitoring once real users are depending on
the system, and only reaching for continuous retraining and automatic
rollback once a team has both the scale and the dedicated staffing to
maintain that level of automation responsibly. Building the most
advanced version of this before it's actually needed is its own kind of
mistake — premature infrastructure that costs real engineering time
without yet having a problem it's solving.

## The core discipline underneath all of it

Two principles matter more than the rest. Version everything that
affects behavior — code, model, data, and prompts alike, not just code —
so that when quality shifts, there's an actual record of what changed to
check against. And evaluate before deploying: a quality gate that blocks
a new version from reaching users until it's been checked against real
examples. Concretely, this is what
[an eval suite](/ai-and-ml/what-are-evals) is _for_ — the mechanism that
makes "evaluate before deploying" something a pipeline can enforce
automatically, rather than a step someone has to remember. Continuous
monitoring and documentation matter too, but they're downstream of
getting these two right first.
