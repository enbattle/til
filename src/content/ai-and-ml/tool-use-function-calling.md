---
title: Tool Use & Function Calling
summary: The mechanism that turns a model that can only produce text into something that can act, and the design habits that make it actually work well.
date: 2026-09-15
---

A language model can't directly browse the web, query a database, or
send an email. What it _can_ do is produce a structured request
describing that it wants to — naming a specific function and the
arguments to call it with — which application code then actually
executes on its behalf. That mechanism is called **tool use** (or
**function calling**), and it's the thing that turns
[a model that can only produce text into an agent that can act](/ai-and-ml/what-are-ai-agents).

## The actual protocol: describe, decide, execute, return

Concretely, the loop looks like this:

1. The application defines a set of available tools up front — each one
   a name, a description of what it does, and a schema describing its
   parameters (illustrated here as a generic shape, not any one
   provider's exact API):

   ```
   tool: get_weather
   description: "Get current weather for a location."
   parameters: { location: string, unit: "celsius" | "fahrenheit" }
   ```

2. Given a user's request, the model decides whether calling a tool
   would help, and if so, outputs a structured call — `get_weather({
location: "Tokyo", unit: "celsius" })` — instead of a prose answer.
3. Application code reads that structured output, actually executes the
   corresponding function, and captures its result.
4. The result is fed back to the model as part of the conversation, and
   the model continues — either calling another tool, or producing a
   final answer that incorporates what it learned.

Nothing about steps 3 and 4 is special to any one model provider: the
model only ever produces a structured _request_ to call something; it
never executes code itself. All of the actual capability — reading a
file, hitting an API, running a query — lives entirely in application
code the model doesn't control directly.

## The description is the interface — write it for the model, not for you

The model decides which tool to call, and with what arguments, based
entirely on the name and description supplied for each one — it has no
other information about what a tool actually does. A vague description
("does database stuff") gives the model nothing to reliably decide on; a
specific one ("search the product catalog by name, SKU, or category;
returns price, stock, and specifications") tells the model exactly when
this tool applies and what it'll get back. The description isn't
documentation for a future engineer reading the code — it's the actual
interface the model uses to decide what to do, and it's worth writing
with that in mind.

## One job per tool

A tool that tries to do several things at once — "search, then
summarize, then email the result" — gives the model no way to use just
one piece of that behavior, and makes it much harder to write a
description precise enough for the model to choose correctly. Separate
tools (`search_web`, `summarize_text`, `send_email`) let the model
combine them as needed for a given task, and let each individual
description stay simple and accurate.

## Treat any irreversible action as guilty until proven safe

A tool that can take a real, hard-to-undo action — deleting a record,
sending an email, spending money — deserves a safeguard beyond just
"the model decided to call it." A common pattern is requiring an
explicit confirmation step before the irreversible part actually
happens:

```
delete_record(record_id, confirmed=false)
  → "Deletion requires confirmed=true. Are you sure?"
delete_record(record_id, confirmed=true)
  → proceeds with deletion
```

More broadly, an agent should only ever be handed the specific tools a
given task actually requires, not a large standing set "just in case" —
the same [principle of least privilege](/ai-and-ml/prompt-injection)
that limits the damage a successful prompt injection can do also limits
the damage an agent can do by simply misjudging when to call something
it shouldn't have.

## When a tool call fails

A tool call can fail for ordinary reasons — a downstream API times out,
an input turns out to be invalid — and the failure should be reported
back to the model as a normal part of the conversation, not treated as a
special case that crashes the whole interaction. Handed a clear error
message, a model can often recover on its own: retrying with corrected
arguments, trying a different tool, or explaining to the user what went
wrong instead of silently failing.
