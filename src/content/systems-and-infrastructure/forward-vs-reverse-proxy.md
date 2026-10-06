---
title: Forward Proxy vs. Reverse Proxy
summary: The same middleman working for opposite sides: one speaks for clients going out, the other for servers taking requests in, and the second is where load balancing usually lives.
date: 2026-09-26
---

Picture a small online bookshop. Customers visit its website, and the staff browse the web from office laptops. Both streams of traffic can pass through a **proxy**, a server that sits between a client and the server it wants to reach: the client asks the proxy, the proxy asks the destination, and the answer comes back the same way.

So why two kinds? Because a proxy works for one side. A **forward proxy** works for a group of clients and hides them from the servers they visit. A **reverse proxy** works for a group of servers and hides them from the clients visiting them. The bookshop needs one of each.

## Forward proxy: the staff going out

Suppose all staff web traffic goes through one proxy. Each laptop is configured to send its requests there, so websites see the proxy's IP address, not the laptop's. That one place can block sites and log which ones were visited.

Can it also read the pages? Almost all web traffic uses HTTPS, which encrypts it with **TLS**. TLS relies on a **certificate**, a credential signed by an authority the browser already trusts, to prove the site is who it claims to be. For HTTPS, the browser asks the proxy to open a tunnel to the destination (the HTTP `CONNECT` method) and encrypts end to end through it. The proxy sees which host is contacted, but not the pages or data.

To read the traffic, the proxy must decrypt it. It presents a stand-in certificate for each site, signed by the shop's own authority, and a laptop accepts that only because the shop installed the authority (a **root certificate**) as trusted on it.

Servers use forward proxies too. The bookshop's application calls a payment provider through an **egress proxy**: one controlled exit, with direct outbound traffic blocked at the firewall. A compromised server can then only reach destinations on an allowlist.

## Reverse proxy: the customers coming in

Now the other direction. The bookshop's domain name points at a reverse proxy, not at the application, so a customer's browser has no idea it's there. Behind it sit the application servers: one at first, perhaps a dozen at Christmas.

Its main job is **load balancing**: spreading requests across identical copies of the application, so no one server takes all the traffic and more copies can be added as demand grows. It picks servers by rotation (round robin) or by fewest requests in progress. It also sends each server a periodic **health check**, a small request to see whether it answers properly, and stops routing to one that fails. [Self-Healing Systems](/systems-and-infrastructure/self-healing-systems) covers that in depth.

Spreading requests freely only works if any server can answer any request. Say a server keeps a customer's basket in its own memory: the next click may land on a server that has never heard of them. One fix is to keep that state in a shared store, or in a signed token the client carries, such as a [JWT](/security/jwt) (that page compares the two). The other is **sticky sessions**: the balancer sends each customer back to the same server, by cookie or by hashing some key, which [consistent hashing](/systems-and-infrastructure/consistent-hashing) keeps stable as servers come and go. Stickiness costs evenness, and the baskets on a server are lost if it dies.

Balancers come in two kinds, named after layers of the standard networking model. A **layer 4** balancer forwards connections by IP address and port without looking inside the request. A **layer 7** balancer reads each HTTP request, so it can send `/api/` to the ordering service and everything else to the storefront.

Since every request passes through it, the proxy is also a natural spot for other shared work. It can do **TLS termination**, holding the shop's certificate and decrypting HTTPS so the servers behind it handle plain HTTP on a private network. It can cache responses that are the same for everyone, like cover images, so those requests never reach the application. And it can apply a [rate limit](/systems-and-infrastructure/rate-limiting) before traffic reaches anything expensive, like search. A reverse proxy that also checks each caller's credentials and limits requests per API key is usually called an **API gateway**.

## What it costs the bookshop

Every request takes one extra network hop, typically a millisecond or less on a local network. The proxy is also a single point of failure, so production setups run at least two.

The application loses sight of who is calling, because a proxy that opens its own connection to the server shows the server its own address. A layer 7 proxy passes the original along in a header, usually `X-Forwarded-For`. Clients can send that header too, so trust only the value your own proxy added. Long-lived connections also run into the proxy's idle timeouts, which [WebSockets vs. Server-Sent Events vs. Long Polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling) covers.

**Rule of thumb.** Ask whose side the middleman is on: a forward proxy in front of your own clients controls what leaves, a reverse proxy in front of your own servers balances and shields them, and the second should run as a pair, not a single machine.

## Where you'll meet this

A URL shortener runs several identical application servers behind a load balancer, since any one of them can answer a redirect from a shared store, and the proxy can cache the most-clicked redirects. Chat and messaging often put a layer 7 proxy in front of the servers holding [WebSocket](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling) connections, and it has to pass the handshake through and tolerate quiet connections. In payments and checkout, card-industry security rules (PCI DSS) expect outbound traffic from systems handling card data to be limited to what's needed, and an egress proxy with a narrow allowlist is a common way to meet that.
