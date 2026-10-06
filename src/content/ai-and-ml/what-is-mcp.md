---
title: Model Context Protocol (MCP)
summary: MCP is an open protocol that lets a tool integration be built once as a server and used by any compliant AI application, which learns what the server offers by asking it.
date: 2026-09-15
---

Suppose your online shop has a chat assistant that answers questions like "Where is my order 4417?" It works through a `lookup_order` function, wired up as described in [tool use and function calling](/ai-and-ml/tool-use-function-calling). Now your support team wants the same order lookup inside their code editor's AI helper, and finance wants it in a reporting assistant. Each of those is a different application with its own way of describing tools and calling them. Do you rewrite the integration three times?

**MCP (Model Context Protocol)** says no. It is an open standard for how an AI application talks to an outside tool or data source. You build the order integration once, as an MCP server, and any application that speaks the protocol can use it.

## Who are the parties?

MCP names three roles.

- A **host** is the AI application the user works in: the chat assistant, the editor helper, the reporting tool.
- A **client** is code inside the host that talks to exactly one server and speaks the protocol for it. A host that connects to three servers runs three clients.
- A **server** is a separate program that exposes one tool or data source, such as your order system, and doesn't know or care which host is on the other end.

So the host never learns how your order database works. It only knows how to ask a server what it offers.

## What can a server offer?

Three kinds of things, and the difference between them is mostly about who decides when each is used.

- **Tools** are functions the model can ask to call. This is the same mechanism as tool use, except the host learns the tool list from the server instead of having it written into the host's code. Tools are meant to be chosen by the model.
- **Resources** are data to read, such as a file or a ticket, each with an identifier. They are usually picked by the application or the user and placed into the model's context, not requested by the model mid-answer.
- **Prompts** are reusable, parameterized templates, like a "summarize this order for a status update" prompt that the user can trigger by name.

For the shop, `lookup_order` is a tool, the full text of order 4417 is a resource, and the status-update template is a prompt. Many servers offer only tools, and that is fine; a server offers whichever of the three it has.

## How does a host find out what a server offers?

It asks. The client and server first establish which protocol version and features they both support; older revisions do this in an opening exchange, newer ones by stating it on every request. Then the client sends a list request for each kind of thing the server says it offers, and the server answers. The exchange looks roughly like this (the shape, not the exact wire format):

```
Client -> Server: what tools do you offer?

Server -> Client:
  name: "lookup_order"
  description: "Find an order by its number. Returns status,
                items, total and shipping details."
  parameters: { order_id: string }
```

That answer is the same name, description and schema from the tool-use page, and the host passes it to the model the same way. Nothing about order lookup is hard-coded in the host. Add a second server for shipping labels, and the same question discovers its tools too. The host still needs to be told the server exists, usually by a line in its configuration, but it doesn't need new code to use it.

Underneath, the messages are JSON-RPC, a small standard format for sending a named request and getting a matching reply. How they travel is the **transport**, and there are two common kinds. With the first, the host starts the server as a local child process and the two exchange messages over standard input and output, which suits a server running on the user's own machine. With the second, the server runs elsewhere and the client reaches it over HTTP, which suits a shared service. Because the message format is identical either way, the same server logic can be offered both ways.

## What goes wrong, and what should a server do about it?

A server is a standalone program that other people's applications may plug into, so a few habits matter more than they would inside a single app.

Everything a server says, including its tool descriptions and returned data, becomes text in the model's context. A server you don't control can therefore try to steer the model, which is the problem described in [prompt injection](/ai-and-ml/prompt-injection). Connect servers from sources you trust, and keep a human confirmation on actions that are hard to undo.

As the author, expose the minimum. Your order server might later be plugged into a host you never imagined, so offer read-only tools unless a mutating one is needed, and add it deliberately. Make any tool that changes something [idempotent](/systems-and-infrastructure/idempotency), because a client may retry a call that appeared to time out, and the server can't tell whether it was a duplicate unless you design for that. Finally, return structured data, such as the status and the ship date as separate fields, rather than a finished paragraph. Writing the customer-facing answer is the model's job, and it can do that better with the facts than with your wording.

**Rule of thumb.** Build an integration as an MCP server when more than one application, or more than one team, will want it; a tool used by a single app can stay a plain function. Either way, treat every server as a boundary: request the least access it needs, and connect only servers you trust.
