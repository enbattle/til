---
title: How should I structure my services and storage in the first place?
summary: The two early architecture decisions, how many deployable pieces to build and which kind of database to use, and what each one commits you to.
date: 2026-09-20
order: 6
---

This one starts from a decision rather than a symptom. You're beginning a
system, or the shape of an existing one is causing trouble, and two choices
deserve deliberate thought: how many separately deployed pieces the
application is, and what kind of database holds its data. Both are easier to
get right early than to change later.

## What to check first

There's nothing to measure in a running system here. The inputs are facts
about your situation: how many people work in the codebase and how often their
deploys collide, whether any one feature has to scale independently of the
rest, and what your queries look like (joins across related data, or one
dominant access pattern).

## One deployable unit, or many

A [monolith](/systems-and-infrastructure/monolith-vs-microservices) is one
codebase, one build, one deploy. Debugging stays inside one process, and a
change either lands whole or doesn't. The costs are that everything scales
together even when one feature is the busy one, and that a large team in one
codebase collides more often.

Microservices split the same application into independently deployable
services that talk over the network. That buys separate deploy schedules and
the ability to scale only the busy service. It also removes what a single
process gave you for free, and each loss becomes something you build on
purpose: calls that can fail or time out, data no single transaction covers,
and requests that span several services. The common advice today is to start
with a monolith and split only when the pain is specific. A
modular monolith, one deployable unit with disciplined internal boundaries,
keeps the simple deploy and makes a later split easier.

## Which kind of database

A relational (SQL) database stores data in tables with a fixed schema, the
declared shape of each table, and lets a single query join related tables.
NoSQL covers document stores, key-value stores and others that give up some of
that structure. [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql)
covers the trade in detail. The short version is that relational suits data
with relationships you query in many ways, and NoSQL suits one dominant access
pattern or write volume that has to spread across many machines. How far each
NoSQL store gives up consistency for that scale differs by product, and the
underlying tension is the one in the
[CAP theorem](/systems-and-infrastructure/cap-theorem).

## How the two choices interact

Splitting into services usually means each service owns its own data, which
makes a per-service database choice possible and also removes the single
transaction that used to cover a whole operation. The follow-on problems each
have their own question here. Calls between services failing is
[How do I stop one failing service from taking everything else down?](/system-design/one-failing-service-taking-down-others).
Consistency across services is
[How do I keep data correct when many users or services change it at once?](/system-design/keeping-data-correct-under-concurrency).
Debugging across services is
[How do I figure out what's wrong with my system?](/system-design/figuring-out-whats-wrong).

## When it isn't this problem

If you already have a running system and one part is hurting, start from the
symptom in
[How do I figure out what's wrong with my system?](/system-design/figuring-out-whats-wrong).
Most pain in an existing system has a narrower fix than a new architecture.
