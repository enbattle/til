---
title: HTTP and HTTPS
summary: HTTP is the request-and-response language of the web, HTTPS wraps it in TLS so the server is verified and the traffic is private, and each HTTP version mainly changes how many requests share a connection.
date: 2026-10-07
---

Your browser is loading the home page of `shop.example.com`. Following [IP, TCP, UDP and DNS](/computing-fundamentals/ip-tcp-udp-and-dns), it has looked up the server's address and opened a TCP connection, a reliable byte pipe between two machines. But a pipe carries bytes, not meaning. How does the server know you want the home page? That is what HTTP is for.

This page covers the request and response, the methods, cookies, HTTPS, and how HTTP versions reuse a connection.

## Requests and responses

**HTTP** (HyperText Transfer Protocol) is an agreed format for a question and its answer. Here is the exchange for the home page:

```text
GET / HTTP/1.1
Host: shop.example.com
Accept-Language: en

HTTP/1.1 200 OK
Content-Type: text/html

<html>...the home page...</html>
```

The top block is the **request**. Its first line holds a **method**, `GET`, meaning "fetch", and what to fetch, `/`, the home page.

The lines below are **headers**, named metadata such as the language you read. A request can also carry a **body** of data you send.

The bottom block is the **response**: a **status code** (`200 OK`), headers and a body. The code's first digit says who to blame. `2xx` means it worked, `3xx` look elsewhere, `4xx` the request was wrong (`404` not found), `5xx` the server failed.

A shop must also take your changes, which needs other verbs.

## Methods on the shop

Caches and retrying clients treat methods differently. Follow one shopping trip.

Browsing a product sends `GET /products/42`. A `GET` only reads and changes nothing on the server, so it is **safe**: a cache can keep the answer for the next visitor.

Next you change your shipping address. `PUT /account/address` carries the whole new address and replaces what the server holds. Send it twice and the account ends up the same as after once, which is **idempotent**, as [Idempotency](/systems-and-infrastructure/idempotency) explains. A client with no reply can resend it. `DELETE /basket/items/7` is the same: gone after one call, still gone after two.

Then you place the order with `POST /orders`. `POST` means "create something, or run an action". Send it twice and you get two orders: neither safe nor idempotent, so a timed-out order is dangerous to retry blindly.

Last, `PATCH /account/address` sends only the changed field. "Set postcode to 10001" repeats harmlessly but "add 1 to the quantity" does not, so `PATCH` is not guaranteed idempotent.

| Method | On the shop                | Safe | Idempotent |
| ------ | -------------------------- | ---- | ---------- |
| GET    | read a product             | yes  | yes        |
| PUT    | replace the address        | no   | yes        |
| DELETE | remove a basket item       | no   | yes        |
| POST   | place an order             | no   | no         |
| PATCH  | change part of the address | no   | not always |

Each request stands alone, though, so how does the shop know whose basket you mean?

## Statelessness and cookies

The server sees each request on its own. This property is **stateless**, and it is deliberate: with session data in a store every server shares, any server can answer any request, so you can add machines behind a [load balancer](/computing-fundamentals/load-balancers-and-cdns) freely.

State comes back through **cookies**. When you log in, the response includes a `Set-Cookie` header with a session ID. The browser stores it and sends it back as a `Cookie` header on later requests, so the server can look the ID up and find your basket. But a cookie is just a header, and on plain HTTP anyone on the café's Wi-Fi can read it and borrow your session.

## HTTPS: encryption plus identity

**HTTPS** is HTTP sent through **TLS** (Transport Layer Security). The obvious first idea is encryption alone, so the café can't read it. That fails if you are encrypting perfectly to an impostor, who then reads it all.

So TLS also proves who is on the other end, during a **handshake** the browser and server run before any HTTP.

The server starts by presenting a **certificate**, a document tying `shop.example.com` to a public key (one half of a key pair, see [Encoding, Hashing and Encryption](/computing-fundamentals/encoding-hashing-and-encryption)) whose private half only the shop holds.

Anyone can write a certificate, so it is signed by a **certificate authority** (CA), an organization your browser or operating system already trusts. The browser checks the signature, name and expiry date, then makes the server prove it holds the private key, which an impostor copying the certificate cannot.

Both sides then derive a **shared key** and encrypt everything after with it. So: the certificate proves who you're talking to, and the shared key keeps what you say private.

The cost is time. A **round trip** is a message out and its reply back: 50 ms there + 50 ms back = 100 ms. TLS 1.2 needed two round trips after TCP's own; TLS 1.3 needs one. So a new connection costs 1 (TCP) + 1 (TLS 1.3) = 2 round trips, 200 ms, before `GET /` even leaves.

## Reusing the connection

The home page names about 30 images and scripts. A fresh connection for each would pay that setup 30 times, so **HTTP/1.1** keeps the connection open (**keep-alive**) for the next request. It handles one request at a time per connection, so browsers open around six and queue the rest.

**HTTP/2** fixes that by **multiplexing**: many requests and responses interleave as separate streams over one connection, so all 30 share one connection. Its weakness is below it: TCP delivers bytes in order, so one lost packet stalls every stream until it is resent. This is **head-of-line blocking**.

**HTTP/3** removes it by replacing TCP with **QUIC**, which runs over UDP and recovers losses per stream, so a lost packet stalls only its own stream. QUIC also folds the TLS 1.3 handshake into connection setup, so a new connection needs one round trip in total (100 ms), not the two above.

Some networks block UDP, so browsers fall back to HTTP/2. To push updates unprompted, see [WebSockets vs. Server-Sent Events vs. Long Polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling).

**Rule of thumb.** Treat each HTTP request as independent, make anything that may be retried idempotent, and spend as few connection setups as you can: setup costs round trips, and every version of HTTP is mostly a way to pay it less often.
