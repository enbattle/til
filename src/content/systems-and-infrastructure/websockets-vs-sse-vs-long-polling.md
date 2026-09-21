---
title: WebSockets vs. Server-Sent Events vs. Long Polling
summary: Three ways to push updates to a browser without it asking each time, what each one costs, and which to reach for first.
date: 2026-09-21
---

HTTP was built around a client asking and a server answering. A server
that wants to tell a client something ("you have a new message") has no
way to start a conversation on its own. The naive workaround is
**polling**: the client asks "anything new?" every few seconds. It works,
but most answers are "no," and updates arrive up to one interval late.
Three techniques do better.

## Long polling: hold the question open

In **long polling**, the client sends an ordinary request, and the
server does not answer right away. It holds the request open until it
has something to report or a timeout passes (often 30 seconds or so).
The client then immediately sends the next request.

```js
async function poll(cursor) {
  const res = await fetch(`/updates?after=${cursor}`);
  const { events, next } = await res.json();
  handle(events);
  poll(next); // ask again as soon as we get an answer
}
```

It needs nothing beyond plain HTTP, so it works through nearly any proxy
and any client. The cost is that every update ends a request and starts
another, each carrying full HTTP headers. The client also has to send a
cursor (`after=...`), and the server has to be able to find events after
it, so that events arriving between one request ending and the next
starting are not missed.

## Server-sent events: a one-way stream

With **server-sent events** (SSE), the client makes one ordinary HTTP
request and the server never finishes the response. It keeps writing
small text messages down that same connection as events happen. In the
browser, the `EventSource` API handles this, and it reconnects
automatically if the connection drops. Each message can carry an `id`,
and on reconnect the browser sends the last one it saw in a
`Last-Event-ID` header so the server can resume where it left off.

The limits are direction and format. Data flows only from server to
client, and messages are text. The browser API also can't set custom
headers on the request, which complicates token-based authentication,
though cookies work.

## WebSockets: a two-way channel

A **WebSocket** starts as an HTTP request that asks to be upgraded. If
the server agrees (status `101 Switching Protocols`), the same
underlying connection stops speaking HTTP and becomes a persistent,
two-way channel where either side can send a message at any time, text
or binary, with very little per-message overhead. The price is that you
get less for free: the browser API does not reconnect for you, so
reconnection and catching up on missed messages are yours to write.

## Which one to reach for

If updates only flow from server to client (a live score, a progress
bar, a notification badge), start with SSE. It is plain HTTP, it
reconnects itself, and any actions the user takes can go back through
ordinary requests. Choose WebSockets when the client also sends messages
frequently and latency matters, as in chat, collaborative editing or
games. Long polling is the fallback for environments where the other two
are blocked, or for updates rare enough that a held request is enough.

## What all three cost at scale

Each connected client is an open connection held by some server, so
memory and file descriptors, not CPU, are often the first limit. Under
HTTP/1.1, browsers cap concurrent connections per host at around six,
so several tabs each holding an SSE stream can starve regular requests
to the same host; HTTP/2 multiplexes many streams over one connection
and largely removes this.

Proxies and load balancers add their own idle timeouts, so a quiet
connection may get cut unless something is sent periodically: a
heartbeat on a WebSocket, or a comment line on an SSE stream. A proxy
that buffers responses can also hold back SSE messages until enough
accumulate.

Because connections outlive requests, a client that reads slowly leaves
the server buffering messages for it. Cap that buffer and drop or
disconnect the client, which is
[backpressure](/systems-and-infrastructure/backpressure) applied to one
connection. And when a server restarts, every client it held reconnects
in the same instant, a
[thundering herd](/systems-and-infrastructure/thundering-herd-problem).
Clients should reconnect with
[exponential backoff](/systems-and-infrastructure/exponential-backoff)
and random jitter. With many servers, a message must also reach the
server holding the right connection, which usually means a shared
publish-subscribe layer between them.

## Where you'll meet this

In chat, WebSockets are the usual choice, since typing indicators and
sent messages travel the same connection as incoming ones. The design
work is mostly in what happens on reconnect: fetching what was missed,
and not delivering a message twice. A news feed rarely needs a
constant stream. SSE or long polling can drive a "new posts" banner,
while the feed itself loads through normal requests.
