---
title: Monolith vs. Microservices
summary: One deployable program or many small ones, which trades simpler operations for team independence and per-feature scaling, and puts a network between every part.
date: 2026-09-14
---

Say you are building an online shop. It has a product catalog, a cart, a checkout that takes payment, and an email sender that confirms orders. You have to decide how many programs that is.

A **monolith** is one program: one codebase, one build, one deploy. The catalog, cart, checkout and emails are all modules inside it, and they talk by calling each other's functions. **Microservices** split the same shop into several programs, called services, each owning a narrow piece (catalog, checkout, email) and each deployable by itself. They talk to each other over the network.

## What does the monolith give you?

Start with checkout. In the monolith it saves the order, subtracts the stock and records the payment inside one database transaction, a group of changes that either all land or none do. If the payment step fails, the order and the stock change roll back together, and you wrote no compensating code to arrange that.

Debugging is also simpler. A request runs in one process, so a stack trace shows the whole path, and a debugger can step through it. And because modules call each other as functions, the failure modes of a network (a call that is slow, lost or repeated) don't exist between them.

The bill arrives later. The shop scales as a single unit: if only catalog search is overloaded, you still run extra copies of everything. And as the team grows, people's changes collide more often, and one person's broken change can hold up everyone's deploy.

## What do microservices buy you, and what do they cost?

They answer exactly those two complaints. The checkout team deploys on its own schedule without waiting for anyone. And if only catalog search is under load, you add copies of the catalog service and nothing else.

The cost is that everything the monolith gave you for free now has to be built. Take the same checkout, now spread over an order service, a stock service and a payment service, each with its own database.

- **No shared transaction.** The order can be saved while the payment fails, and nothing rolls it back for you. Keeping the three consistent takes a pattern built for it, such as the [saga pattern](/systems-and-infrastructure/saga-pattern), and publishing an event reliably alongside a database write typically uses the [outbox pattern](/systems-and-infrastructure/outbox-pattern).
- **Calls can fail.** The order service calling the payment service may hit a timeout, an error or a slow reply. You need [retries with backoff](/systems-and-infrastructure/exponential-backoff), a [circuit breaker](/systems-and-infrastructure/circuit-breaker) to stop hammering a service that is down, and [rate limiting](/systems-and-infrastructure/rate-limiting).
- **Messages can repeat.** When services communicate through a [message queue](/systems-and-infrastructure/message-queues), a message may be delivered more than once, so each handler should be [idempotent](/systems-and-infrastructure/idempotency): running it twice must not charge the customer twice.
- **A bug spans services.** "Checkout is slow" now means finding which of several services is slow, which takes [observability](/systems-and-infrastructure/observability): logs, metrics and traces that follow one request across all of them.
- **Splitting data splits your guarantees.** Once the stock count and the order live in different databases, and the network between them can fail, the tradeoff in the [CAP theorem](/systems-and-infrastructure/cap-theorem) applies between them, where inside one database you rarely had to think about it.

## Isn't there something in between?

Yes: a **modular monolith**. It is still one deployable program, but inside it the catalog, cart, checkout and email modules have strict boundaries. Each module exposes a small set of functions, and the others may not reach into its tables or internals. You keep one deploy and one transaction, and if a module later needs to become a service, the seam is already there.

## When do you split?

The advice has shifted. In the 2010s microservices were often treated as the grown-up default; since then, practitioners who lived with the operational cost have mostly recommended starting with a monolith, and some teams that split early have merged services back together. The costs above are easy to underestimate until you are the one on call for them.

The reasons to split are specific. A team is large enough that deploys block each other. One part of the system needs to scale very differently from the rest. Or one part has to be isolated, because its failures or load shouldn't reach the rest. "It's what big companies do" is not on that list. A team of five splitting the shop into eight services pays for all of the costs above and collects almost none of the benefit.

**Rule of thumb.** Start with one deployable program, kept modular, and split out a service only when a specific problem (blocked deploys, uneven scaling, a part that must be isolated) costs you more than the network between the pieces will.

## Where you'll meet this

A payments and checkout flow is where the split hurts first, because that is where one transaction used to cover several steps. A notification or email pipeline is a common first piece to carve out: it usually already runs off a queue, its load comes in bursts, and a slow or failing email provider shouldn't be able to stall the rest of the application. A URL shortener gains little from splitting early, since its read and write paths are small enough for one service to cover both.
