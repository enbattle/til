---
title: How do I get users' requests to the right server?
summary: What sits between the internet and your application as you outgrow one server, and which piece to add first.
date: 2026-09-26
order: 9
---

At first a domain name points straight at one server, and every request lands
there. Then one server can't handle the traffic, or you need a second one so a
crash doesn't take the site down, or the application splits into several
services that each own part of the URL space. Now something has to decide, for
every request, which machine answers it.

## What to check first

Look at where the pressure is. If one server's CPU or memory is saturated while
the database is comfortable, you need more application servers and a way to
spread requests across them. If the servers are fine but the site goes down
whenever one of them does, you need redundancy more than capacity. If the
database is the thing struggling, adding servers in front of it won't help, and
can make it worse by opening more connections to it; this is the wrong
question. If you can't tell which it is, start with
[How do I figure out what's wrong with my system?](/system-design/figuring-out-whats-wrong).

## Options, cheapest first

A [reverse proxy](/systems-and-infrastructure/forward-vs-reverse-proxy) in
front of a single server is worth having before you need a second one. It
takes over HTTPS and caching of static files, so the application does less,
and it puts the entry point in place for later. It costs one more component to
configure and run.

Static files and responses that are the same for everyone can go one step
further out, onto a CDN. That takes load off everything behind it, and costs
you copies that can go stale until they expire or are purged; the
[caching topic](/systems-and-infrastructure/caching) places it alongside the
other layers.

Load balancing across several identical servers is the same proxy doing its
main job, and it buys both capacity and survival of a single server failing.
The cost is that the servers can no longer each keep their own users' state,
and the proxy topic covers the ways around that. Pair it with health checks,
from [Self-Healing Systems](/systems-and-infrastructure/self-healing-systems),
so traffic stops going to an instance that is broken or still starting up.

When requests for the same user or key should keep landing on the same server,
for example because that server holds a warm cache for them,
[consistent hashing](/systems-and-infrastructure/consistent-hashing) keeps most
of those assignments stable as servers come and go. Pinning keys to servers
gives up some evenness, as the proxy topic describes.

Routing by path, so `/api/` and `/search/` reach different services, is a
reverse proxy feature too, but it only pays once the application is split into
separate services, and every new service means another routing rule to keep
right; whether to split is in
[Monolith vs. Microservices](/systems-and-infrastructure/monolith-vs-microservices).

## How they combine

A typical setup stacks them: a CDN for static content, then a pair of reverse
proxies that terminate HTTPS, apply a
[rate limit](/systems-and-infrastructure/rate-limiting) and balance across a
pool of health-checked application servers. Each layer is optional until the
problem it handles shows up.

## When it isn't this problem

If requests reach the right server but it is slow because every one waits on
the database, start with
[What do I do when my database can't keep up with reads?](/system-design/database-cant-keep-up-with-reads).
If servers are up but a failing dependency drags them down, see
[How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others).
For long-lived connections that the server uses to push data, see
[How do I push live updates to users?](/system-design/pushing-live-updates-to-users).
