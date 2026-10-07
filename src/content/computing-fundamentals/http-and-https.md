---
title: HTTP and HTTPS
summary: HTTP is the request-and-response language of the web, HTTPS wraps it in TLS so the server is verified and the traffic is private, and each HTTP version mainly changes how many requests share a connection.
date: 2026-10-07
---

Your browser is loading the home page of `shop.example.com`. Following [IP, TCP, UDP and DNS](/computing-fundamentals/ip-tcp-udp-and-dns), it has looked up the server's address and opened a TCP connection, a reliable byte pipe between two machines. But a pipe carries bytes, not meaning. How does the server know you want the home page? That is what HTTP is for.

## Requests and responses

**HTTP** (HyperText Transfer Protocol) is an agreed format for a question and its answer. The browser sends a **request**: a **method** saying what to do, a **path** saying to what, **headers** (named metadata lines such as which languages you read), and sometimes a **body**. Ours is `GET /`, meaning "fetch the home page". The server sends a **response**: a **status code**, headers, and usually a body, here the page's HTML.

The status code's first digit tells you who to blame. `2xx` means it worked (`200 OK`). `3xx` means look elsewhere (`301` is a permanent redirect). `4xx` means the request was wrong (`404` not found, `401` not logged in). `5xx` means the server failed (`503` overloaded).

## Methods, safety and idempotency

Why have methods at all, rather than one "do something" verb? Because software between you and the server, such as caches and retrying clients, treats them differently. `GET` is **safe**: it only reads, so a cache can store the answer and a prefetch does no harm. `PUT` (replace this thing) and `DELETE` are not safe, but they are **idempotent**: sending one twice leaves the same result as sending it once, as [Idempotency](/systems-and-infrastructure/idempotency) explains. `POST` (create something, or run an action) is neither, so a timed-out "place order" is dangerous to retry blindly. `PATCH` (change part of a thing) is not guaranteed idempotent either. Servers can break these conventions, but clients and proxies rely on them.

## Statelessness and cookies

The server sees each request on its own. Request 2 carries nothing that says it follows request 1, so how does the shop know whose basket you mean? This property is **stateless**, and it is deliberate: if session data lives in a store every server shares, any server can answer any request, so you can add machines behind a [load balancer](/computing-fundamentals/load-balancers-and-cdns) freely.

State comes back through **cookies**. When you log in, the response includes a `Set-Cookie` header with a session ID. The browser stores it and attaches it as a `Cookie` header to later requests to that site. The server looks the ID up in that shared store and finds your basket. The protocol stays stateless; the client carries the reminder.

## HTTPS: encryption plus identity

Plain HTTP is readable by anyone on the path, such as the café's Wi-Fi. **HTTPS** is HTTP sent through **TLS** (Transport Layer Security), which does two jobs. It encrypts the traffic, and it proves who is on the other end. Encryption alone would not be enough, since you could be encrypting to an impostor.

Before any HTTP, the browser and server run a **handshake**. The server presents a **certificate**: a document tying `shop.example.com` to a public key whose private half only the shop holds, signed by a **certificate authority** (CA), an organization your browser or operating system already trusts. The browser checks the signature, the name and the expiry date, and the server proves it holds that private key. Both sides then derive a shared secret key, and everything after is encrypted with it. An impostor can copy the public certificate, but without the private key it fails that proof.

The cost is time. The handshake needs round trips before the first request can go out. TLS 1.2 needed two on a new connection; TLS 1.3 needs one. At 50 ms each way, TLS 1.3 adds 100 ms before `GET /` even leaves.

## Reusing the connection

The home page arrives, and its HTML names about 30 images and scripts. Opening a fresh TCP and TLS connection for each would pay that setup 30 times. Instead, **HTTP/1.1** keeps the connection open (**keep-alive**) for the next request. But it handles one request at a time per connection, so browsers open around six connections to the same host and queue the rest.

**HTTP/2** fixes that by **multiplexing**: many requests and responses interleave as separate streams over one connection, so all 30 fit on the connection you already paid for. Its weakness is below it. TCP delivers bytes in order, so one lost packet stalls every stream until it is resent. This is **head-of-line blocking**.

**HTTP/3** removes it by replacing TCP with **QUIC**, which runs over UDP and does its own reliability per stream. A lost packet then stalls only its own stream. QUIC also folds the TLS 1.3 handshake into connection setup, so a new connection needs one round trip in total instead of two.

Would you always want the newest? Not necessarily. Some networks block or throttle UDP, so browsers fall back to HTTP/2, and for a handful of requests on a clean network the versions feel the same. If the server needs to push updates unprompted, none of these helps; see [WebSockets vs. Server-Sent Events vs. Long Polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling).

**Rule of thumb.** Treat each HTTP request as independent, make anything that may be retried idempotent, and spend as few connection setups as you can: setup costs round trips, and every version of HTTP is mostly a way to pay it less often.
