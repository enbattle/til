---
title: REST vs. gRPC vs. GraphQL
summary: Three common ways to design an API, differing in how the client names what it wants, how data travels, and what each choice does to caching and speed.
date: 2026-10-07
---

Say you run a shop, and the page for a mug needs three things: the product, its price and its top three reviews. The browser has to get them from your server somehow. An **API** (application programming interface) is the agreed contract for that conversation: what the client may ask for, what shape the answer takes, and what errors look like. REST, gRPC and GraphQL are three popular contracts. They differ in how the client says what it wants. You'll build this page with REST first, then see what GraphQL and gRPC change, and finish with which fits where.

## REST

**REST** models everything as a **resource**, a thing with its own URL (an **endpoint**), and uses [HTTP](/computing-fundamentals/http-and-https) methods as the verbs. To build the page the client sends `GET /products/42`, then `GET /products/42/price`, then `GET /products/42/reviews?limit=3`. Each reply carries a status code (`200` for success, `404` for not found) and usually a JSON body, a plain-text format of nested fields.

Why so common? It rides on plain HTTP, so every browser, proxy and debugging tool already understands it. A `GET` response can be cached by the browser and by a [CDN](/computing-fundamentals/load-balancers-and-cdns), so the second visitor to the mug page may never reach your server.

The cost is a mismatch between resources and screens. Two things can go wrong:

- **Under-fetching:** one request doesn't return enough, so the client makes three round trips.
- **Over-fetching:** the product endpoint returns forty fields, including the warehouse location, and the page needs four.

You can fix either by adding a custom endpoint like `/product-page/42`, but that pulls the server toward one endpoint per screen.

## GraphQL

If the client's problem is choosing fields, why not let it choose? **GraphQL** exposes one endpoint and a typed **schema**, a list of every type and field the server knows. The client sends a query that names exactly what it wants:

```graphql
{
  product(id: 42) {
    name
    price
    reviews(limit: 3) {
      stars
      text
    }
  }
}
```

One request, one response, with no forty-field payload and no three round trips. That is why teams with many different clients (a phone app, a website, a partner integration) like it: each asks for its own shape without a new endpoint.

What does it cost? Caching gets harder. Queries usually travel as `POST` requests to a single URL, and a CDN has little to key on, so most of the free caching from REST is gone. The second cost is more work on the server, and it takes four steps to see.

First, how does the server fill in the answer? For each field it runs a **resolver**, a small function that returns that one field's value. In the mug query only the product and reviews resolvers query the database, once each; the rest just read fields already fetched.

Now suppose the page also shows who wrote each review, so the client adds `author { name }` inside `reviews`. The reviews table stores only an author's ID, so the author resolver runs once for each review, with a query each time:

```text
product resolver   1 query
reviews resolver   1 query
author resolver    1 query x 3 reviews = 3 queries
total              5 queries
```

Five is tolerable. Let the client raise `limit` to 50 and the total becomes 1 + 1 + 50 = 52. This is the [N+1 query](/systems-and-infrastructure/n-plus-one-queries) problem: one query for a list, then one more per row.

The usual fix here is **batching**. The author resolver doesn't query right away. It writes down the author ID it needs and waits until every review's resolver has run, then makes one query for all the IDs together. The 52 queries become 3:

```text
product 1 + reviews 1 + authors (one batched query) 1 = 3 queries
```

GraphQL doesn't do this for you, so the server team has to build it.

Last, the client controls the query's shape, which also means it controls the cost. If an author has a `reviews` field too, a query can go product, reviews, author, reviews, author, and each level multiplies the work below it. So servers usually cap **query depth**, rejecting anything nested more than a set number of levels (say 5), and often cap total cost as well. REST never needed this, because each endpoint fixed its own shape.

So GraphQL trades REST's extra round trips for server effort.

## gRPC

Now suppose the product page is assembled by your own backend, which calls a separate pricing service dozens of times a second. No browser, no CDN, and the caller and callee are both code you control. **gRPC** is built for this. You write the contract as a **Protocol Buffers** schema, which lists each procedure and the typed fields it takes and returns:

```protobuf
service Pricing { rpc GetPrice (PriceRequest) returns (PriceReply); }
```

A tool generates client and server code from that file, so calling the pricing service looks like calling a local function. Messages travel as compact binary ([data representation](/computing-fundamentals/data-representation) explains why binary is smaller than JSON text) over HTTP/2, which lets many calls share one connection and supports **streaming**, where either side sends a series of messages on one call.

The cost is reach. Browsers can't speak gRPC directly, so a web client speaks a variant, gRPC-Web, through a proxy that translates. Binary messages are also unreadable in a log or with `curl` unless you have the schema and a tool. And you give up the shared HTTP caching REST gets.

## Which one fits

The product page now has three designs:

| Situation                                           | Usual pick | Why                             |
| --------------------------------------------------- | ---------- | ------------------------------- |
| Public API, many unknown clients, read-heavy        | REST       | Familiar, debuggable, cacheable |
| Several client types, each needing different fields | GraphQL    | The client picks the shape      |
| Service-to-service calls inside your system         | gRPC       | Fast, typed, streaming          |

These mix freely. A common arrangement has the browser talk to a REST or GraphQL layer, which calls internal services over gRPC. Internal services have one known caller and gain little from client-chosen fields, and gRPC on the public site brings the browser proxy and lost CDN caching.

**Rule of thumb.** Match the API style to the caller: REST where HTTP caching and familiarity matter, GraphQL where varied clients need to choose their own data, gRPC where you control both ends and speed matters.
