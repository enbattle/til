---
title: Forward Proxy vs. Reverse Proxy
summary: The same middleman working for opposite sides — one speaks for clients going out, the other for servers taking requests in, and the second is where load balancing usually lives.
date: 2026-09-26
---

A **proxy** is a server that sits between a client and the server it wants to
reach. The client sends its request to the proxy, the proxy sends a request of
its own to the destination, and the answer comes back the same way. The
difference between the two kinds is whose side the proxy is on. A forward proxy
works for a group of clients and hides them from the servers they visit. A
reverse proxy works for a group of servers and hides them from the clients
visiting them.

## Forward proxy: speaking for the clients

A company might route every employee's web traffic through one proxy. Each
laptop is configured to send its requests there, and the proxy makes them on
the laptop's behalf, so the websites see the proxy's IP address instead of the
laptop's. Because every outgoing request passes through one place, that place
can block sites and record which ones were visited.

How much more it can do depends on encryption. Almost all web traffic uses
HTTPS, which encrypts it with **TLS**, the protocol that scrambles data between
a browser and a site and uses a **certificate**, a credential signed by an authority the
browser already trusts, to prove the site is who it claims to be. For HTTPS, the browser asks the proxy to open
a tunnel to the destination (the HTTP `CONNECT` method) and encrypts end to end
through it. The proxy sees which host is being contacted, but not the pages or
the data, so it can't cache or inspect them. To read the traffic, the proxy
has to decrypt it: it presents a stand-in certificate for each site, signed
by the company's own authority. The laptop accepts it only because the company
installed that authority (a **root certificate**) as trusted on it, as
company-managed laptops often have.

Servers use forward proxies too, as an **egress proxy**: outbound calls from a
production network go through one controlled exit, with direct outbound traffic
blocked at the firewall, so a compromised machine can only reach the
destinations on an allowlist, and partner systems see requests coming from a
small, known set of addresses.

## Reverse proxy: speaking for the servers

A site's domain name points at the reverse proxy, not at the application, so
the browser has no idea it's there; from its side, the proxy is the site.
Almost any website with real traffic works this way. Behind the proxy may be
one application server or hundreds. Common software for the job includes
nginx, HAProxy and Envoy, and every major cloud offers a managed version.

Its main job is **load balancing**: spreading incoming requests across several
identical copies of the application, so no single server takes all the
traffic and more can be added when demand grows. The proxy picks a server per
request (or per connection, for the layer 4 kind below), by simple rotation (round robin) or by whichever has the fewest
requests in progress. It also sends each server a periodic **health check**, a
small request to see whether it answers properly, and stops routing to one
that fails, which [Self-Healing Systems](/systems-and-infrastructure/self-healing-systems)
covers in depth.

Spreading requests freely only works if any server can answer any request. A
server that keeps a user's login session in its own memory breaks that, since
the user's next request may land elsewhere. One fix is to keep that state in a
shared store, or in a signed token the client carries, such as a
[JWT](/security/jwt); [Session vs. Token Authentication](/security/session-vs-token-auth)
compares the two. The other is **sticky sessions**: the balancer sends each
user back to the same server, by a cookie or by hashing some key, which
[consistent hashing](/systems-and-infrastructure/consistent-hashing) keeps
stable as servers come and go. Stickiness costs evenness, since a few heavy
users can overload one server, and the sessions on a server are lost when it
dies.

Balancers come in two broad kinds, named after layers of the standard
networking model. A **layer 4** balancer forwards connections by IP address
and port without looking inside the request. A **layer 7** balancer reads each
HTTP request, so it can route by path or header, sending `/api/` to one
service and everything else to another.

Once every request passes through it, a reverse proxy is the natural place for
other shared work:

- **TLS termination**: it holds the site's certificate and decrypts HTTPS, so
  the application servers behind it handle plain HTTP on a private network.
- **Caching** responses that are the same for everyone, like images and
  scripts, so those requests never reach the application. A **CDN** (content
  delivery network) is a caching reverse proxy run in many cities at once, so
  the nearest location answers.
- Absorbing slow clients: the proxy collects the whole request from a phone on
  a weak signal before passing it on, so an application server isn't tied up
  waiting for it.
- Enforcing a [rate limit](/systems-and-infrastructure/rate-limiting) before
  traffic reaches anything expensive.

A reverse proxy that also checks credentials, limits requests per API key and
reshapes requests between clients and services is usually sold as an **API
gateway**.

## What a reverse proxy costs

Every request takes one extra network hop, which on a local network typically
adds a millisecond or less. The proxy also becomes a single point of failure,
so production setups run at least two and move traffic between them when one
dies. Some layer 4 balancers pass the client's address through unchanged, but any
proxy that opens its own connection to the server hides it: the application
sees the proxy's IP address instead of the client's. An HTTP (layer 7) proxy passes the
original along in a header, usually `X-Forwarded-For`, but a client can send
that header too, so an application should only trust the value its own proxy
added. Long-lived connections also run into the proxy's idle timeouts, which
[WebSockets vs. Server-Sent Events vs. Long Polling](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
covers.

## Where you'll meet this

A URL shortener runs several identical application servers behind a load
balancer, since any one of them can answer a redirect by looking the short code
up in a shared store, and the proxy can cache the most-clicked redirects so they
never reach the application at all. Chat and messaging often put a layer 7
proxy in front of the servers holding
[WebSocket](/systems-and-infrastructure/websockets-vs-sse-vs-long-polling)
connections, and the proxy has to pass the WebSocket handshake through and keep quiet
connections open instead of cutting them at a short idle timeout. In payments
and checkout, the egress side matters: card-industry security rules (PCI DSS)
expect outbound traffic from systems that handle card data to be limited to
what's needed, and an egress proxy with a narrow allowlist, such as the
payment provider's API, is a common way to meet that.
