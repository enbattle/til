---
title: Tool Use and Function Calling
summary: A model only writes text, so tool use has it write a structured request that your code runs, and the quality of that loop depends on tool descriptions, scope and error handling.
date: 2026-09-15
---

Suppose you're building a support assistant for an online shop. A customer writes, "Where is my order 4417, and can I get a refund?" A language model on its own can't answer: it has no access to your order database, and it can't move money. All it can do is produce text.

**Tool use**, also called **function calling**, closes that gap. A **tool** is a function your application offers to the model. The model never runs it. It writes a structured request ("call this function with these arguments"), your code runs the function, and your code hands the result back. This is the mechanism behind [an agent that acts](/ai-and-ml/what-are-ai-agents), and [MCP](/ai-and-ml/what-is-mcp) is a standard way of packaging tools so they can be shared across applications.

## How does the loop work?

There are four steps, and they repeat until the model has what it needs.

1. **Describe.** You send the model a list of tools alongside the conversation. Each tool has a name, a plain-language description and a schema (a formal description of its parameters and their types). The exact format varies by provider; the shape is roughly like this:

   ```
   tool: lookup_order
   description: "Find an order by its number. Returns status,
                 items, total and shipping details."
   parameters: { order_id: string }
   ```

2. **Decide.** The model reads the customer's message and either answers in prose or emits one or more calls, such as `lookup_order({ order_id: "4417" })`.
3. **Execute.** Your code sees the call, runs the real function and captures what it returns.
4. **Return.** You append the result to the conversation and ask the model to continue. It might call another tool, or write the final answer using what it learned.

Because the model only ever _requests_ a call, everything it can affect is whatever your code agrees to run. That is the lever for most of the design decisions below.

## What makes the model pick the right tool?

The description. The model sees only the name, the description and the schema, so before its first call, those three are its whole understanding of what the tool does. A description like "does order stuff" gives it nothing to choose on. "Find an order by its number; returns status, items, total and shipping details" says when the tool applies and what comes back.

Write it for the model, not for a future maintainer. Say what the tool is for, what each parameter means, and where it should not be used ("not for searching by customer name"). Constraining a parameter helps too: an `enum` of allowed values (a schema type that lists the only legal choices) is harder to get wrong than a free-text string.

## How many things should one tool do?

One. If the customer's question needs a lookup, a refund and a confirmation email, offer `lookup_order`, `refund_order` and `send_email` rather than a single `handle_order_issue`. A tool that does several jobs is hard to describe precisely, and the model can't use one part without triggering the rest. Separate tools also let it combine them in orders you didn't plan for, such as looking up an order, finding it already shipped, and replying without refunding anything.

Keep the set small, too. Every tool's description takes space in the [context window](/ai-and-ml/context-window), and with dozens of similar-sounding tools the model has more chances to pick the wrong one.

## What if the model asks for something dangerous?

`lookup_order` only reads, so a wrong call costs little. `refund_order` moves money, and the model might call it for the wrong order, or because text in the conversation told it to (see [prompt injection](/ai-and-ml/prompt-injection)). So the check can't live in the model's judgment alone; it has to live in your code, where the model can't talk its way past it.

Three habits cover most of the risk:

- **Least privilege.** Offer only the tools this task needs, and scope each to its caller. A refund tool for a customer-facing assistant should be able to refund that customer's orders, taken from the logged-in session rather than from an argument the model fills in, up to a set amount, not any order.
- **Confirmation for hard-to-undo actions.** Have the tool return "refund of $59.00 pending, confirm to proceed" and only act once the customer approves it through your app, for example a button the model can't press, with the summary built by your code from the real arguments. A confirmation the model can give itself stops mistakes, not [prompt injection](/ai-and-ml/prompt-injection).
- **Safe repeats.** The model may call a tool twice, for instance after a timeout. Make `refund_order` [idempotent](/systems-and-infrastructure/idempotency), so a repeated call for the same order doesn't pay out twice.

## What happens when a call fails?

Calls fail for ordinary reasons: a timeout, an order number that doesn't exist, an amount larger than the order. Don't crash the conversation. Return the failure as the tool's result, in words the model can use: "No order found with id 4417. Order ids start with the letters SH." Handed that, the model can ask the customer to recheck the number, retry with a corrected argument, or explain the problem honestly.

A vague error ("failed") leaves it guessing. Also put a cap on retries: a model that keeps repeating the same failing call is a loop that burns time and money until you stop it.

**Rule of thumb.** Treat the model as an untrusted caller of your functions: write each tool's description for it, give each tool one job, offer only what the task needs, put the safety checks in your code rather than in the prompt, and return errors it can act on.
