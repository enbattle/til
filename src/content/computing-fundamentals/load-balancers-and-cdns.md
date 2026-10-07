---
title: Load Balancers and CDNs
summary: A load balancer spreads requests across identical servers and drops the sick ones, and a CDN answers repeatable requests from a copy near the visitor so most of them never reach those servers.
date: 2026-10-07
---

Back to `shop.example.com`, which you met in [HTTP and HTTPS](/computing-fundamentals/http-and-https). It is sale day, and visitors from Sydney to Seattle are opening the home page and loading its images. Say 5,000 requests arrive every second and one server can handle about 500, so you need at least 10 servers, and visitors should not be sent to a server that is down. Who decides which server gets each request?

## Load balancer

A **load balancer** is a [reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy), a server that receives requests on the site's behalf, and it hands each request for the shop to one of several identical servers. That page covers how it picks a server, how **health checks** (small periodic test requests) take a failing one out, and whether it works at layer 4 (connections) or layer 7 (individual HTTP requests). The shop's domain name points at the balancer, so more traffic means adding servers behind it, not buying a bigger one.

Someone will suggest listing all the servers' addresses in DNS instead (see [IP, TCP, UDP and DNS](/computing-fundamentals/ip-tcp-udp-and-dns)). That is free and fine for a small site, but when a server dies, traffic keeps reaching it until someone removes its address and the cached answers expire. A balancer's health checks stop sending to it within seconds.

That is also why you run spare servers: with 12, losing one leaves 11, or 5,500 requests a second of capacity, above the 5,000 you need. And keep the servers stateless, with baskets in a shared store, so the balancer can send any request to any of them.

For the shop, the layer choice comes down to one question: does routing depend on what is asked for? If checkout should go to its own servers, you need layer 7 and pay for decrypting HTTPS at the balancer; if you only need to spread connections, layer 4 is faster.

## CDN

Now for the rest of the problem. Most of what a visitor downloads is the same for everybody: the home page, the logo, the product photos, the scripts. Why should every one of those requests cross an ocean to your servers?

A **CDN** (content delivery network) is a set of servers around the world, called **edge servers**, that keep copies of such responses. A visitor's request is typically steered, by DNS, to a nearby edge. If the edge has a copy, a **hit**, it answers at once. If not, a **miss**, it fetches the response from the shop's own servers, the **origin**, stores it, and answers. A round trip from Sydney to a data center in Virginia takes roughly 200 ms; to an edge in Sydney, a few tens of milliseconds at most. This is [Caching](/systems-and-infrastructure/caching), moved close to the visitor.

At a 90% hit rate, only 500 of the 5,000 requests a second reach the origin. That is one server's worth, so three origin servers behind the balancer cover it even if one fails. The CDN thins the traffic and the balancer shares out the rest, mostly carts and checkouts.

Those dynamic and personal responses go to the origin because a copy would be wrong for the next person. The origin tells the CDN what is safe to share with the `Cache-Control` header:

```
Cache-Control: public, max-age=60      # home page: any cache may keep it for 60 seconds
Cache-Control: private                 # basket page: only the visitor's own browser may
```

`max-age` is a **TTL** (time to live), the number of seconds a copy counts as fresh.

## Keeping copies fresh

At 9:00 the shop changes the home page's sale banner. Edges still hold the old one, so visitors see it for up to another 60 seconds, a delay you can accept for a banner. For something that can't wait, you can ask the CDN to **purge** a URL, which tells every edge to drop its copy. A shorter TTL also bounds the staleness, at the cost of more origin requests.

Images and scripts are better handled by never changing them: put a fingerprint in the file name, such as `app.3f9a.js`, so a new version is a new URL, and the old copies are simply never requested again. Those files can then carry a TTL of a year. [Cache Invalidation](/systems-and-infrastructure/cache-invalidation) covers the trade-offs.

**Rule of thumb.** Serve whatever is the same for everyone from a CDN, fingerprinting files so they can be kept for a long time, and put a balancer with health checks in front of stateless servers for everything personal.
