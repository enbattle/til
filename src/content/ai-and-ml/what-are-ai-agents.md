---
title: AI Agents
summary: An agent is a language model run in a loop that picks its own next step from what the last step returned, which pays off for open-ended multi-step tasks and costs more everywhere else.
date: 2026-09-14
---

Suppose you ask an assistant, "Why did checkout errors spike last night?" A chatbot can only answer from what it already knows, so it offers general reasons that checkouts fail. You wanted the reason in your own system, which means somebody has to open the error logs, find when the spike began, and check what changed around then. An **AI agent** is a language model set up to do that digging itself.

## What is the loop?

An agent is a language model run inside a loop. You give it a goal and a set of tools. A **tool** is a function the model can ask the surrounding program to run, such as a log search or a file read ([Tool Use and Function Calling](/ai-and-ml/tool-use-function-calling) covers how that request works). Each pass through the loop has the same shape:

1. The model looks at the goal and everything that has happened so far.
2. It decides on one next action, usually a tool call.
3. The program runs the tool and appends the result to what the model sees.
4. Back to step 1, until the model answers instead of calling a tool, or a cap on steps or time stops it.

For the checkout question, the first pass might search the logs for errors in the last day. The result shows the errors began just after midnight, all from the payment step. The second pass reads the deploy history around midnight and finds a payment-service release at 11:58 pm. The third reads that release's diff and spots a changed timeout. Now the model has an answer. Nobody scripted those three steps in advance, because each one depended on what the previous one returned.

That dependence is the whole difference from ordinary code. A script runs steps its author wrote before the task existed. An agent chooses the next step at run time, based on what it just learned.

## What does the model need to carry that out?

Three things have to work, and the loop supplies none of them for free.

**Tools** give it something to act with. Without them the loop has nothing to run, and the model can only talk.

**Planning** is deciding what to do next, and revising when a result surprises it. If the log search had shown errors from three different services, a good agent drops its payment hypothesis and widens the search. Some designs ask the model to write out a plan first; others let it decide one step at a time. Either way it stays the model's judgment, so it can be wrong.

**Memory** is how earlier results stay visible. Usually that just means the transcript so far, which sits in the model's [context window](/ai-and-ml/context-window), the limited amount of text it can read at once. A long investigation can fill that window, so agents often keep notes outside it or summarize older steps. Anything dropped is something the agent can no longer reason about.

## When does the loop earn its cost?

Every pass is another model call, so an agent is slower and costs more than a single call, and its cost is hard to predict because you don't know how many passes it will take. That price is worth paying when the path to the answer really is unknown in advance: debugging, research across many sources, a task where each result changes what to ask next.

It is a poor fit when the steps are always the same. If every refund request needs the same four lookups in the same order, write those four lookups as code and call the model only where language understanding is needed. That version is faster, cheaper and easier to test. It is also a poor fit where a wrong action can't be undone and nobody reviews it first, since an agent that acts for many steps can build each step on an earlier mistake before anyone looks.

## What goes wrong, and what do you do about it?

Our checkout agent shows the main failures. It might chase the wrong lead for ten passes, call the same tool over and over, or announce an answer its evidence doesn't support. Four habits contain most of this:

- **Cap the loop.** Set a maximum number of passes and a time limit, so a confused agent stops instead of running up a bill.
- **Limit what it can touch.** Give the log-reading agent read-only tools. If it never needs to restart a service, don't let it.
- **Keep a human at the irreversible steps.** Let it investigate freely, but require a person's approval before it changes anything. [Tool Use and Function Calling](/ai-and-ml/tool-use-function-calling#what-if-the-model-asks-for-something-dangerous) covers how to build that approval so the model can't grant it to itself.
- **Distrust what tools return.** Log lines and web pages are text that anyone may have written, and the model reads them as part of its input, so planted instructions in a result can steer the next step. Telling the model to be careful is unreliable, so distrust has to mean limiting what it can reach; [Prompt Injection](/ai-and-ml/prompt-injection) covers that attack.

You also can't judge an agent from one good run, because its steps differ from run to run. You measure it across many tasks, which is the job of [evals](/ai-and-ml/what-are-evals).

**Rule of thumb.** Reach for an agent when the next step depends on what the last one returns and a wrong turn is cheap to undo. If the steps are fixed, write code, and give an agent only the tools and approvals its task needs.
