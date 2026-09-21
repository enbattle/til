---
title: Idempotency
summary: Designing an operation so retrying it is harmless — the property that makes it safe to retry a request you're not sure succeeded.
date: 2026-09-14
---

An operation is **idempotent** if doing it more than once has exactly the
same effect as doing it once. Setting a user's name to "Alex," run three
times in a row, leaves the account in the same end state as running it
once — that's idempotent. Charging a credit card $10, run three times, bills
the card three times — that's not.

## Why this matters the moment a network is involved

Networks fail partway through requests, and when that happens, the
client genuinely can't tell what occurred: maybe the server never
received the request, maybe it processed it fully and the response was
lost on the way back. A client waiting for a response that never arrives
has no way to distinguish those two cases from where it's sitting. The
only response that covers both possibilities is to retry — which means
the safety of retrying is what actually matters, not just whether a
retry is _possible_. Idempotency is exactly that: if the original attempt
already went through, a retry becomes a harmless no-op instead of
repeating a side effect that already happened.

Concretely: a client sends a request to charge a card, tagged with a
unique key it generated for this specific attempt. It times out waiting
for a response. It retries, sending the exact same request with the same
key. If the server actually processed the first attempt, it recognizes
the key it's already seen and returns the original result instead of
charging the card a second time.

## Making a naturally non-idempotent action safe: idempotency keys

Not every real-world operation is naturally idempotent — "charge a card"
fundamentally isn't, since doing it twice really does mean two charges.
The standard fix is an **idempotency key**: a unique identifier the
client generates once and attaches to the request. The server remembers
which keys it has already processed and, if it sees one again, returns
the original result instead of repeating the side effect:

```python
def charge_card(idempotency_key, amount):
    existing = db.find_by_idempotency_key(idempotency_key)
    if existing:
        return existing.result  # already processed — return it, don't re-charge

    result = payment_gateway.charge(amount)
    db.save_idempotency_key(idempotency_key, result)
    return result
```

This sketch has a gap: if two requests with the same key arrive
concurrently, both can read no existing result before either saves one.
A real implementation needs a unique constraint (or lock) on the
idempotency key at the database level so a concurrent duplicate is
rejected or blocked rather than racing through.

The key has to be generated once per real-world action — once per "place
order" button click, say — and reused across every retry of that same
action. Generating a fresh key on every retry defeats the entire
mechanism, since the server would then see each retry as a brand-new,
never-seen-before request.

## The same problem inside a database

Database writes have the same failure mode in miniature. An
insert-or-update that sets fixed values is idempotent by construction,
since running it twice leaves the same row, but one that increments a
counter or appends to a value is not. A plain insert retried after a
timeout can silently create a duplicate row.

## Where you'll meet this

Anything that retries automatically needs this, including background jobs
that the platform re-runs on failure without any code asking it to. A shopper
who double-clicks "place order", or a mobile app that retries a charge over a
flaky connection, is the payments case: a client-generated key sent with every
attempt lets the server return the first result instead of billing the card
twice, which is why many payment APIs accept an idempotency key on
charge-creation requests. In a notification or email pipeline, queues
generally deliver at least once, so a worker can receive the same message
twice; recording which messages were already handled lets it skip a redelivery
instead of sending it again. Chat works the same way: a client that never sees
an acknowledgment will send the message again, and an ID the client generated
once lets the server drop the duplicate.
