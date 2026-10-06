---
title: WebSockets vs. Server-Sent Events vs. Long Polling
summary: Three ways to push updates to a browser without it asking each time, what each one costs, and which to reach for first.
date: 2026-09-21
---

Say you are building a team chat app. When a colleague sends you a message, your browser should show it within a second. But HTTP is built around a client asking and a server answering, and a server has no way to start a conversation by itself. So how does the message reach you?

The obvious answer is **polling**: your browser asks "anything new?" every few seconds. It works, but most answers are "no," each question costs a full request, and a message can arrive up to one interval late. Three techniques do better.

## Long polling: hold the question open

In **long polling**, your browser sends an ordinary request and the server does not answer right away. It holds the request open until a message arrives or a timeout passes (often 30 seconds or so), then responds. The browser immediately asks again.

```js
async function poll(cursor) {
  const res = await fetch(`/messages?after=${cursor}`);
  const { messages, next } = await res.json();
  show(messages);
  poll(next); // ask again as soon as we get an answer
}
```

It needs nothing beyond plain HTTP, so it works through nearly any proxy and client. The cost: every response ends one request and starts another, each carrying full HTTP headers. And there is a gap between one request ending and the next starting, during which a message could slip by. That is why the client sends a **cursor** (`after=...`, the position of the last message it saw), and the server must be able to find everything after it.

## Server-sent events: a one-way stream

With **server-sent events** (SSE), the browser makes one HTTP request and the server never finishes the response. It keeps writing small text messages down that connection as events happen. The browser's `EventSource` API handles the details and reconnects automatically if the connection drops. Each message can carry an `id`, and on reconnect the browser sends the last one it saw in a `Last-Event-ID` header, so the server can resume where it left off. That is the cursor again, built in.

The limits are direction and format. Data flows only from server to client, and messages are text. `EventSource` also can't set custom headers, which complicates token-based authentication, although cookies work.

## WebSockets: a two-way channel

A **WebSocket** starts as an HTTP request asking to be upgraded. If the server agrees (status `101 Switching Protocols`), the same underlying connection stops speaking HTTP and becomes a persistent channel where either side can send a message at any time, text or binary, with little per-message overhead. The price is that you get less for free: the browser API does not reconnect for you, so reconnecting and catching up on missed messages are yours to write.

## Which one for the chat app?

Decide by direction of traffic. The conversation sends messages both ways, shows typing indicators from others, and needs low latency, so a WebSocket carrying both directions earns its extra work, and once a tab holds one, the unread badge and notifications ride on it too rather than on a second stream. A page that only displays updates, such as a notifications view or a status page, is where SSE fits: traffic flows from server to browser only, it is plain HTTP and reconnects itself, and anything the user does goes back as an ordinary request. Long polling is the fallback when the network blocks the other two, or when updates are rare enough that a held request is plenty.

## What they cost at scale

Every connected user is an open connection held by some server, so memory and file descriptors (the operating system's handles on open connections) are often the first limit, not CPU. Under HTTP/1.1, browsers allow only about six concurrent connections per host, so a few tabs each holding an SSE stream can starve ordinary requests to the same host. HTTP/2 multiplexes many streams over one connection and largely removes the problem.

[Proxies and load balancers](/systems-and-infrastructure/forward-vs-reverse-proxy) add idle timeouts, so a quiet connection may be cut unless something is sent periodically: a heartbeat on a WebSocket, or a comment line on an SSE stream. A proxy that buffers responses can also hold SSE messages back until enough accumulate.

A user on a bad connection reads slowly, and the server keeps buffering messages for them. Cap that buffer and drop or disconnect the client, which is [backpressure](/systems-and-infrastructure/backpressure) applied to one connection. When a chat server restarts, every client it held reconnects in the same instant, a [thundering herd](/systems-and-infrastructure/thundering-herd-problem), so clients should reconnect with [exponential backoff](/systems-and-infrastructure/exponential-backoff) and random jitter. And with many servers, a message sent to a user on server A must reach the server holding the recipient's connection, which usually means a shared publish-subscribe layer, often a [message queue](/systems-and-infrastructure/message-queues) or broker, between them.

**Rule of thumb.** If updates flow only from server to client, start with SSE; reach for WebSockets when the client sends often and latency matters, and keep long polling for networks that block both. Whichever you pick, design for reconnection first, because connections will drop.

## Where you'll meet this

In chat and messaging, most of the work is what happens on reconnect: fetching what was missed using a cursor, and not delivering a message twice, which is where [idempotency](/systems-and-infrastructure/idempotency) comes in. A news feed rarely needs a constant stream: SSE or long polling can drive a "new posts" banner while the feed itself loads through normal requests. A notification pipeline uses the same channels for the last hop, from the server that holds the user's connection to the screen.
