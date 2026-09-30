---
title: Design a Payment System and Wallet (like PayPal)
summary: Moving money between wallets, merchants and card networks with a double-entry ledger that never edits a row, idempotency keys from the app to the processor, and a daily reconciliation that catches what the rest missed.
date: 2026-09-28
order: 11
---

A digital wallet holds a balance for each user and lets them pay with it. Alice
tops up her wallet with $50 from her debit card, pays a coffee shop $4.50 from
the balance, sends Bob $10 for her share of last night's dinner, and pays an
online store $25 with her card directly because the store is linked to the same
service. Merchants, the businesses that accept payments, see the money arrive
in their own balance and withdraw it to their bank.

Money has to be accounted for exactly, and the most dangerous failures are
the ones whose outcome is unknown, such as a card charge whose answer was lost
on the network. The design rests on three defenses: a ledger where every
movement is recorded on both sides and never edited, idempotency keys that
make every retry safe, and a daily reconciliation against the money that
actually moved. It is one plausible design for a service like PayPal, not a
description of how any particular company built theirs.

## At a glance

**Requirements.**

- Card payments, top-ups, wallet payments, transfers, refunds and
  chargebacks, with a balance and history for every account.
- 50 million money movements a day for 100 million users and 2 million
  merchants.
- Money is never created or lost: every movement's records sum to zero, and a
  retried request moves money at most once.
- A confirmed movement survives the loss of a database server.
- Wallet payments, transfers and our share of a card payment under 300 ms at
  p99.
- 99.95% availability, refusing payments during a failover rather than
  accepting them on a guess.

**Key numbers.** From the [estimates](#back-of-the-envelope-estimates):

- About 5,800 movements a second at peak (50,000,000 ÷ 86,400 ≈ 580, times
  ten).
- About 22,800 database transactions a second at peak (197 million a day ÷
  86,400 ≈ 2,280, times ten).
- 16 shards at about 1,425 transactions a second each at peak (22,800 ÷ 16,
  against a planning ceiling of 2,500).
- About 182 million ledger entries a day (60M card + 10M top-up + 73.1M
  wallet-payment + 38.8M transfer entries), about 3.6 per movement.
- About 71 GB a day (36 GB of entries + 20 GB of payment records + 15 GB of
  webhook events), about 26 TB a year (71 GB × 365).

**Key decisions.**

- A double-entry ledger whose entries are never edited: every transaction sums
  to zero, or the commit refuses it
  ([the ledger](#deep-dive-the-ledger-and-its-balances)).
- Idempotency keys from the caller down to the processor: a retry after a
  timeout gets the first result instead of a second charge
  ([the processor](#deep-dive-paying-through-a-processor-you-don-t-control)).
- Cross-shard transfers as a saga through clearing accounts, not two-phase
  commit: every transaction stays on one shard, and no lock is held across a
  network call ([sharding](#deep-dive-sharding-the-ledger-and-moving-money-between-shards)).

**Likely follow-ups.**

- What if a card authorization times out? Retries reuse the same key, and after
  about 20 seconds the API answers `202` and workers resolve it
  ([the processor](#deep-dive-paying-through-a-processor-you-don-t-control)).
- How would you catch the processor charging twice? The daily reconciliation
  matches every settlement-file line to a ledger transaction
  ([reconciliation](#deep-dive-paying-through-a-processor-you-don-t-control)).
- Why not cache every account's balance? A cached balance row is locked until
  commit, about 250 updates a second, too few for the fee and merchant
  accounts ([the ledger](#deep-dive-the-ledger-and-its-balances)).
- What if a shard's primary fails? Its synchronous replica is promoted within
  about a minute with nothing confirmed lost
  ([failure modes](#failure-modes-and-bottlenecks)).

The components are in
[High-level architecture](#high-level-architecture).

## Requirements

Functional requirements:

- **Pay a merchant by card**, the money landing in the merchant's balance
  minus our fee.
- **Top up a wallet** from a card: a card payment to the user's own wallet.
- **Pay from the wallet**, and **transfer** wallet to wallet between people.
- **Refunds**, full or partial, back to the card or wallet the money came from.
- **Chargebacks**: when a cardholder disputes a charge with their bank, the
  money is taken back from us and recorded against the merchant.
- **Balances and history** for every user and merchant.
- **Payouts (optional)** of a balance to a bank account.

Out of scope: currency conversion (each wallet holds one currency), fraud
scoring (a risk check before authorizing fits the payment service's path
without changing the architecture), identity checks, merchant onboarding,
dispute paperwork, and the store's own checkout.

Non-functional requirements:

- **Scale:** 100 million users with wallets, 2 million merchants, and **50
  million money movements a day**: 20 million card payments at checkouts, 5
  million top-ups, 15 million wallet payments to merchants and 10 million
  person-to-person transfers. Refunds and chargebacks are under 1% of that and
  don't move the estimates.
- **Correctness:** money is never created or lost by the system. Every
  movement's records balance to zero, a request retried any number of times
  moves money at most once, and every movement through the card processor is
  matched against the processor's own records in the first daily
  reconciliation after it settles.
- **Durability:** a movement the system has confirmed is never lost, even if a
  database server is destroyed the moment after.
- **Latency:** a wallet payment or transfer answers in under 300 ms at the
  99th percentile (p99, the time 99% of requests beat). A card payment is
  dominated by the card network's round trip, usually a second or two; our
  share of it stays under 300 ms at p99.
- **Availability:** 99.95% for accepting payments, about 21.6 minutes of
  downtime in a 30-day month (0.05% of 43,200 minutes), looser on purpose:
  while the database holding an account fails over, payments touching it are
  refused rather than accepted on a guess. A refused payment can be retried; a
  wrong balance has to be found and unwound.
- **Retention:** financial records kept for seven years (an assumption; the
  real period depends on the jurisdictions the service operates in).

## Back-of-the-envelope estimates

A day is 86,400 seconds, and payments are spiky (a holiday sale, a payday), so
size for a peak of ten times the average, a rule of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know).

**Money movements.**

- Average: 50,000,000 ÷ 86,400 ≈ **580 movements a second**.
- Peak: **about 5,800 a second**.

**Calls to the card processor.** The 25 million card payments and top-ups each
need an authorization and a capture, 50 million calls a day (580 a second, 5,800
at peak), and bring back about two webhook events each, another 50 million.

**Database transactions.** A transaction is a group of writes applied all
together or not at all. The ledger is split across 16 databases, called
**shards**, each holding a slice of the accounts; a transfer across two shards
takes three transactions instead of one. Per day:

- Card payments and top-ups: three each (record the attempt, the
  authorization, and the capture with its ledger entries), 25,000,000 × 3 = 75
  million.
- Webhook events: one small transaction each, 50 million.
- Wallet payments and transfers: one each, plus two more (credit the payee,
  then mark the payment completed) when the accounts sit on different shards,
  15 times in 16: 25,000,000 + 2 × 25,000,000 × 15 ÷ 16 = 25 million + 46.9
  million = 71.9 million.
- Total: about 197 million a day, so **about 2,280 a second on average and
  22,800 at peak**.

**How many shards.** Assume one database **primary** (the server taking all
writes for its shard), waiting for a second copy to confirm each commit,
handles about 5,000 small transactions a second; plan at half, 2,500:

- 22,800 ÷ 2,500 ≈ 9.1, so 10 shards needed at today's peak.
- The design uses **16**, so each shard sees about 1,425 transactions a second
  at peak (22,800 ÷ 16), with room for about 75% more (2,500 ÷ 1,425 ≈ 1.75)
  before splitting again.

**Ledger entries.** A card payment writes three entries (the processor's
account, the merchant and our fee), a top-up two, a wallet payment three and a
transfer two, and a transfer that crosses shards adds two more for the hop:

- Card payments: 20,000,000 × 3 = 60 million.
- Top-ups: 5,000,000 × 2 = 10 million.
- Wallet payments: 15,000,000 × (3 + 2 × 15 ÷ 16) ≈ 73.1 million.
- Transfers: 10,000,000 × (2 + 2 × 15 ÷ 16) ≈ 38.8 million.
- Total: about **182 million entries a day**.

**Storage.** Allowing 200 bytes per entry with its indexes, 400 bytes per
payment record and 300 per stored webhook event:

- Entries: 182,000,000 × 200 bytes ≈ 36 GB a day.
- Payment records: 50,000,000 × 400 bytes = 20 GB a day.
- Webhook events: 50,000,000 × 300 bytes = 15 GB a day.
- Total: about **71 GB a day, 26 TB a year**, before copies.

Keeping 13 months in the live databases (enough to match late disputes) is
about 71 GB × 395 days ≈ 28 TB, or **about 1.8 TB per shard**. Older records
move to cheaper archive storage; seven years of everything is about 180 TB.

**Reconciliation.** The processor's daily settlement file has a line per item,
about 25 million lines; at around 200 bytes each, **5 GB a day** to match.

The request rate and storage are unremarkable; the effort belongs to making
each of 197 million daily transactions record money exactly once, and finding
out quickly when the outside world disagrees.

## Data model

**Money as integers.** Every amount is an integer count of the currency's
**minor unit**: cents for US dollars, so $25.00 is `2500`, always with its
currency code, since ISO 4217 gives the yen no decimals and the Kuwaiti dinar
three. Floating point stores most decimal fractions approximately (in
JavaScript `0.1 + 0.2` is `0.30000000000000004`), and the errors add up. JSON
parsers that read numbers as 64-bit floats are exact only up to 2⁵³, about 90
trillion dollars in cents, far beyond any payment. Our 2% fee on $19.99 is
39.98 cents, rounded half up to 40, and the merchant gets 1,999 − 40 = 1,959,
so the parts add up to what was paid.

**The ledger.** A **ledger** is the record of every change to every balance.
With **double-entry bookkeeping**, every movement is one **ledger
transaction** of two or more **entries**, each changing one account, summing
to zero. An **account** is anything that holds a balance: **customer
accounts** (a wallet per user per currency, a balance per merchant),
**external accounts** (chiefly the processor's **clearing account**, what it
owes us for captures it hasn't paid out, and our bank account) and **company
accounts** (fees earned and paid, unrecovered losses). A balance is what the
company owes the owner: Alice's wallet at +5,000 means we hold $50 for her,
and clearing at −2,500 means the processor owes us $25. (Accountants'
**debit** and **credit** labels are the same thing folded into the sign.)

Alice's $25.00 card payment to an online store, once captured, is one ledger
transaction with three entries:

```text
ledger transaction t_901  "capture of payment p_42"
  processor clearing       −2500   the processor now owes us $25
  merchant m_store         +2450   we owe the store $24.50
  company fees earned        +50   our 2% fee
                          ------
                               0
```

Alice's $10 to Bob is `wallet alice −1000, wallet bob +1000`. A settlement
raises clearing by the gross, lowers our bank account by the net and
"processor fees paid" by the difference. A payout `po_3` is two transactions:
`merchant −X, payout clearing +X` under `source_ref` `po_3` when we commit to
sending it, and `payout clearing −X, our bank +X` under `po_3:confirm` when the
bank confirms it.

The tables, in a relational database:

```text
accounts
  account_id      string, primary key    "wallet:alice:USD"
  kind            enum                   wallet, merchant, clearing, company
  currency        char(3)                "USD"
  balance_minor   bigint                 cached; see the ledger deep dive
  version         bigint                 bumped on every cached-balance change
  allow_negative  boolean                false for wallets
  status          enum                   active, frozen, closed

ledger_transactions
  txn_id          uuid, primary key
  type            enum                   capture, transfer, refund, chargeback, settlement, payout, adjustment, rejected, ...
  source_ref      string, unique         "p_42:capture"; one transaction per event, ever
  reverses_txn_id uuid, nullable         set on a correction
  created_at      timestamp

entries
  entry_id        bigint, primary key
  txn_id          uuid                   the ledger transaction it belongs to
  account_id      string                 indexed with created_at, for history
  amount_minor    bigint                 signed
  currency        char(3)
  created_at      timestamp

payments
  payment_id      string, primary key    "p_42"
  payer, payee    string                 account IDs
  amount_minor, currency
  method          enum                   card, wallet
  card_token      string, nullable       the processor's token, never a card number
  processor_ref   string, nullable       the processor's ID for this payment
  state           enum                   see below
  refunded_minor  bigint                 total refunded or reserved for a pending refund
  version         bigint

refunds
  refund_id       string, primary key    "r_7"; on the payment's shard
  payment_id      string
  amount_minor    bigint
  state           enum                   pending, succeeded, failed

payouts
  payout_id       string, primary key    "po_3"; on the merchant's shard
  account_id      string                 the balance paid out
  amount_minor    bigint
  state           enum                   sending, sent, failed

idempotency_keys
  caller_id, key  primary key together
  request_hash    string                 detects a key reused for a different request
  target_id       string                 the payment or refund this key created; a retry gets it back
  created_at      timestamp              deleted after 7 days

processor_events
  event_id        string, primary key    the processor's own event ID
  payment_id      string
  received_at     timestamp

outbox
  id, topic, payload, created_at         events to publish after commit
```

**Entries are never updated or deleted.** A mistake is corrected by a new
transaction pointing back through `reverses_txn_id`, and the application's
database login has only `INSERT` and `SELECT` on the ledger tables, so any
past balance can be rebuilt by summing entries to that moment.

`source_ref` is the ledger's own idempotency guard: every money-moving event
has a natural name ("the capture of `p_42`", "refund `r_7`"), and its unique
index makes a second attempt from a retry, a duplicate webhook or a recovery
job fail on insert.

**Payment states.** Transfers and wallet payments are `payments` rows with
`method` = `wallet`. A card payment moves `authorizing` → `authorized` →
`captured`, or ends in a final `declined`, `failed` or `voided`, and may later
become `partially_refunded`, `refunded` or `charged_back`, each adding ledger
transactions. A wallet payment is `debited` once the payer's side commits and
`completed` once the payee's has (in one transaction on a single shard), or
`returned` if the payee's side refused it. Every state change is a conditional
update that bumps `version` only `WHERE state = 'authorized' AND version = 7`
(say), so a stale worker finds zero rows updated and stops.

**Why a relational database.** Transfers change several rows all or nothing,
balance checks need the latest commit, and auditors ask ad hoc questions, so
[SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) comes out
relational; one server's ceiling is why the ledger is sharded.

## API design

Merchants' servers and our own wallet app call the API. Every call that moves
money requires an `Idempotency-Key` header, a unique string the caller
generates once per intent (a UUID created when the customer pressed "Pay"); a
retry with the same key gets back the payment the first attempt created, in
whatever state it has reached, as
[idempotency](/systems-and-infrastructure/idempotency) explains.

**Create a payment**

```http
POST /v1/payments
Authorization: Bearer <merchant-api-key>
Idempotency-Key: 5f0c2d1e-checkout-8812
Content-Type: application/json

{
  "amount_minor": 2500,
  "currency": "USD",
  "payee": "merchant:m_store",
  "source": { "type": "card", "card_token": "tok_9Hq2..." },
  "capture": true
}
```

`source` is either a card token or `{ "type": "wallet" }`. `capture: false`
authorizes only, for a merchant that captures when it ships, with
`POST /v1/payments/{id}/capture` later. Responses:

- `201 Created` with the payment and its state: `captured` or `authorized` for
  a card, `completed` or `debited` (on its way to the payee) for a wallet.
- `402 Payment Required` when the card is declined or the balance is too low.
- `202 Accepted` with state `pending` when the outcome at the processor is not
  yet known; the caller learns the result by webhook or by
  `GET /v1/payments/{id}`.
- `409 Conflict` when the idempotency key was already used with a different
  request body.
- `429 Too Many Requests` over the caller's rate limit, applied as in
  [the rate limiter case study](/system-design/rate-limiter).

**Card numbers never reach our servers.** The processor's own client-side
component sends the card number straight to the processor and returns a
**token**, an opaque string like `tok_9Hq2...` that only the processor can
use. That keeps most of our systems out of scope of PCI DSS, the card
industry's audited security standard for anything that handles card numbers.

**Other endpoints**

```http
POST /v1/transfers                      { "to": "wallet:bob:USD", "amount_minor": 1000, "currency": "USD" }
POST /v1/payments/{id}/refunds          { "amount_minor": 1000 }   (partial refund; omit for full)
GET  /v1/accounts/{id}/balance
GET  /v1/accounts/{id}/entries?cursor=...
POST /v1/processor-webhooks             (called by the processor, not by clients)
```

A refund answers `422 Unprocessable Entity` if it would take the total refunded
past the captured amount. History is paged with a cursor, an opaque marker for
"after this entry". Merchants hear about their payments through our own
webhooks, sent the way
[the notification system](/system-design/notification-system) sends anything
that must arrive.

## High-level architecture

![Architecture of the payment system and wallet. The wallet app and merchant checkouts send the card number straight to the external payment processor to get a token, and send payments, transfers and refunds to the payment service, which runs behind a load balancer. The payment service writes one transaction per shard to the ledger database of 16 shards and calls the processor to authorize, capture and refund; the processor sends webhooks back to the payment service. The ledger shards' outbox rows go to the outbox relay, which publishes them to the event queue; payment workers consume the queue, write second legs and fixes to the ledger shards and make status checks with the processor. The reconciliation job fetches the processor's settlement file and reads entries from the ledger shards.](/diagrams/payment-system/architecture.svg)

The pieces:

- The **payment service**, stateless servers behind a load balancer, checks
  the caller, applies the idempotency key, talks to the processor, receives
  its webhooks, and writes to the ledger through an in-process module, so a
  payment's state change and its entries share one database transaction.
- The **ledger database** is 16 relational shards. Each owns a slice of the
  accounts with everything that changes alongside them: entries, the payments,
  refunds, payouts and idempotency keys of requests starting there, and the
  outbox. Each primary has a **synchronous replica** in another zone and
  confirms a commit only once the replica has it, so losing the primary loses
  nothing confirmed.
- The **payment processor** is an outside company connecting us to the card
  networks (Visa, Mastercard and the like) and the banks that issue cards. We
  don't control it: its latency varies, it has outages, and it reports some
  outcomes later by **webhook**, an HTTP request to an endpoint of ours.
- The **outbox relay**, **event queue** and **payment workers** carry work
  that follows a commit: cross-shard second legs, unknown outcomes, and
  notifications.
- The **reconciliation job** compares the processor's daily settlement file
  with the ledger.

**Card payments have three stages.** At **authorization** the card's issuing
bank approves the amount and places a **hold** on the funds; no money moves.
At **capture** we take the authorized amount, days later for a shop that
ships, at once for a top-up (an uncaptured authorization expires). At
**settlement**, usually one to a few days later, the processor pays us the
day's captures minus its fees in one bank transfer, with a file listing what it
covers. The ledger records a card payment at capture against the clearing
account, which settlement empties into our bank account; an authorization is
only state on the payment record.

**A wallet payment from Alice to a store** on one shard is one transaction:
insert the idempotency key row naming the new payment (an existing key returns
its payment, and a concurrent duplicate waits on the unique index, then finds
it); subtract from Alice's cached balance only if it stays at or above zero,
else roll back with `402`; insert the ledger transaction with its three
entries, the `completed` payment and an outbox row; commit; answer `201`.

A crash before the commit leaves nothing, and the retry starts cleanly; a
crash after it leaves the payment done, and the retry gets it back.
[The outbox pattern](/systems-and-infrastructure/outbox-pattern) makes "the
payment happened" and "the event will be published" one write, delivered at
least once, so consumers deduplicate on the payment ID. Across shards the
payment is three transactions, the subject of the last deep dive.

## Deep dive: the ledger and its balances

**Why double entry.** A **balance column** per account, updated `- 1000` here
and `+ 1000` there, is fast and forgets: a bug that adds without subtracting
creates money silently, and a disputed balance can't be explained. A
**single-entry log**, one "A to B, 1,000" row per payment, records history but
breaks once a movement has more than two sides, as a card payment does
(processor, merchant, fee). **Double entry** costs more rows, about 182
million entries a day against 50 million movements, roughly 3.6 each, and
gives every movement one shape with an invariant cheap to check constantly:
every transaction, and so the whole ledger, sums to zero. The ledger module
refuses an unbalanced transaction, and a deferred constraint trigger (in
PostgreSQL) checks again at commit against code that goes around the module.

**Refunds and chargebacks are new entries.** When the store refunds Alice's
$25 card payment, `t_901` is untouched and a new transaction is posted:

```text
ledger transaction t_977  "refund r_7 of payment p_42"
  merchant m_store         −2500   the store gives back the full $25
  processor clearing       +2500   the processor will take $25 from our next settlement
```

The store bears our 2% fee. Before the processor hears of the refund, one
transaction on the payment's shard records the idempotency key, a `refunds`
row `r_7` in state `pending`, and a reservation that raises `refunded_minor`
by 2,500 only if it stays within `amount_minor` (zero rows updated means
`422`, and racing partial refunds take turns on the row). The refund goes to
the processor with `r_7` as its key, and its entries post on confirmation
under `source_ref` `r_7`, once however many paths confirm it; a definite
failure marks `r_7` `failed` and releases the reservation. An unknown outcome
leaves `r_7` pending until the workers resolve it the way they resolve a card
payment's: look it up by `r_7`, or retry with the same key.

A chargeback, started by the processor's webhook, takes the payment plus the
chargeback fee from the merchant's balance, possibly below zero
(`allow_negative`), and adds it to clearing.

**Where balances come from.** A balance is the sum of an account's entries.
**Deriving it on read** is always right but grows with history (millions of
entries for a large merchant) unless a daily **snapshot** plus the entries
since bounds the work. **Caching it on the
account row**, updated in the transaction that inserts the entries, makes a
read one row and folds a debit's balance check into the update:

```sql
UPDATE accounts
SET balance_minor = balance_minor - 2000, version = version + 1
WHERE account_id = 'wallet:alice:USD'
  AND balance_minor >= 2000
  AND status = 'active';
```

Zero rows changed means no money (or a frozen account), and the transaction
rolls back. The row stays locked until commit, so Alice's second simultaneous
payment sees the balance the first left, with no lost update
([race conditions](/systems-and-infrastructure/race-conditions),
[optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)).

The cost of caching is **hot accounts**. The lock lasts until commit,
including the wait for the synchronous replica: at, say, 4 ms per transaction,
one row takes about 250 updates a second, however big the server. A wallet
never sees that, but every card and wallet payment to a merchant credits our
fee account: 35 million a day, about 4,000 a second at peak
(35,000,000 ÷ 86,400 × 10 ≈ 4,050). Even one fee account per shard would see
about 250 a second (4,050 ÷ 16), right at the ceiling, and a large merchant in
a sale can see a few hundred a second on its own row.

**The choice** is both, split by account kind. User wallets, checked before
every debit, keep a cached balance. Merchant balances and the fee and clearing
accounts, credited on the hot path or allowed to go negative, keep none: their
payments only insert entries, which never contend, and their rarely read
balance comes from the daily snapshot plus the day's entries. Fee and clearing
accounts exist once per shard, so no row is shared across shards.

**Checking the cache.** A nightly job recomputes every wallet that changed
that day from its last verified snapshot plus the day's entries; a mismatch
with `balance_minor` freezes the account and pages someone. It also checks
that each shard's entries sum to zero and that inter-shard clearing sums
across the 16 to exactly the transfers in flight.

## Deep dive: paying through a processor you don't control

A call to the processor can come back approved, declined, or not at all. In
the last case the request may have been lost on the way there or the approval
on the way back; from our side the two look identical, while a real card may
or may not have a hold on it. Three ways to handle this **unknown outcome**:

**Treat it as a failure.** If the first attempt went through, the customer has
a hold for a payment we have no record of, and pays twice when they try again.

**Ask the processor, then decide.** Processors generally let you look a
payment up by a reference you attached, but a request still in flight there
may not show up yet, so "not found" proves nothing.

**Retry with the same idempotency key.** Many processors accept a
caller-chosen key and, seeing it again, return the first request's result. A
retry of a lost request runs it for the first time; a retry of a lost answer
gets that answer. Neither doubles the charge.

**The choice** is the third, with the second as a fallback, and the keys chain
end to end. The caller's `Idempotency-Key` (`k1`) is recorded with the new
payment `p_42` in state `authorizing` in one transaction **before** the
processor is called, so `p_42` is the one payment for that intent. Processor
calls use keys derived from the payment, not the attempt (`p_42-auth`,
`p_42-cap`), so every retry by any server or worker sends the same key. And
the capture posts under the unique `source_ref` `p_42:capture`, once however
many paths report it.

![Sequence of one $25.00 card payment, p_42. The checkout sends POST /payments with Idempotency-Key k1 to the payment service, which inserts p_42 in state authorizing with key k1 into the ledger shard, then sends authorize 2500 with key p_42-auth to the processor. No answer comes back within 8 seconds, so the payment service sends the authorize again with the same key, and the processor answers approved, auth_77, the first attempt's result. The payment service records p_42 authorized, sends capture auth_77 with key p_42-cap, and the processor answers captured. The payment service writes one transaction to the ledger shard: p_42 captured plus 3 entries, and answers the checkout 201, captured. Later the processor sends webhook evt_9, capture succeeded; the payment service records evt_9 as new, finds p_42 already captured, writes no entries, and answers the processor 200.](/diagrams/payment-system/card-payment-sequence.svg)

Retries use [exponential backoff](/systems-and-infrastructure/exponential-backoff)
with jitter. Each call has an 8-second timeout, and an API call about 20
seconds in total.
Without a definite answer by then, the payment stays in `authorizing` (or
`authorized`, if the capture timed out), the API answers `202` with state
`pending`, and an outbox row asks the workers to resolve it: look it up by our
ID, then retry with the same key for up to about an hour before a
[dead-letter queue](/systems-and-infrastructure/dead-letter-queue) hands it to
a person. The same workers capture or void any authorization left hanging, so
no customer keeps a hold for nothing. At one timeout in a thousand calls,
that's 50,000 calls a day through this path, almost all resolved by the first
retry.

**Crashes** come out the same way, because every step is either one database
transaction or repeatable with the same key: before the `authorizing` row
commits nothing happened, and after it `p_42` waits in a non-final state for
the caller's retry with `k1` or a worker sweeping for payments stuck over a
minute. Two workers on one stuck payment need no
[distributed lock](/systems-and-infrastructure/distributed-locks): both send
the same processor key, and the conditional update on `state` and `version`
lets only one move it.

**Webhooks** arrive at least once, possibly out of order. The handler checks
the signature (computed over the body with a shared secret), then in one
transaction inserts the event into `processor_events`, keyed by the
processor's event ID so a duplicate fails on insert and is answered `200` with
nothing done, moves the payment's state
only forward, and posts entries only under the event's `source_ref`. It
answers `200` after the commit, so a crash in between just means a resend.

**What this does not guarantee.** Inside our database the effect is exactly
once: one payment per key, one ledger transaction per `source_ref`. Across the
boundary we make at-least-once calls and rely on the processor's keys; if the
processor or a card network double-processes something, no key of ours
prevents it.

**Reconciliation is the backstop.** The processor's daily **settlement file**
has one line per item it paid out, with its reference, our payment ID (sent as
metadata on every call), gross, fee and net. A job compares totals, including
the net against our bank deposit, then matches every line to a ledger
transaction, read from each shard's
[read replica](/systems-and-infrastructure/read-replicas) hours after the day
closes, since totals alone can't say which of 25 million payments is wrong.
Each mismatch is a **break**. One in the ledger but
not the file is usually timing (captured at 23:59:58, in the next batch) and is
rechecked in the next two files before anyone acts. If it is still missing,
the processor is asked, and if the capture never happened a reversing
transaction takes the merchant's credit back. One in the file but not
the ledger means an unknown outcome was resolved wrongly: the fix posts the
capture under the `source_ref` it would have had (`p_42:capture`), so a late
webhook can't post it again, and a second line for a payment recorded once is
a double charge, refunded to the customer. A fee that differs from the contract is posted to the "processor fees
paid" account with a note, and a pattern of them is escalated. Every fix is a new `adjustment`
transaction naming the break and who approved it.

Payouts draw only on the part of a merchant balance whose captures have been
matched, so we never send money we may not have received. With no cached row
to check, a payout first locks the merchant's `accounts` row
(`SELECT ... FOR UPDATE`, which payments never take), so one merchant's
payouts run one at a time (two concurrent payouts could otherwise each take
the whole available balance); holding it, the payout computes the matched,
available amount and commits the first payout transaction with the
`payouts` row `po_3` and an outbox row. A worker asks the bank to send it with
`po_3` as the idempotency key, and the confirmation posts `po_3:confirm`.

## Deep dive: sharding the ledger and moving money between shards

One primary can't take 22,800 transactions a second, so the ledger is split
into 16 shards
([partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding))
**by account**, since every balance check and history query is about one
account. The account ID's hash picks its shard, and a small
**account-to-shard directory**, cached on every payment server, overrides it
for accounts placed deliberately, such as a merchant moved to its own shard.
Payments and idempotency keys live with the account the request starts from
(the payer's wallet, or the merchant's balance for a card payment), so every
request's first transaction is local. Fee, clearing, bank and processor-fee
accounts exist on every shard, and settlement posts one transaction per shard,
so a card payment is one local transaction on the merchant's shard.

A wallet payment or transfer touches two customer accounts, on different
shards 15 times in 16. Three options:

**Two-phase commit.** A coordinator asks both shards to prepare, holding
locks, then tells both to commit. The transfer is atomic, but locks, Alice's
wallet row included, span an extra round trip, and if the coordinator dies
between phases they stay held until it recovers. At about 2,700 cross-shard
transfers a second at peak (23.4 million a day ÷ 86,400 seconds × 10) that is
a large operational commitment.

**A distributed SQL database** runs cross-shard transactions internally,
keeping one database's programming model at the cost of latency on every
cross-shard commit and a more complex system for the workload that most needs
to be boring.

**Two local transactions and a clearing account (a saga).** Each step balances
within its own shard, with money passing through an inter-shard clearing
account that exists on every shard. Alice (on shard 3) sends Bob (on shard 11)
$10:

```text
step 1, on shard 3, one transaction
  wallet alice                  −1000
  inter-shard clearing @3       +1000   in transit to shard 11
  + payment row x_55 (a transfer), state debited
  + outbox row "credit x_55 on shard 11"

step 2, on shard 11, one transaction
  inter-shard clearing @11      −1000
  wallet bob                    +1000
  source_ref "x_55:credit", unique

step 3, on shard 3, one transaction
  x_55 debited → completed      conditional update
```

Step 1 does all the checking (balance, status, limits), and the API answers
once it commits. A worker runs steps 2 and 3 from the outbox row; delivery is
at least once, and a worker that finds `x_55:credit` already taken treats
step 2 as done and moves on to step 3 (or the return below). In between, the
money is visibly in transit, and Bob sees it a few hundred milliseconds later.

Step 2 fails only if Bob's account was closed or frozen after step 1 checked
it. The refusal is recorded on shard 11 in one transaction: a `rejected`
ledger transaction with no entries under `x_55:credit`, plus an outbox row
"return x_55". Without that marker, a redelivered credit after Bob was
unfrozen would pay Bob after Alice had been refunded, creating money. The
return is a **compensating** step on shard 3 under `x_55:return`: `x_55` from
`debited` to `returned` by conditional update, and `inter-shard clearing @3
−1000, wallet alice +1000`, the
[saga pattern](/systems-and-infrastructure/saga-pattern)'s local transactions
with an undo. A step failing for another reason, such as shard 11 being down,
is retried with backoff and alerted on after a few minutes; with three steps
and one undo, the outbox and a worker are enough without a
[workflow engine](/systems-and-infrastructure/workflow-engines).

**The choice** is the saga. Every transaction stays on one shard, so a slow
shard delays only its own transfers, and no lock is held across a network
call. It costs two more transactions and two more entries for each of 23.4
million movements a day (counted in the estimates), a moment when the money is
in neither wallet, and the nightly in-flight check. The ledger still balances
at every instant, because each step balances on its own.

## Failure modes and bottlenecks

**The processor is down or slow.** Card payments and top-ups fail or go
`pending`; wallet payments and transfers carry on. A
[circuit breaker](/systems-and-infrastructure/circuit-breaker) stops every
request waiting 8 seconds on a dead endpoint, giving card payments a fast
`503` so the checkout can offer the wallet, and workers resolve the pending
ones at a pace that won't knock the processor over again. A second processor
would fit behind the same states, at the cost of two settlement files.

**A shard's primary fails.** Its synchronous replica is promoted, typically
within a minute, with nothing confirmed lost. Requests touching that shard get
`503` until then and retry with their idempotency keys; the other 15 shards
carry on, and second steps bound for it wait in the queue. This is where the
99.95% goes.

**A flash sale at one merchant.** Every payment to that merchant lands on one
shard. There's no cached-balance row to lock, but each card payment is about
five transactions there (three for the payment, about two for its webhooks).
At 1,425 transactions a second per shard at peak against a ceiling of 2,500,
the spare 1,075 covers about 200 extra payments a second; a merchant expected
to exceed that is moved ahead of the event to a dedicated shard, with its own
fee and clearing accounts, through the account-to-shard directory.

**The outbox relay or event queue stops.** Payments still commit and outbox
rows pile up; transfers stay in transit and notifications wait, but no money is
lost or doubled, and the relay catches up. The oldest unpublished row's age is
alerted on.

**A bug that creates or destroys money.** The zero-sum check stops the crude
cases. A balanced but wrong transaction, such as a miscomputed fee or one
payment under two `source_ref`s, surfaces in reconciliation or in a nightly
check that every payment has exactly the ledger transactions its state implies
(one capture, and succeeded refunds plus pending ones adding up to
`refunded_minor`).

**Knowing any of this is happening.**
[Observability](/systems-and-infrastructure/observability) here means business
signals too: authorization approval rate (a sudden drop is usually our bug),
payments in non-final states by age, the oldest in-transit transfer, open
reconciliation breaks and the oldest one's age, and p99 latency of the
processor and each shard.

## Trade-offs

- **Double entry, append-only.** About 3.6 rows per movement instead of two
  updates, for a ledger that checks its own consistency, rebuilds any past
  balance, and keeps mistakes next to their corrections.
- **Cached balances for wallets only.** Wallet debits are checked in one
  conditional update; the hot accounts skip the cache, so reading their
  balance costs a sum over the day's entries.
- **Consistency over availability.** A failing-over shard refuses payments for
  about a minute; hence 99.95%, not 99.99%.
- **A saga over distributed transactions.** No lock spans two shards, but money
  spends a few hundred milliseconds in transit and there's a compensation path
  to build and test.
- **Idempotency keys end to end, and reconciliation anyway**, because that the
  processor honors its keys is a promise we can only check after the fact.

What would change the design: currency conversion would add the company's own
foreign-exchange accounts, with every conversion booked as a pair of
transactions, one per currency, each summing to zero. Growing well past this
scale mostly means more shards, since no request touches more than two; the
reconciliation and nightly checks, which read everything, would be the first
parts to need a bigger batch platform.
