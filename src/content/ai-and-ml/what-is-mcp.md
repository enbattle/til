---
title: Model Context Protocol (MCP)
summary: MCP is an open protocol that lets a tool integration be built once as a server and used by any compliant AI application, which learns what the server offers by asking it.
date: 2026-09-15
---

Suppose your online shop has a chat assistant that answers questions like "Where is my order 4417?" It works through a `lookup_order` function, wired up as described in [tool use and function calling](/ai-and-ml/tool-use-function-calling). Now your support team wants the same order lookup inside their code editor's AI helper, and finance wants it in a reporting assistant. Each of those is a different application with its own way of describing tools and calling them. Do you rewrite the integration three times?

**MCP (Model Context Protocol)** says no. It is an open standard for how an AI application talks to an outside tool or data source. You build the order integration once, and any application that speaks the protocol can use it.

This page covers the parties involved, what a server can offer, how a host discovers it, how messages travel, and what to watch for.

## Who are the parties?

MCP names three roles.

- A **host** is the AI application the user works in: the chat assistant, the editor helper, the reporting tool.
- A **client** is code inside the host that talks to exactly one server. A host that connects to three servers runs three clients.
- A **server** is a separate program that exposes one tool or data source, such as your order system. It doesn't know or care which host is on the other end.

So the host never learns how your order database works. It only knows how to ask a server what it offers. What can a server say in reply?

## What can a server offer?

Three kinds of things, and the difference between them is mostly about who decides when each is used.

- **Tools** are functions the model can ask to call. This is the same mechanism as tool use, except the host learns the tool list from the server instead of having it written into the host's code. Tools are meant to be chosen by the model.
- **Resources** are data to read, such as a file or a ticket, each with an identifier. They are usually picked by the application or the user and placed into the model's context, not requested by the model mid-answer.
- **Prompts** are reusable, parameterized templates that the user can trigger by name.

For the shop, `lookup_order` is a tool, the full text of order 4417 is a resource, and a "summarize this order for a status update" template is a prompt. Many servers offer only tools. But how does a host learn which of these a server has?

## How does a host find out what a server offers?

It asks. The client sends a list request for each kind of thing the server offers, and the server answers. The exchange looks roughly like this (the shape, not the exact wire format):

```
Client -> Server: what tools do you offer?

Server -> Client:
  name: "lookup_order"
  description: "Find an order by its number. Returns status,
                items, total and shipping details."
  parameters: { order_id: string }
```

That answer is the same name, description and schema from the tool-use page, and the host passes it to the model the same way. Nothing about order lookup is hard-coded in the host. The host still needs to be told the server exists, usually by a line in its configuration, but it needs no new code to use it.

So the host asks, and the server describes itself. How do those questions and answers actually get from one program to the other?

## How do the messages travel?

Each message is a small piece of structured text: a named request, or the matching reply. The route it takes is called the **transport**, and there are two common kinds.

- **Local.** The host starts your server as a program on the user's own computer and the two pass messages straight to each other, with no network involved. This suits a server that works with that person's files or tools. This is called the **stdio** transport (standard input and output).
- **Remote.** The server runs on another machine, and the client sends its messages over the web, the way a browser asks a website for a page. This suits a service many people share, such as your order system. This is called **Streamable HTTP**.

The messages are the same either way, so one server can be offered both ways. Now that a server can be reached by programs you didn't write, what should it be careful about?

## What goes wrong, and what should a server do about it?

Everything a server says, including its tool descriptions and returned data, becomes text in the model's context. A server you don't control can therefore try to steer the model, which is the problem described in [prompt injection](/ai-and-ml/prompt-injection). Connect servers from sources you trust, and keep a human confirmation on actions that are hard to undo.

As the author, expose the minimum. Hosts you never imagined may plug in, so offer read-only tools unless a mutating one is needed, and add it deliberately. Make any tool that changes something [idempotent](/systems-and-infrastructure/idempotency), because a client may retry a call that appeared to time out, and the server can't tell whether it was a duplicate unless you design for that. Finally, return structured data, such as the status and the ship date as separate fields, rather than a finished paragraph. Writing the customer-facing answer is the model's job.

One more complication is that the protocol keeps changing. Client and server must agree on which revision and features they both support: older revisions settle this in an opening exchange, newer ones by stating the version on every request. A library handles this, but it is why a server can work with one host and fail with another.

**Rule of thumb.** Build an integration as an MCP server when more than one application, or more than one team, will want it; a tool used by a single app can stay a plain function. Either way, treat every server as a boundary: request the least access it needs, and connect only servers you trust.
