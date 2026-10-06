---
title: Idempotency
summary: Designing an operation so that repeating it leaves the same result as doing it once, which is what makes retrying a request you're unsure about safe.
date: 2026-09-14
---

You click "Place order" on a $40 purchase, the spinner runs for ten seconds, and
then the request times out. Did you get charged? You don't know, and neither does
your app. So can clicking again ever be safe?

## Why you can't just not retry

When a request times out, one of two things happened. Either the server never
received it, or the server charged the card and the response got lost on the way
back. From the client's side the two look identical: silence. If you don't retry
and the first case was true, the customer never gets their order. If you retry
blindly and the second case was true, they're billed twice.

Retrying is the simplest answer that covers both cases, so the question becomes how
to make a retry harmless. The property that does it is **idempotency**: an
operation is idempotent if doing it several times leaves the system in the same
state as doing it once.

Some operations already have it. "Set the shipping address to 12 Elm Street"
leaves the same address however many times it runs. "Add $40 to the total" does
not, because each run changes the result. A charge is the second kind: two
charges are two charges.

## Turning a charge into an idempotent one

The standard fix is an **idempotency key**: a unique ID the client generates for
this one purchase and sends with the request. The server records each key it has
handled, along with the result. When a request arrives with a key it has seen, it
returns the stored result and does not charge again.

```python
def charge_card(idempotency_key, amount):
    existing = db.find_by_idempotency_key(idempotency_key)
    if existing:
        return existing.result  # already handled: replay the answer

    result = payment_gateway.charge(amount)
    db.save_idempotency_key(idempotency_key, result)
    return result
```

So your timed-out order goes out again carrying the same key. If the first
attempt went through, the server hands back that first receipt. If it never
arrived, this is simply the first attempt. The client no longer needs to know
which case it was in.

Where does the key come from? The client creates it once, when you click "Place
order", and reuses it on every retry of that click. Make a fresh key per retry
and the server sees each retry as a new purchase, which defeats the whole
mechanism. A second order, on a later click, gets its own key.

## What the sketch gets wrong

Two details break that code in production.

The first is a race. If a retry arrives while the original is still running, both
requests can look up the key, find nothing and charge. The fix is to let the
database referee: put a unique constraint on the key column and insert the key
_before_ charging, so the second request fails the insert and waits or returns
"already in progress." And pass the same key on to the payment provider with the
charge: if your server dies after charging but before saving the receipt, the
retry's charge is then dropped by the provider instead of billed again.

The second is a key reused with a different request. If the same key shows up
with $90 instead of $40, that is a client bug, not a retry. Store a fingerprint
of the request beside the key and reject a mismatch instead of silently returning
the old $40 receipt.

Keys can't be kept forever, so servers expire them after a window (a day or a few
days is common), longer than any client will plausibly keep retrying.

## The same trap inside a database

A database write fails in miniature the same way. An update that sets a column to
a fixed value is idempotent. One that increments a counter is not, and a plain
insert retried after a timeout creates a second row. The usual repairs match the
payment case: give each write a unique ID and let a unique constraint reject the
repeat, as with a stock decrement recorded against the order's ID. Or, where the
new value doesn't depend on a read other writers can change, name the end state
("set order 123's status to paid") rather than the change. Setting stock to 7
because you read 8 is not safe: another sale may have landed in between.

Queues bring the same problem to background work. Most deliver a message at least
once, which means a worker can see your order twice, so the worker records which
message IDs it has processed ([Message Queues](/systems-and-infrastructure/message-queues)).
Pairing idempotent handlers with [exponential backoff](/systems-and-infrastructure/exponential-backoff)
gives retries that are both safe and polite.

**Rule of thumb.** Assume any request that can time out will be sent twice, and
give every action that changes something a key the server can recognize, checked
by the database and not by application code alone.

## Where you'll meet this

Payments and checkout is the textbook case: a client-generated key sent with
every attempt lets the server return the first result instead of billing a
shopper twice, which is why payment APIs commonly accept one on charge requests.
In a notification or email pipeline, queues usually deliver at least once, so a
worker that records which messages it has handled can skip a redelivery instead
of sending the email again. Chat works the same way: a client that never sees an
acknowledgment will resend the message, and an ID it generated once lets the
server drop the duplicate.
