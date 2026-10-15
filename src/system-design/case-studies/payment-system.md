---
title: Design a Payment System and Wallet (like PayPal)
summary: A double-entry ledger that never edits an entry, idempotency keys down to the card processor, and a saga for transfers between shards, at 5,800 money movements a second at peak.
date: 2026-10-05
order: 11
template: 3
---

You're asked to design a wallet like PayPal. Alice pays an online store $25 with her card, then sends her friend Bob $10 from her wallet balance. Each is only a few database rows, so the interview is about what goes wrong: an answer from the card company that never arrives, a request that gets retried, a transfer between two databases.

So the question is how to move money so that none is lost or made up, however things fail. The design records every movement as new rows that add up to zero, spreads them over 16 databases, makes each call safe to repeat and moves money between databases in small steps. This page starts with one database and a balance per account, shows where that breaks, follows Alice's $25 through the design that replaces it, sizes its parts, and makes three decisions: how money is recorded, how retries stay safe, and how a transfer crosses databases.

## Requirements

- Pay a merchant by card, top up (add money to a wallet) from a card, pay a merchant from a wallet, transfer wallet to wallet, and refund in full or in part.
- 50 million movements a day: 20 million card payments, 5 million top-ups, 15 million wallet payments and 10 million transfers.
- Every movement's records add up to zero, so none creates or destroys money, and a retried request moves money at most once in our records.
- A confirmed movement survives the loss of a database server.
- Wallet payments and transfers answer in under 300 ms at p99 (99% of requests are faster). Payments are accepted 99.95% of the time; when a database server fails, payments to it are refused, not guessed.

Out of scope: currency conversion, fraud scoring and payouts to banks.

## Start simple

The obvious design is one relational database with an accounts table: a row for each wallet and merchant, holding a balance. Paying is a **transaction**, a group of changes the database applies all together or not at all: subtract 2500 cents from Alice's row, add 2450 to the store's row and add 50, a 2% fee, to the row of our own fee account. A card payment first asks the **processor**, an outside company that connects us to the card networks, to charge the card.

For a small app, that's fine. Say it has 100,000 movements a day, and peak traffic is ten times the average ([numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)):

```text
average:
  100,000 ÷ 86,400 s ≈ 1.2 a second
peak:
  1.2 × 10 = 12 a second
```

One database handles that easily. Now run the same steps on this app's 50 million a day, assuming one database server handles 5,000 transactions a second:

```text
average:
  50,000,000 ÷ 86,400 s ≈ 580 a second
peak:
  580 × 10 = 5,800 a second
one server:
  5,800 ÷ 5,000 = 1.16
at half load, to leave room:
  5,800 ÷ 2,500 ≈ 2.3, so 3 servers
```

That counts one transaction per movement, and the real count is higher, but it already shows one database can't take the load. So split the accounts across several databases, each called a **shard** and holding some of the accounts ([sharding](/systems-and-infrastructure/partitioning-vs-sharding)).

Sharding fixes the load and breaks two things. A transfer from Alice to Bob can now touch two shards, and one transaction can't span both. And the card charge happens outside our databases, in a call that can fail in silence. The architecture has to handle both.

## High-level architecture

![Architecture of the payment system and wallet. The wallet app and merchant checkouts send the card number straight to the external payment processor to get a token, and send payments, transfers and refunds to the payment service. The payment service writes one transaction per shard to the ledger database of 16 shards and calls the processor to authorize, capture and refund; the processor sends webhooks back to the payment service. The ledger shards' outbox rows go to the outbox relay, which publishes them to the event queue; payment workers consume the queue, write second legs and fixes to the ledger shards and make status checks with the processor. The reconciliation job fetches the processor's daily record of charges and reads entries from the ledger shards.](/diagrams/payment-system/architecture.svg)

Follow Alice's $25 to the store. Her checkout page sends the card number straight to the processor and gets back a **token**, a stand-in code for the card, so card numbers never reach our servers. It then sends the payment and the token to the payment service, the servers that receive every payment, transfer and refund.

The service records the payment before calling the processor, then asks it to set the $25 aside and, once that succeeds, to move it. Either call can end in silence, with no way to tell whether the processor acted, and that is the second decision. A transfer between shards is finished later by background **workers**, which take their steps from a queue; the third decision builds that.

The service writes the payment's entries to the **ledger**, the shards from Start simple, when the capture succeeds. Each **entry** adds an amount to one account or subtracts it, and one movement's entries add up to zero, so money moves between accounts and is never invented. Entries are only ever added, never edited. A shard confirms a commit only after a second copy of it, in another data center, has the data ([read replicas](/systems-and-infrastructure/read-replicas)).

Later outcomes reach us as **webhooks**, HTTP requests the processor sends to the payment service, and each can arrive twice. Once a day a **reconciliation** job also compares the processor's own daily record of every charge with our ledger, because neither our calls nor its webhooks are guaranteed to be complete.

That is every part. Now to size them.

## Key numbers

These size the payment service, the ledger shards and the storage they hold. A day is 86,400 seconds, peak is ten times the average, and figures are rounded.

- **Payment service:** about 5,800 movements a second at peak: 50,000,000 ÷ 86,400 ≈ 580 on average, × 10 = 5,800, as in "Start simple".
- **Ledger transactions:** about 22,800 a second at peak. A card payment or top-up takes 3 (record it as authorizing, as authorized, then as captured with its entries) plus 2 for its webhooks, so 5. A wallet payment or transfer takes 1, plus 2 more steps when the two accounts are on different shards. Assume accounts are placed by a hash of `account_id`, which spreads them evenly over the 16 shards. Two accounts then share a shard 1 time in 16, so they differ 15 times in 16, and 1 + 2 × 15/16 = 2.875. Then (20 million + 5 million) × 5 = 125 million and (15 million + 10 million) × 2.875 ≈ 72 million, which is 197 million a day. 197 million ÷ 86,400 ≈ 2,280, and × 10 ≈ 22,800.
- **Shards:** 16, each about 1,425 transactions a second at peak: 22,800 ÷ 16. Assume a shard's main copy handles 5,000 a second, planned at half, 2,500. Then 22,800 ÷ 2,500 ≈ 9.1, and 16 leaves headroom.
- **Storage:** about 71 GB a day. Assume 3.6 entries a movement: 50 million × 3.6 = 180 million entries × 200 bytes = 36 GB. Add 50 million payment rows × 400 bytes = 20 GB, and 50 million webhooks (2 for each of the 25 million card payments and top-ups) × 300 bytes = 15 GB. 36 + 20 + 15 = 71.
- **Fee account:** about 4,000 credits a second at peak. Our fee account collects 2% of every payment to a merchant: (20 million card + 15 million wallet) = 35 million a day ÷ 86,400 ≈ 405, × 10 ≈ 4,000. An update locks its row, so others wait until it commits, and one row manages about 500 updates a second, assuming 2 ms to commit: 1,000 ms ÷ 2 ms = 500.

The last figure drives the first decision.

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

The `Idempotency-Key` header is a label the client picks for each request, so the server can recognize a repeat. An **account** is anything holding a balance: wallets, merchants, our fee account, and the processor's **clearing account** (what it owes us for captures it hasn't paid out). The key column is `source_ref`: every money-moving event has a natural name ("the capture of `p_42`"), and its unique index makes a duplicate webhook or retry fail on insert.

## Decision: a ledger of entries that are never edited

The simpler design is the one from Start simple: a balance column per account, changed in place, with an audit log beside it. It is easy to read, and wallets keep a balance anyway so one update can check funds. It breaks two ways. A bug that adds to one account without subtracting from another creates money, and nothing notices. And the fee account would be updated by every payment to a merchant: 4,000 a second at peak against the 500 a locked row manages, so payments would queue behind it eight times over.

So record the movement, not the result. Each movement is one transaction of entries that sum to zero, and a commit that doesn't sum is refused. Alice's captured $25 writes `processor clearing −2500` (the processor now owes us, so it goes negative), `merchant m_store +2450` and `fees earned +50`. Entries are insert-only (the application's database login can't update them); a mistake or refund is a new transaction pointing back through `reverses_txn_id`.

The fee and clearing accounts exist once per shard, so each payment stays one local transaction, and they keep no cached balance, so they take only inserts and no row is locked. The price is 3.6 rows a movement, 36 GB of the 71 GB a day, and a total such as fees earned is a sum over entries, not one read.

**Rule of thumb.** Record the movement, not the result. Cache a balance only on rows that don't get hot.

## Decision: idempotency keys all the way to the processor

The simpler design calls the processor to **authorize** the card: the bank sets the $25 aside. Then it calls again to **capture** it: the money moves. If no answer comes in time, it calls again. That breaks on silence, because silence doesn't mean the charge failed. Assume 1 card payment in 1,000 hits it:

```text
payments in doubt a day:
  25,000,000 card payments and top-ups ÷ 1,000 = 25,000
```

Each blind retry could charge a card twice, 25,000 times a day. Asking the processor first whether the payment exists is no cure: a request still in flight may not show up yet, so "not found" proves nothing. That lookup is the fallback, which workers use on a call that stays unknown.

So every call gets an **idempotency key**, a label that lets the receiver recognize a repeat ([idempotency](/systems-and-infrastructure/idempotency)). The checkout's key is stored with new payment `p_42` before the processor is called, so a retry gets `p_42` back. Calls to the processor carry keys derived from the payment (`p_42-auth`, `p_42-cap`), so any retry sends the same key, and many processors answer a repeated key with the first result. After about 20 seconds the API answers `202` and workers keep retrying.

![Sequence of one $25.00 card payment, p_42. The checkout sends POST /payments with Idempotency-Key k1 to the payment service, which inserts p_42 in state authorizing with key k1 into the ledger shard, then sends authorize 2500 with key p_42-auth to the processor. No answer comes back within 8 seconds, so the payment service sends the authorize again with the same key, and the processor answers approved, auth_77, the first attempt's result. The payment service records p_42 authorized, sends capture auth_77 with key p_42-cap, and the processor answers captured. The payment service writes one transaction to the ledger shard: p_42 captured plus 3 entries, and answers the checkout 201, captured. Later the processor sends webhook evt_9, capture succeeded; the payment service records evt_9 as new, finds p_42 already captured, writes no entries, and answers the processor 200.](/diagrams/payment-system/card-payment-sequence.svg)

The cost is a stored key for every request, and keys can't prove the processor kept its side. So the daily reconciliation matches each line of its record to a ledger transaction.

**Rule of thumb.** Across a boundary you don't control, make every call safe to repeat, then check their records anyway.

## Decision: a saga for transfers between shards

The simpler design is one transaction across both shards, which databases offer as two-phase commit: a coordinator has both shards prepare, which locks the accounts, then commit together. Most transfers cross shards, 15 in 16, and a cross-shard movement holds its locks across the extra round trip. A coordinator that dies between the phases leaves them held. Count the movements at risk:

```text
cross-shard movements a day:
  25,000,000 × 15/16 ≈ 23,400,000
a second on average:
  23,400,000 ÷ 86,400 ≈ 270
at peak:
  270 × 10 = 2,700 a second
```

At 2,700 a second, even a 10 ms gap between prepare and commit (assumed) leaves 2,700 × 0.01 = 27 movements locked whenever the coordinator fails, and every other payment touching those accounts waits.

So use a **saga**: a chain of small transactions, one per shard, with an undo if a later one fails ([saga pattern](/systems-and-infrastructure/saga-pattern)). Take Alice's $10 to Bob, on shards 3 and 11. Step 1, on shard 3: `wallet alice −1000`, `transit@3 +1000` (a per-shard account holding money in transit) and payment `x_55` marked `debited`; the API answers when that commits.

Something must start step 2. Step 1 also stores an **outbox** row, a note of what is left to do, in the same commit ([outbox pattern](/systems-and-infrastructure/outbox-pattern)), so a crash can't lose it. The outbox relay, a small process, publishes the note to the event queue ([message queues](/systems-and-infrastructure/message-queues)), and a worker takes it. The worker runs step 2 on shard 11 (`transit@11 −1000`, `wallet bob +1000`, unique `source_ref` `x_55:credit`, so a redelivery does nothing), then step 3 marks `x_55` completed. If Bob's account closed meanwhile, a compensating step returns the money.

The saga costs two more transactions per cross-shard movement, and for a moment the money sits in transit, not in Bob's wallet.

**Rule of thumb.** When one write spans databases, split it into local steps that each balance, with an undo, before reaching for a distributed transaction.

## Likely follow-ups

- **What if a shard's main copy fails?** Promote its second copy; nothing confirmed is lost, because each commit waited for it. Payments on that shard get `503` (service unavailable) and are retried.
- **How do refunds and chargebacks work?** A refund first reserves its amount against `refunded_minor` in a **conditional update**, one that applies only if a check still holds, so racing refunds can't exceed the capture ([race conditions](/systems-and-infrastructure/race-conditions)). A chargeback, when the cardholder's bank takes a payment back, takes the money from the merchant, whose balance may go negative.
- **What if the processor is down?** A [circuit breaker](/systems-and-infrastructure/circuit-breaker), which stops calling a failing service for a while, gives card payments a fast `503`; wallet payments don't call the processor.
- **How do you catch a wrong but balanced transaction?** Balanced entries can still be wrong. Reconciliation matches each ledger transaction to the processor's record; nightly checks assert that `transit` nets to zero and cached wallet balances equal the sum of their entries, freezing any that differ.
