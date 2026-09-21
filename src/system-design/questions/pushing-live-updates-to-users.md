---
title: How do I push live updates to users?
summary: Which way to push server events to a browser, and what changes once many clients hold connections open at once.
date: 2026-09-21
order: 7
---

A new chat message should appear without a refresh. A score, a progress bar or
a notification badge should change the moment the server knows. Web pages
normally work the other way around: the client asks and the server answers, so
a server that wants to speak first needs a technique for it. The right one
depends on which direction the data flows and how many people are connected.

## First, whether you need it

If a few seconds of delay is fine and the audience is small, having the client
ask every few seconds needs nothing special and is the cheapest option. What
follows is for when it isn't fast enough or costs too many requests.

## Three ways to push

Server-sent events are the default when data only flows from the server to the
client: they're plain HTTP, and the browser reconnects for you. WebSockets are
for a client that also sends often and needs low latency, as in chat, and they
leave more of reconnection and catching up to you. Long polling is the fallback
when the other two are blocked. How each one works and what each costs is in
[WebSockets vs. Server-Sent Events vs. Long Polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling).

## What changes when many clients are connected

Once thousands of clients hold connections open, the limits stop being about
request rate and start being about connection count and memory. Slow readers,
mass reconnects after a restart, and getting an update to the right server when
there are several all follow from that, and the comparison topic covers each.
The two with topics of their own are
[backpressure](/systems-and-infrastructure/backpressure), for a client that
can't keep up, and the
[thundering herd](/systems-and-infrastructure/thundering-herd-problem), for the
reconnect wave that
[exponential backoff](/systems-and-infrastructure/exponential-backoff) softens.

## How they combine

Pick the transport with those scale problems in mind, and plan what a client
does after a dropped connection, since it has to learn what it missed.

## When it isn't this problem

If the update is slow to produce because the work behind it takes a long time,
the push is only how you tell the user it finished; the slow part is covered in
[How do I run work that takes too long for a single request?](/system-design/running-work-that-takes-too-long)
If pushes aren't arriving because a service they depend on is failing, start
with
[How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others)
