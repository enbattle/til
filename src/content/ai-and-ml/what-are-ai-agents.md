---
title: What are AI Agents?
summary: What actually separates an agent from a chatbot — a loop that keeps going on its own — and the kinds of tasks where that loop pays off.
date: 2026-09-14
---

A chatbot answers one message and stops, waiting for the next thing a
human types. An **AI agent** is built to keep going on its own: given a
goal, it reasons about what to do, takes an action — usually by calling a
tool, like running a search or querying a database — looks at what
happened, and decides the next step, repeating that cycle until the goal
is met or it gives up. The defining difference isn't intelligence, it's
that an agent's loop doesn't require a human to close it after every
single step.

## The loop underneath the label

Strip away the terminology and an agent is a repeating cycle with four
parts:

1. **Observe** — take in the current state: the original goal, and the
   result of whatever the last action was.
2. **Reason** — figure out what the observation means and what it implies
   about what to do next.
3. **Plan** — decide on the next concrete action (or, for a multi-step
   goal, sketch out a sequence of them).
4. **Act** — actually take that action, usually by calling a tool: run a
   search, read a file, query a database, call an API.

The cycle then repeats with the new observation from that action, until
a **stop condition** trips — the goal is judged complete, a maximum
number of steps is reached, or a human is brought in to review before
continuing. Say the goal is "find out how a competitor prices their
product." An agent might reason that it needs to search the web, act by
issuing that search, observe the results, reason that one link looks like
the pricing page, act by fetching it, observe the page content, and only
then decide it has enough to produce a final answer — several
observe-reason-plan-act cycles chained together, not one.

## What makes this more than a bigger prompt

A few capabilities have to be present for that loop to actually work, and
each maps to something concrete:

- **Tool use** — the ability to call something outside the model itself:
  a search function, a calculator, a database query, an API. Without
  this, there's nothing for "act" to actually do.
- **Planning** — breaking a goal too big to do in one step into an
  ordered sequence of smaller ones, and adjusting that sequence as new
  information comes in.
- **Memory** — carrying forward what's already been discovered so far in
  the loop (and sometimes across separate sessions), so the fifth step
  doesn't have to re-derive what the first step already learned.

A system with a model but none of these is a chatbot with better wording,
not an agent — the loop, not any single capability in isolation, is what
does the actual work.

## Where the loop pays off, and where it's overkill

The loop is genuinely useful when a task requires multiple steps whose
outcome can't be known in advance — where step three depends on what step
two actually returned, so it can't just be scripted as a fixed sequence
ahead of time. It's a poor fit for the opposite case: a single, direct
question with one clear answer, a workflow that never actually varies
(better served by ordinary code that just does the same steps every
time), or anything latency-critical, since a multi-step loop is
inherently slower than a single model call. It's also the wrong shape for
high-stakes, hard-to-reverse actions taken with no human review: an agent
that's free to act on its own for several steps in a row is also free to
compound a bad decision across those same steps before anyone notices —
a risk a single chatbot answer, reviewed by a human before anyone acts on
it, doesn't carry.
