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

The key has to be generated once per real-world action — once per "place
order" button click, say — and reused across every retry of that same
action. Generating a fresh key on every retry defeats the entire
mechanism, since the server would then see each retry as a brand-new,
never-seen-before request.

## Where this shows up constantly

- **Payment systems**, where a duplicate charge is a direct, visible harm
  to the user — this is exactly why real-world payment APIs require an
  idempotency key on charge-creation requests.
- **Message queues**, most of which guarantee a message is delivered _at
  least_ once, not _exactly_ once — meaning a consumer processing that
  message has to be written idempotently, or an occasional duplicate
  delivery turns into a duplicate side effect.
- **Any system that retries automatically on failure** — including
  asynchronous background jobs that are retried by the platform running
  them with no code explicitly asking for it — where idempotency becomes
  non-optional rather than merely good practice, since the retry is going
  to happen whether the code was written to expect it or not.
- **Database writes**, where an "insert-or-update" operation is
  idempotent by construction, but a plain insert retried after a timeout
  can silently create a duplicate row.

Practically every client on a real network will eventually retry a
request it can't confirm succeeded — a timeout simply doesn't tell you
whether the other side got the message. Idempotency, or an idempotency
key standing in for it where the operation itself isn't naturally
idempotent, is the mechanism that makes that retry harmless instead of a
second charge, a second order, or a second email.
