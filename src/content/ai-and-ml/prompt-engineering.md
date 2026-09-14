---
title: 'Prompt Engineering: What Good Prompts Look Like in Practice'
summary: The underlying skill of writing good prompts, and how it changes once a prompt is built into an application instead of typed into a chat box.
date: 2026-09-13
---

"Prompt engineering" sounds grander than it is: it's the practice of
writing the input to a language model carefully enough that the output is
reliably useful, instead of leaving that to chance. It applies whether
you're typing into a chat window or wiring a prompt into a piece of
software — but the bar for "good enough" is very different between those
two situations, which is worth understanding before assuming one set of
habits covers both.

## The underlying skill

Whether you're chatting casually or writing a prompt for production use,
the same handful of techniques do most of the work:

- **State the task clearly and specifically.** "Improve this" produces a
  vague result; "rewrite this paragraph to be shorter, keep the same
  facts, and use plain language" gives the model something concrete to
  aim at.
- **Give context the model doesn't otherwise have.** Who's the audience?
  What's already been tried? What does "good" look like here? A model has
  no memory of your project beyond what's in the prompt (see
  [tokens and context windows](/ai-and-ml/tokens-and-context-windows)) —
  anything you haven't stated, it has to guess.
- **Specify the output format.** If you need a bulleted list, a table, or
  a specific structure, say so explicitly rather than hoping the model
  infers it.
- **Show examples for anything subtle.** A style, a tone, or an edge case
  that's hard to describe in words is often much easier to demonstrate
  with one or two examples (sometimes called "few-shot" examples) than to
  explain abstractly.
- **Iterate.** Treat the first attempt as a draft. If the output isn't
  right, that's information about what the prompt failed to specify —
  refine and try again rather than assuming the model simply "got it
  wrong."

## Where it diverges: chat versus building on the API

Using Claude or ChatGPT in a browser and calling the same models through
an API inside an application both count as "prompting" — but production,
API-based use adds a layer of engineering discipline that casual chat
doesn't need, because the situations are fundamentally different.

**In a chat interface**, there's a human in the loop for every response.
If the model misunderstands, you immediately see that and can rephrase.
The conversation is disposable — a bad response costs you a follow-up
message, nothing more. The **system prompt** (the hidden instructions
that shape the assistant's behavior) is usually set by the provider or
the app you're using, not something you write yourself.

**Building a prompt into an application** removes the human safety net:
the prompt has to work correctly, unattended, across every input real
users will ever send it — not just the handful you tested by hand. That
difference in stakes is what drives every practical distinction below:

- **You write the system prompt yourself**, and it has to hold up across
  an unknown range of future inputs, not just the one conversation in
  front of you.
- **Output usually needs to be structured, not conversational.** A chat
  response can be a friendly paragraph; a response your code has to parse
  needs to reliably come back as JSON matching a specific shape, or as a
  **tool call** (the model choosing to invoke one of a set of functions
  you've defined, with specific arguments) rather than free-form prose.
- **Cost and latency are real constraints**, not an afterthought — every
  token in the prompt and the response has a dollar cost and a time cost,
  multiplied across every request the application makes, so prompts are
  trimmed to what's actually needed rather than padded "just in case."
- **Prompts get versioned and tested like code.** A production prompt is
  changed deliberately, with a way to check the change didn't quietly
  break behavior for cases it used to handle well — often a small set of
  example inputs with expected properties, checked automatically
  (sometimes called an "eval") rather than eyeballed once and shipped.
- **Untrusted content needs to be handled carefully.** If a prompt
  includes text from a user, a document, or a website, that content can
  contain instructions of its own (a "prompt injection" attempt) —
  something a human chatting casually would just read past, but that a
  fully automated pipeline needs to be deliberately resistant to.

## The takeaway

The core skill — being specific, giving context, showing what "good"
looks like — transfers directly between typing into a chat box and
writing a prompt for an application. What changes is everything _around_
that skill: in production, a prompt is a piece of the system that has to
be reliable, measurable, and safe to change, not just a message you send
once and read the reply to.
