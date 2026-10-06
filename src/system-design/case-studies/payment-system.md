---
title: Design a Payment System and Wallet (like PayPal)
summary: A double-entry ledger that never edits a row, idempotency keys down to the card processor, and a saga for transfers between shards, at 5,800 money movements a second at peak.
date: 2026-10-05
order: 11
template: 2
---

You're asked to design a wallet like PayPal. Alice pays an online store $25
with her card, then sends Bob $10 from her balance. Each is a few rows, so the
interview is about what goes wrong: a lost charge answer, a retry
after a timeout, a transfer between two databases.

## Requirements

- Pay a merchant by card, top up from a card, pay from a wallet, transfer
  wallet to wallet, and refund in full or in part.
- 50 million movements a day: 20 million card payments, 5 million top-ups, 15
  million wallet payments and 10 million transfers.
- Money is never created or lost by our system: every movement's records sum to
  zero, and a retried request moves money at most once.
- A confirmed movement survives the loss of a database server.
- Wallet payments and transfers answer in under 300 ms at p99 (99% of requests
  are faster). Payments are accepted 99.95% of the time; in a failover they are refused, not guessed.

Out of scope: currency conversion, fraud scoring and payouts to banks.

## Key numbers

Peak is
ten times average
([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

- **Movements:** about 5,800 a second at peak. 50 million a day ÷ 86,400 ≈ 580
  on average.
- **Database transactions:** about 22,800 a second at peak. A card payment or
  top-up takes three plus two webhooks; a wallet payment or transfer takes one,
  plus two across shards (15 times in 16, accounts spread evenly). That is 197
  million a day.
- **Shards:** 16, each about 1,425 a second at peak. Assume a primary handles
  5,000 a second, planned at half: 22,800 ÷ 2,500 ≈ 9.1, so 16 leaves headroom.
- **Storage:** about 71 GB a day: 182 million ledger entries (3.6 a movement) ×
  200 bytes = 36 GB, plus 50 million payments × 400 bytes and 50 million webhooks × 300 bytes.
- **Hottest row:** one fee account would take about 4,000 credits a second at peak
  (35 million card and wallet payments to merchants a day, each paying a 2% fee). A locked row
  manages about 500 updates a second, assuming 2 ms to commit.

## High-level architecture

![Architecture of the payment system and wallet. The wallet app and merchant checkouts send the card number straight to the external payment processor to get a token, and send payments, transfers and refunds to the payment service, which runs behind a load balancer. The payment service writes one transaction per shard to the ledger database of 16 shards and calls the processor to authorize, capture and refund; the processor sends webhooks back to the payment service. The ledger shards' outbox rows go to the outbox relay, which publishes them to the event queue; payment workers consume the queue, write second legs and fixes to the ledger shards and make status checks with the processor. The reconciliation job fetches the processor's settlement file and reads entries from the ledger shards.](/diagrams/payment-system/architecture.svg)

Follow Alice's $25. Her checkout sends the card number straight to the
**processor**, an outside company connecting us to the card networks, and gets a
**token** back, so card numbers never reach our servers. The payment service
takes the token, asks the processor to authorize (the bank holds the funds),
then capture, and writes the **ledger database**: 16 relational shards split
by account ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)), each primary
confirming a commit only after a replica in another zone has it. Later outcomes
arrive as **webhooks**, HTTP requests to us. Outbox rows, committed with the
payment ([outbox pattern](/systems-and-infrastructure/outbox-pattern)), reach
the event queue through the outbox relay for payment workers, which finish
transfers and resolve unknown outcomes.

## API and data model

```http
POST /v1/payments    Idempotency-Key: 5f0c2d1e   { "amount_minor": 2500, "currency": "USD", "payee": "merchant:m_store", "source": { "type": "card", "card_token": "tok_9Hq2" } }
-> 201 with the payment; 402 declined; 202 pending, outcome unknown; 409 key reused with a different body
POST /v1/transfers   Idempotency-Key: 8a1b77c0   { "to": "wallet:bob:USD", "amount_minor": 1000, "currency": "USD" }
POST /v1/payments/{id}/refunds   Idempotency-Key: 3c9e41d2   { "amount_minor": 1000 }
```

```text
accounts             account_id "wallet:alice:USD", kind, balance_minor (cached, wallets only), allow_negative
ledger_transactions  txn_id, source_ref (unique, "p_42:capture"), reverses_txn_id (nullable)
entries              txn_id, account_id, amount_minor (signed integer cents), created_at
payments             payment_id, payer, payee, state, refunded_minor (total refunded so far)
idempotency_keys     (caller_id, key) primary key, request_hash, target_id (the payment it created)
webhook_events       event_id (unique), payment_id, received_at
```

An **account** is anything holding a balance: wallets, merchants, our fee
account, and the processor's **clearing account** (what it owes us for captures
it hasn't paid out). The key column is `source_ref`: every
money-moving event has a natural name ("the capture of `p_42`"), and its unique
index makes a duplicate webhook or retry fail on insert.

## Decision: a ledger of entries that are never edited

Each movement is one transaction of **entries**, each changing one account, that
sum to zero. Alice's captured $25 writes `processor clearing −2500`,
`merchant m_store +2450` and `fees earned +50`. Entries are insert-only (the
application's database login can't update them); a mistake or refund is a new
transaction pointing back through `reverses_txn_id`.

Why not a balance column per account, with an audit log? It's simpler, and wallets keep one anyway to check funds in one update. But
a bug that adds without subtracting creates money silently; here a commit
refuses a transaction that doesn't sum to zero. The price is 3.6 rows a
movement. Fee and processor-clearing accounts exist once per shard, so each payment is one local transaction, and keep no cached balance, so they only take inserts and no row is locked. One shared balance row would queue 4,000 credits a second.

**Rule of thumb.** Record the movement, not the result. Cache a balance only on
rows that don't get hot.

## Decision: idempotency keys all the way to the processor

A processor call can end in silence, and her card may or may not hold a charge. The checkout's
`Idempotency-Key` is stored with new payment `p_42` before the processor is
called, so a retry gets `p_42` back. Processor
calls carry keys derived from the payment (`p_42-auth`, `p_42-cap`), so any
retry sends the same key, and many processors answer a repeated key with the
first result ([idempotency](/systems-and-infrastructure/idempotency)). After
about 20 seconds the API answers `202` and workers keep retrying.

![Sequence of one $25.00 card payment, p_42. The checkout sends POST /payments with Idempotency-Key k1 to the payment service, which inserts p_42 in state authorizing with key k1 into the ledger shard, then sends authorize 2500 with key p_42-auth to the processor. No answer comes back within 8 seconds, so the payment service sends the authorize again with the same key, and the processor answers approved, auth_77, the first attempt's result. The payment service records p_42 authorized, sends capture auth_77 with key p_42-cap, and the processor answers captured. The payment service writes one transaction to the ledger shard: p_42 captured plus 3 entries, and answers the checkout 201, captured. Later the processor sends webhook evt_9, capture succeeded; the payment service records evt_9 as new, finds p_42 already captured, writes no entries, and answers the processor 200.](/diagrams/payment-system/card-payment-sequence.svg)

Why not ask the processor whether the payment exists, then decide? A request
still in flight may not show up yet, so "not found" proves nothing; lookup is
the fallback. Keys can't prove the processor kept its side, so daily
**reconciliation** matches each line of its settlement file to a ledger
transaction.

**Rule of thumb.** Across a boundary you don't control, make every call safe to
repeat, then check their records anyway.

## Decision: a saga for transfers between shards

Alice's $10 to Bob spans two shards 15 times in 16, 3 and 11.
Step 1, on shard 3: `wallet alice −1000`, `transit@3 +1000` (a per-shard
account holding money in transit), payment `x_55` marked `debited`, and an
outbox row; the API answers when that commits. A worker runs step 2 on shard 11
(`transit@11 −1000`, `wallet bob +1000`, unique `source_ref` `x_55:credit`, so a
redelivery does nothing), then step 3 marks `x_55` completed. If Bob's account
closed meanwhile, a compensating step returns the money
([saga pattern](/systems-and-infrastructure/saga-pattern)).

Why not two-phase commit, where a coordinator has both shards prepare, then commit together? Shards hold locks across the extra round trip, and a coordinator that dies
between phases leaves them held. At about 2,700 cross-shard movements a second
at peak (25 million × 15/16 ÷ 86,400 × 10), so many locks to strand. The
saga costs two more transactions each, and money sits in transit.

**Rule of thumb.** When one write spans databases, split it into local steps
that each balance, with an undo, before reaching for a distributed transaction.

## Likely follow-ups

- **What if a shard's primary fails?** Promote its replica; nothing confirmed is lost. Payments on it get `503` and retry.
- **How do refunds and chargebacks work?** A refund
  first reserves its amount against `refunded_minor` in one conditional update,
  so racing refunds can't exceed the capture. A chargeback takes the money from
  the merchant, whose balance may go negative.
- **What if the processor is down?** A
  [circuit breaker](/systems-and-infrastructure/circuit-breaker) gives card
  payments a fast `503`; wallet payments never call the processor.
- **How do you catch a wrong but balanced transaction?** Balanced entries can still be wrong. Reconciliation matches each ledger transaction to the processor's settlement file; nightly checks assert that `transit` nets to zero and cached wallet balances equal their entries, freezing any that differ.
