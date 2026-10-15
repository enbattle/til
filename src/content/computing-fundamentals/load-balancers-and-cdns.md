---
title: Load Balancers and CDNs
summary: A load balancer spreads requests across identical servers and drops the sick ones, and a CDN answers repeatable requests from a copy near the visitor so most of them never reach those servers.
date: 2026-10-07
---

Back to `shop.example.com`, which you met in [HTTP and HTTPS](/computing-fundamentals/http-and-https). It is sale day, and visitors worldwide are opening the home page and its images. Say 5,000 requests arrive every second and one server can handle about 500. That means at least 5,000 ÷ 500 = 10 servers, and no visitor should be sent to one that is down. Who decides which server gets each request?

This page covers the obvious way to share the work and why it fails, the load balancer that fixes it, the two ways a balancer can read a request, and the CDN that takes traffic off the servers.

## The obvious way: a list in DNS

The shop's domain name is turned into an address by DNS, the system that looks names up (see [IP, TCP, UDP and DNS](/computing-fundamentals/ip-tcp-udp-and-dns)). You could list all 10 servers' addresses under the name, and each visitor would get one of them.

Now one server crashes. Nothing notices: its address stays listed until someone removes it, and even then resolvers keep handing out their saved answer until it expires, sending visitors to a dead machine.

So something must sit in front of the servers, test them, and decide for each request.

## The load balancer

A **load balancer** is a server that the shop's domain name points at. It hands each request to one of the identical servers behind it, which makes it a [reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy), a middleman that speaks for a group of servers.

How does it pick? The simplest rule is **round robin**: take the servers in turn, 1 to 10, then back to 1. Another rule picks the server with the fewest requests in progress, which helps when some requests take far longer than others.

How does it avoid a dead server? With a **health check**: every few seconds the balancer asks each server for a small test page, such as `/health`. A server that fails a few checks in a row is taken out of the rotation, and it goes back in once it passes again.

That is also why you run spares. With 12 servers, losing one leaves 11, or 11 × 500 = 5,500 requests a second of capacity, above the 5,000 you need.

One condition: if a basket lived in one server's memory, the next click could land on another. So keep baskets in a store all servers share, so the servers are **stateless**, holding nothing a visitor needs next.

The balancer now shares the work out. What it can base its choice on depends on how much of each request it reads.

## Layer 4 or layer 7

Networking is described in layers, and two matter here. A **layer 4** balancer works on connections: it sees the sender's address and the port, and passes the connection to a server without looking inside. A **layer 7** balancer works on the HTTP requests themselves: it reads each one, including the path.

Say checkout should run on its own servers, apart from browsing. A layer 4 balancer can't, because `/checkout` is inside the request. A layer 7 balancer reads the path and sends `/checkout` to the checkout servers and everything else to the storefront.

There is a catch. HTTPS encrypts the request, so to read the path the balancer must hold the shop's certificate (the credential that proves the site is genuine) and decrypt the traffic itself. This is **TLS termination**, and the servers behind it then get plain HTTP. Layer 4 skips that work and is faster.

So if routing depends on what is asked for, pay for layer 7; if you only spread connections, layer 4 is enough. [Forward Proxy vs. Reverse Proxy](/systems-and-infrastructure/forward-vs-reverse-proxy) covers sticky sessions and running the balancer as a pair.

Every visitor's request still crosses the world to your data center. Must it?

## CDN

Most of what a visitor downloads is the same for everybody: the home page, the logo, the product photos, the scripts. A **CDN** (content delivery network) is a set of servers around the world, called **edge servers**, that keep copies of such responses. DNS typically steers a visitor's request to a nearby edge.

If the edge has a copy, a **hit**, it answers at once. If not, a **miss**, it fetches the response from the shop's own servers, stores it, and answers.

Those servers are the **origin**. A round trip from Sydney to Virginia takes roughly 200 ms; to an edge in Sydney, a few tens at most. This is [Caching](/systems-and-infrastructure/caching), moved close to the visitor.

At a 90% hit rate, only 10% of requests miss:

```text
5,000 requests a second × 0.10 = 500 reach the origin
```

That is one server's worth, so three origin servers behind the balancer cover it even if one fails.

The misses are mostly personal responses (carts, checkouts), which go to the origin because a copy would be wrong for the next person. The origin tells the CDN what is safe to share with the `Cache-Control` header:

```text
Cache-Control: public, max-age=60      # home page: any cache may keep it for 60 seconds
Cache-Control: private                 # basket page: only the visitor's own browser may
```

`max-age` is a **TTL** (time to live), the number of seconds a copy counts as fresh. But a copy can go out of date while it still counts as fresh, if the origin changes the page first.

## Keeping copies fresh

At 9:00 the shop changes the home page's sale banner. Edges still hold the old one, so visitors see it for up to another 60 seconds, a delay you can accept for a banner. For something that can't wait, you can ask the CDN to **purge** a URL, which tells every edge to drop its copy.

Images and scripts are better handled by never changing them: put a fingerprint in the file name, such as `app.3f9a.js`, so a new version is a new URL, and the old copies are simply never requested again. Those files can then carry a TTL of a year. [Cache Invalidation](/systems-and-infrastructure/cache-invalidation) covers the trade-offs.

**Rule of thumb.** Serve whatever is the same for everyone from a CDN, fingerprinting files so they can be kept for a long time, and put a balancer with health checks in front of stateless servers for everything personal.
