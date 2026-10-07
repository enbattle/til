---
title: REST vs. gRPC vs. GraphQL
summary: Three common ways to design an API, differing in how the client names what it wants, how data travels, and what each choice does to caching and speed.
date: 2026-10-07
---

Say you run a shop, and the page for a mug needs three things: the product, its price and its top three reviews. The browser has to get them from your server somehow. An **API** (application programming interface) is the agreed contract for that conversation: what the client may ask for, what shape the answer takes, and what errors look like. REST, gRPC and GraphQL are three popular contracts. They differ in how the client says what it wants, so you'll see what each costs on this one page.

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

What does it cost? Caching gets harder. Queries usually travel as `POST` requests to a single URL, and a CDN has little to key on, so most of the free caching from REST is gone. The server also does more work. Each field is filled by a **resolver**, a function the server runs for that field. If the query also asked for each review's author, a resolver that fetches it separately runs one database query per review, the [N+1 query](/systems-and-infrastructure/n-plus-one-queries) problem. Batching helps, but you have to build it. And since clients can ask for deeply nested data, servers usually cap query depth and cost.

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

These mix freely. A common arrangement has the browser talk to a REST or GraphQL layer, which calls internal services over gRPC. If someone suggests "just use GraphQL for everything," the answer is that internal services have one known caller and gain little from client-chosen fields. If someone suggests gRPC for the public site, the answer is the browser proxy and the lost CDN caching.

**Rule of thumb.** Match the API style to the caller: REST where HTTP caching and familiarity matter, GraphQL where varied clients need to choose their own data, gRPC where you control both ends and speed matters.
