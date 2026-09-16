---
title: What is MCP?
summary: The open protocol that lets a tool integration built once work with any compliant AI application, instead of every application rebuilding the same connector.
date: 2026-09-15
---

Before **MCP (Model Context Protocol)**, every AI application that
wanted to connect a model to an external tool or data source — a
database, a ticketing system, a file store — had to build its own
bespoke integration for it: its own way of describing the tool, its own
authentication handling, its own glue code. Building the same kind of
connector again for a second AI application meant redoing most of that
work from scratch, even though the underlying tool hadn't changed at
all. MCP is an open standard that separates those two concerns: build
the connection to a tool once, and any application that speaks the
protocol can use it, without rebuilding the integration itself.

## The architecture: hosts, clients, and servers

MCP defines three roles:

- **Host** — the AI application itself (an assistant, an IDE, any
  program that wants a model to be able to use outside tools).
- **Client** — a piece of code living inside the host that speaks the
  MCP protocol on the host's behalf, handling the actual back-and-forth
  with a server.
- **Server** — a separate, standalone piece of software that exposes one
  specific tool or data source (a database, a filesystem, an internal
  company system) through the protocol, without knowing or caring which
  host is talking to it.

A single host can connect to several servers at once — one exposing
filesystem access, another exposing a database, another exposing search
— each running independently, each responsible for exactly one
integration.

## What a server actually exposes: tools, resources, and prompts

An MCP server can offer three kinds of things through the protocol:

- **Tools** — functions the model can actually invoke, the same
  underlying idea as [tool use and function calling](/ai-and-ml/tool-use-function-calling),
  just discovered dynamically over the protocol instead of being
  hard-coded into the host ahead of time.
- **Resources** — data the model can read, like the contents of a file
  or the rows returned by a query, made available without the model
  needing to know how to fetch them itself.
- **Prompts** — reusable, parameterized prompt templates a server can
  offer, so a well-designed prompt for a specific task can be shared and
  reused rather than re-written inside every host that needs it.

A client discovers what a given server offers by asking it directly,
rather than the host needing to have that server's capabilities
hard-coded in advance. Concretely, that discovery exchange looks
something like this (illustrating the shape of the protocol, not any
one implementation's exact wire format):

```
Client → Server: what do you offer?

Server → Client:
  tools:
    - name: "search_tickets"
      description: "Search support tickets by keyword or status."
      parameters: { query: string, status?: "open" | "closed" }
  resources:
    - name: "ticket://12345"
      description: "The full contents of ticket #12345."
  prompts:
    - name: "summarize_ticket"
      description: "Summarize a ticket for a status update."
      parameters: { ticket_id: string }
```

The host doesn't need to know in advance what a connected server offers —
no hardcoded tool list — it asked, and got back everything it needs to
let the model use what's there. Add a second server exposing a
completely different tool (still requiring its own config or connection
entry on the host), and the same discovery step picks up its
capabilities automatically. That's what makes it possible to add or swap
out a server without changing how the host talks to it.

## Why building it once pays off

A server built to expose, say, a company's internal ticketing system
works with _any_ host that speaks MCP, not just the one it was
originally built for.
That's the same underlying logic behind most successful protocols — a
device built to a shared driver standard works with any compliant
operating system, not one rebuilt per device; a website built to
standard HTTP works in any compliant browser, not one per site. MCP
applies that same idea to the specific problem of connecting a model to
the outside world: the integration work happens once, on the server
side, and every compliant host benefits from it without paying that cost
again.

## Building one well

Most of what makes an individual tool good — a clear, single
responsibility, and a description written for the model rather than for
a human reading the code later — is exactly the guidance in
[Tool Use & Function Calling](/ai-and-ml/tool-use-function-calling); MCP
doesn't change any of that, it just changes how a client discovers and
calls the tool. A couple of habits matter specifically because an MCP
server is a standalone, reusable piece of software rather than logic
living inside one application:

- **Expose the minimum by default.** Since a server might end up
  plugged into hosts and use cases its author never anticipated, favor
  read-only access unless a mutating capability is specifically needed
  and deliberately added.
- **Assume any tool call might be retried.** A client can retry a call
  that appeared to fail without knowing whether the server actually
  processed it — the same reasoning behind
  [idempotency](/systems-and-infrastructure/idempotency) applied to tool
  calls specifically, not just network requests.
- **Return structured, machine-readable data, not pre-formatted prose.**
  Turning raw data into a readable answer for the end user is the
  model's job; a server that instead returns its own formatted
  paragraph is making a presentation decision on the model's behalf,
  usually a worse one than the model would have made itself.
