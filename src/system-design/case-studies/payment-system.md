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

What makes this its own kind of problem is that money has to be accounted for
exactly. A bug that shows Alice $5 too much gives $5 away, and the most
dangerous failures are the ones whose outcome is unknown, such as a card charge
whose answer was lost on the network. The design is built around three
defenses: a ledger where every movement is recorded on both sides and never
edited, idempotency keys that make every retry safe, and a daily
reconciliation against the money that actually moved. It is one plausible
design for a service like PayPal, not a description of how any particular
company built theirs.

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

**Key numbers.** From the estimates:

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
  ([reconciliation](#deep-dive-reconciliation)).
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

- **Pay a merchant by card.** A checkout sends a payment for a card the
  customer entered; the money lands in the merchant's balance, minus our fee.
- **Top up a wallet** from a card, which is a card payment whose recipient is
  the user's own wallet.
- **Pay from the wallet.** A user pays a merchant from their balance.
- **Transfer between people.** Alice sends Bob money, wallet to wallet, which
  is also how friends settle a shared bill.
- **Refunds.** A merchant refunds all or part of a payment, back to the card or
  wallet it came from.
- **Chargebacks.** When a cardholder disputes a charge with their bank, the
  money is taken back from us, and the system records that against the
  merchant.
- **Balances and history.** Every user and merchant can see a balance and a
  list of what changed it.
- **Payouts (optional).** Users and merchants withdraw their balance to a bank
  account.

Out of scope: currency conversion (each wallet holds one currency), fraud
scoring (a risk check before authorizing fits into the payment service's path
without changing the architecture), identity checks at sign-up, merchant
onboarding, the paperwork side of disputes, and the store's own checkout, with
its cart and inventory.

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
  dominated by the card network's own round trip, usually a second or two; our
  own share of it should stay under 300 ms at p99.
- **Availability:** 99.95% for accepting payments, about 21.6 minutes of
  downtime in a 30-day month (30 × 24 × 60 = 43,200 minutes, and 0.05% of
  that is 21.6). That is looser than a URL shortener would promise, on
  purpose: when the database that holds an account is failing over, payments
  touching that account are refused for that minute rather than accepted on a
  guess. A refused payment can be retried; a wrong balance has to be found and
  unwound.
- **Retention:** financial records kept for seven years (an assumption; the
  real period depends on the jurisdictions the service operates in).

## Back-of-the-envelope estimates

Two rules of thumb from
[numbers every engineer should know](/engineering-practices/numbers-every-engineer-should-know)
set the frame: a day is 86,400 seconds, and a system should be planned for a
peak about ten times its average. Payments are spiky (a holiday sale, a
payday), so the tenfold peak is the figure to size for.

**Money movements.**

- Average: 50,000,000 ÷ 86,400 ≈ **580 movements a second**.
- Peak: **about 5,800 a second**.

**Calls to the card processor.** The 25 million card payments and top-ups each
need an authorization and a capture (both defined in the architecture), so 50
million calls a day, the same 580 a second on average and 5,800 at peak. The
processor sends back events about them by webhook, assumed to be about two per
payment: another 50 million a day.

**Database transactions.** A database transaction is a group of writes that
the database applies all together or not at all. The ledger is split across
several independent databases, called **shards**, each holding a slice of the
accounts; the design below uses 16, and a transfer between accounts on
different shards takes three transactions instead of one. Per day:

- Card payments and top-ups: three transactions each (record the attempt,
  record the authorization, record the capture with its ledger entries), so
  25,000,000 × 3 = 75 million.
- Webhook events: one small transaction each, 50 million.
- Wallet payments and transfers: one each, plus two more (credit the payee,
  then mark the payment completed) when the two accounts sit on different
  shards, which with 16 shards is 15 times in 16: 25,000,000 + 2 × 25,000,000
  × 15 ÷ 16 = 25 million + 46.9 million = 71.9 million.
- Total: about 197 million a day, so **about 2,280 a second on average and
  22,800 at peak**.

**How many shards.** The planning assumption is that one relational database
**primary**, the server that takes all writes for its shard, on large hardware
and waiting for a second copy to confirm each commit, handles about 5,000
small transactions a second in a load test. Planning at half that, 2,500,
leaves room for slow disks and bad days:

- 22,800 ÷ 2,500 ≈ 9.1, so 10 shards needed at today's peak.
- The design uses **16**, so each shard sees about 1,425 transactions a second
  at peak (22,800 ÷ 16), with room for about 75% more (2,500 ÷ 1,425 ≈ 1.75)
  before splitting again.

**Ledger entries.** Each movement is recorded as two or more entries (the data
model explains why). A card payment writes three (the processor's account, the
merchant and our fee), a top-up two, a wallet payment three and a transfer two,
and a transfer that crosses shards adds two more for the hop between shards:

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

Keeping 13 months in the live databases (enough to answer any question about
the last year and match late disputes) is about 71 GB × 395 days ≈ 28 TB,
or **about 1.8 TB per shard**. Older records move to cheaper archive storage;
seven years of everything is about 180 TB.

**Reconciliation.** The processor's daily settlement file has a line per item,
about 25 million lines; at around 200 bytes each, **5 GB a day** to match.

What the estimates say: the request rate is unremarkable and the storage is a
couple of terabytes per shard. The effort belongs to correctness: making each
of 197 million daily transactions record money exactly once, and finding out
quickly when the outside world disagrees.

## Data model

**Money as integers.** Every amount is an integer count of the currency's
**minor unit**, the smallest unit it's written in: cents for US dollars, so
$25.00 is `2500`. Currencies differ in how many decimal places they have (the
ISO 4217 standard lists them: two for USD and EUR, none for the Japanese yen,
three for the Kuwaiti dinar), so every amount travels with its currency code,
and the code decides how to display it. Floating-point numbers are never used
for money: they store most decimal fractions approximately, so in JavaScript
`0.1 + 0.2` is `0.30000000000000004`, and those errors add up across millions
of sums. A 64-bit integer holds far more than any balance will need. The JSON
API sends amounts as integers too; many JSON parsers read numbers as 64-bit
floating point, which is exact for integers only up to 2⁵³, about 90 trillion
dollars in cents, far beyond any single payment.

Fees get rounded, and the rule has to say where the leftover goes. Our fee is
2% of the payment: on a $19.99 payment that is 39.98 cents, rounded half up to
40, and the merchant gets 1,999 − 40 = 1,959, so the parts still add up
exactly to what was paid.

**The ledger.** A **ledger** is the record of every change to every balance.
The design uses **double-entry bookkeeping**, the scheme accountants have used
for centuries: every movement of money is one **ledger transaction** made of
two or more **entries**, each entry changes exactly one account, and a
transaction's entries always sum to zero. Money is never created in one place
without leaving another.

An **account** here is anything that can hold a balance, and there are three
kinds:

- **Customer accounts:** one wallet per user per currency, and one balance per
  merchant.
- **External accounts:** our view of parties outside the system, chiefly the
  processor's **clearing account** (money the processor owes us for captured
  card payments it hasn't paid out yet) and our own bank account.
- **Company accounts:** fees we've earned, fees we've paid, and losses such as
  chargebacks we couldn't recover.

The sign convention: an account's balance is how much the company owes that
account's owner, and a negative balance means the owner owes the company.
Alice's wallet at +5,000 means we hold $50 for her. The processor's clearing
account at −2,500 means the processor owes us $25. On the company's own
accounts, a positive balance is money that is the company's own, such as fees
earned, and a negative one is money it has spent, such as fees paid.
(Accountants label the two
sides of every movement **debit** and **credit**, and the zero-sum rule is
their "debits equal credits"; the signed amounts here are the same thing with
the labels folded into the sign.)

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

Every other movement is the same shape. Alice's $10 to Bob is `wallet alice
−1000, wallet bob +1000`. When the processor pays out the day's captures to
our bank, keeping its own fees, the settlement is one transaction too: the
clearing account goes back up by the gross amount, our bank account goes down
by the net (the bank now owes us that cash), and a "processor fees paid"
account goes down by the difference. A payout `po_3` to a merchant's bank is
two transactions: `merchant −X, payout clearing +X` under `source_ref` `po_3`
when we commit to sending it, and `payout clearing −X, our bank +X` under
`po_3:confirm` when the bank confirms it left our account (the reconciliation
deep dive has the steps between).

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

**Entries are never updated or deleted.** A mistake is corrected with a new
ledger transaction that reverses it, pointing back through `reverses_txn_id`.
The application's database login is granted only `INSERT` and `SELECT` on
`entries` and `ledger_transactions`, so a bug in our code can't quietly rewrite
history, and changing it by hand would take separate, audited credentials. That gives the ledger the
property auditors want: the balance at any past moment can be rebuilt by
adding up entries up to that moment.

`source_ref` is the ledger's own idempotency guard. Every event that moves
money has a natural name, like "the capture of `p_42`" or "refund `r_7`", and
the unique index on it means a second attempt to record the same event, from a
retry, a duplicate webhook or a recovery job, fails on insert instead of
moving the money twice.

A transfer between two wallets is a row in `payments` too, with `method` set
to `wallet`; so is a wallet payment to a merchant.

**Payment states.** A card payment moves through `authorizing` → `authorized`
→ `captured`, or ends in `declined`, `failed` or `voided` (authorized and then
released without capture), which are final. A captured payment can later
become `partially_refunded`, `refunded` or `charged_back`, each of which adds
ledger transactions without touching the old ones. A wallet payment or
transfer skips the processor: it is `debited` once the payer's side commits
and `completed` once the payee's side has too (in the same transaction, when
both accounts are on one shard), or `returned` if the payee's side refused it
and the money went back to the payer. Every state change is a conditional update, `UPDATE payments SET
state = 'captured', version = version + 1 WHERE payment_id = 'p_42' AND state
= 'authorized' AND version = 7`, so two workers racing on the same payment
can't both move it, and a stale one finds zero rows updated and stops.

**Why a relational database.** A transfer changes two balances and inserts
several rows all or nothing, a balance check must see the latest committed
value, and auditors ask ad hoc questions ("every entry on this merchant
between these dates"). Multi-row transactions, constraints and flexible
queries are what a relational database such as PostgreSQL or MySQL offers,
which is how [SQL vs. NoSQL](/systems-and-infrastructure/sql-vs-nosql) comes
out here. The cost is one server's ceiling, which the estimates already hit,
so the ledger is sharded by account.

## API design

The API is called by merchants' servers (checkout payments, refunds) and by our
own wallet app (top-ups, wallet payments, transfers). Every call that moves
money requires an `Idempotency-Key` header: a unique string the caller
generates once per intent, such as a random UUID created when the customer
pressed "Pay". A retry of the same request carries the same key, and the
server answers it with the payment the first attempt created, in whatever
state it has reached, instead of creating another. [Idempotency](/systems-and-infrastructure/idempotency)
explains the technique; the deep dive on the processor follows the key all the
way down.

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

`source` is either a card token or `{ "type": "wallet" }` when a signed-in user
pays from their balance. `capture: false` authorizes only, for a merchant that
captures when it ships, with `POST /v1/payments/{id}/capture` later. Responses:

- `201 Created` with the payment and its state: `captured` or `authorized` for
  a card, `completed` or `debited` (on its way to the payee) for a wallet.
- `402 Payment Required` when the card is declined or the wallet balance is too
  low, with a reason code.
- `202 Accepted` with state `pending` when the outcome at the processor is
  not yet known (the deep dive explains when); the caller learns the result by
  webhook or by `GET /v1/payments/{id}`.
- `409 Conflict` when the idempotency key was already used with a different
  request body.
- `429 Too Many Requests` over the caller's rate limit, applied as in
  [the rate limiter case study](/system-design/rate-limiter).

**Card numbers never reach our servers.** The checkout page and the app
collect the card number with the processor's own client-side component, which
sends it straight to the processor and gets back a **token**, an opaque string
like `tok_9Hq2...` that only means something to the processor. Everything on
our side stores and sends the token. Any system that stores, processes or
transmits card numbers falls under PCI DSS, the card industry's security
standard, with audits and controls on every server and network involved;
keeping the numbers off our servers keeps most of our systems out of
that scope.

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
"after this entry", since a busy merchant has millions of entries. Merchants
hear about their payments through our own webhooks to their servers, sent the
way [the notification system](/system-design/notification-system) sends
anything that must arrive.

## High-level architecture

![Architecture of the payment system and wallet. The wallet app and merchant checkouts send the card number straight to the external payment processor to get a token, and send payments, transfers and refunds to the payment service, which runs behind a load balancer. The payment service writes one transaction per shard to the ledger database of 16 shards and calls the processor to authorize, capture and refund; the processor sends webhooks back to the payment service. The ledger shards' outbox rows go to the outbox relay, which publishes them to the event queue; payment workers consume the queue, write second legs and fixes to the ledger shards and make status checks with the processor. The reconciliation job fetches the processor's settlement file and reads entries from the ledger shards.](/diagrams/payment-system/architecture.svg)

The pieces:

- The **payment service** is a set of identical, stateless servers behind a
  load balancer. It checks the caller, applies the idempotency key, talks to
  the processor, receives the processor's webhooks, and writes to the ledger.
  The ledger is a module inside it, not a separate service over the network,
  so a payment's state change and its entries share one database transaction.
- The **ledger database** is 16 shards of a relational database. Each shard
  owns a slice of the accounts together with everything that must change in
  the same transaction as them: their entries, the payments, refunds, payouts
  and idempotency keys of requests that start on those accounts, and the
  outbox. Each shard
  has a primary and a **synchronous replica** in another data center zone: the
  primary doesn't confirm a commit until the replica has it too, so losing
  the primary loses nothing confirmed.
- The **payment processor** is an outside company that connects us to the card
  networks (Visa, Mastercard and the like) and through them to the bank that
  issued each card. We don't control it: its latency varies, it has outages,
  and it reports some outcomes only later, by **webhook**, an HTTP request it
  makes to an endpoint of ours when something happens.
- The **outbox relay**, **event queue** and **payment workers** carry work
  that follows a commit: second legs of cross-shard transfers, checks on
  payments whose outcome is unknown, and telling merchants and users.
- The **reconciliation job** runs daily, comparing the processor's settlement
  file with the ledger.

**Card payments have three stages**, and the processor's API mirrors them:

1. **Authorization.** The processor asks the card's issuing bank, through the
   card network, to approve the amount. If approved, the bank places a
   **hold** on the cardholder's available funds; no money has moved yet.
2. **Capture.** We tell the processor to take the authorized amount. A shop
   that ships goods can capture days later; a wallet top-up captures
   immediately. An authorization that is never captured expires after some
   days, and the hold disappears.
3. **Settlement.** In a batch, usually one to a few days later, the money
   actually moves: the processor pays us the day's captured amounts minus its
   fees, in one bank transfer, and sends a file listing what it covers.

The ledger records a card payment at capture, the moment the money is
committed to us, against the processor's clearing account. Settlement then
empties the clearing account into our bank account. An authorization moves no
money, so it is state on the payment record, not a ledger entry.

**A wallet payment from Alice to a store**, when both accounts are on the same
shard, is one transaction on that shard:

1. Insert the idempotency key row, naming the new payment. If the key already
   exists, return the payment it names. (A second request with the same key
   arriving at the same instant waits on the key's unique index until the
   first commits, then finds it.)
2. Subtract from Alice's cached balance only if it stays at or above zero (the
   ledger deep dive has the statement). If no row changes, roll back and
   answer `402`.
3. Insert the ledger transaction and its three entries, the payment record in
   state `completed`, and an outbox row "payment completed".
4. Commit, then answer `201`.

A crash anywhere before the commit leaves nothing behind, and the client's
retry with the same key starts over cleanly. A crash after the commit but
before the answer leaves the payment done, and the retry finds the key and
gets the completed payment back. The outbox row is published by the relay after commit;
[the outbox pattern](/systems-and-infrastructure/outbox-pattern) is what makes
"the payment happened" and "the event will be published" a single write, and
it publishes at least once, so every consumer deduplicates on the event's
payment ID. When Alice and the store are on different shards, the payment is
three transactions, the subject of the last deep dive.

## Deep dive: the ledger and its balances

**Why double entry.** There are two simpler ways to keep money.

The simplest is a **balance column**: each account row holds a number, and a
transfer runs `UPDATE ... SET balance = balance - 1000` on one row and `+ 1000`
on another. It's fast and small, and it forgets: nothing records why a balance
is what it is, so a bug that adds 1,000 in one place and forgets to subtract it
elsewhere creates money silently, and a customer who disputes their balance
can't be shown anything.

A **single-entry log** keeps one row per payment saying "from A to B, 1,000".
It records history, and balances can be rebuilt by replaying it. It breaks
down as soon as a movement has more than two sides: a card payment
touches the processor, the merchant and our fee account, and a settlement
touches the clearing account, our bank and the processor-fee account. Each
shape becomes a special case in every query that computes a balance.

**Double entry** costs more rows, about 182 million entries a day against 50
million movements, roughly 3.6 each. In exchange, every shape of movement is
the same kind of record, any number of accounts can take part, and there's an
invariant cheap enough to check constantly: every transaction sums to zero, so
the whole ledger sums to zero. A bug that makes money out of nothing breaks
that sum. The ledger module refuses to commit a
transaction whose entries don't sum to zero, and a check inside the database
at commit time (a deferred constraint trigger, in PostgreSQL) enforces it
again against code that goes around the module.

**Refunds and chargebacks are new entries.** When the store refunds Alice's
$25 card payment, nothing in `t_901` changes. A new transaction is posted:

```text
ledger transaction t_977  "refund r_7 of payment p_42"
  merchant m_store         −2500   the store gives back the full $25
  processor clearing       +2500   the processor will take $25 from our next settlement
```

Our 2% fee is not returned in this design's pricing, so the store bears it.
Before the processor hears of it, the refund commits one transaction on the
payment's shard: the idempotency key, a `refunds` row `r_7` in state
`pending`, and a reservation on the payment, `UPDATE payments SET
refunded_minor = refunded_minor + 2500 WHERE payment_id = 'p_42' AND
refunded_minor + 2500 <= amount_minor`. Zero rows updated means the refund
would pass the captured amount, and the API answers `422`; two partial refunds
racing each other take turns on the payment's row, so the second checks the
total the first left. Only then is the refund sent to the processor, with
`r_7` as its idempotency key, so a crash and a retry resend the same refund
rather than minting a new one. The entries are posted when the processor
confirms it, with `source_ref` = `r_7`, so the confirmation arriving both in
the API response and in a webhook still posts once. A definite failure marks
`r_7` `failed` and takes its amount back off `refunded_minor` in one
transaction; an unknown outcome is resolved the way the next deep dive
resolves a card payment's.

A chargeback is the same shape, started by the processor's webhook. The
processor has already taken the money back (it nets it out of our next
settlement), so the merchant's balance goes down by the payment plus the
chargeback fee, and the clearing account up by the same. A merchant balance
may go negative (`allow_negative` is true), meaning the merchant owes us. If we
later win the dispute, another transaction reverses the chargeback, and the
history shows all three events in order.

**Where balances come from.** A balance is, by definition, the sum of an
account's entries. Two ways to get it:

**Derive it on read.** `SELECT SUM(amount_minor) FROM entries WHERE
account_id = ...` is always right and needs no extra state, but its cost grows
with the account's history: fine for Alice's few thousand entries, a scan of
millions for a large merchant. Keeping a **snapshot** (each account's balance
at the end of each day, in its own table) and adding only the entries since
bounds the work, at the cost of a job that writes the snapshots.

**Cache it on the account row**, updated in the same database transaction that
inserts the entries. Reads are one row, and a debit's balance check is part of
the update itself:

```sql
UPDATE accounts
SET balance_minor = balance_minor - 2000, version = version + 1
WHERE account_id = 'wallet:alice:USD'
  AND balance_minor >= 2000
  AND status = 'active';
```

If zero rows change, Alice doesn't have the money (or her account is frozen),
and the transaction rolls back. The update takes a lock on Alice's row until
commit, so two payments from her at the same instant run one after the other,
and the second checks the balance the first left, the lost-update problem
[race conditions](/systems-and-infrastructure/race-conditions) describes. This
is pessimistic locking; an optimistic version would read the balance and
version, then update only if the version is unchanged, retrying on conflict.
For a wallet, where two simultaneous payments from one person are rare, both
work, and the single conditional `UPDATE` is simpler.
[Optimistic vs. pessimistic locking](/systems-and-infrastructure/optimistic-vs-pessimistic-locking)
covers when each wins.

The cost of caching is **hot accounts**. The lock is held until commit, which
includes waiting for the synchronous replica, a few milliseconds. At, say, 4
ms per transaction, one row can take about 250 updates a second, no matter how
big the server is. A wallet never sees that. But every card and wallet payment
to a merchant credits our fee account: 35 million a day, about 4,000 a second
at peak (35,000,000 ÷ 86,400 × 10 ≈ 4,050). One fee account for the whole
system couldn't take that, and even one per shard would see about 250 a second
(4,050 ÷ 16), right at the ceiling. A large merchant in a sale can see a few
hundred payments a second on its own row, at or past it.

**The choice** is both, split by account kind. User wallets, which must be
checked before every debit, keep a cached balance. Accounts that are only
credited on the hot path, or that are allowed to go negative (merchant
balances, the fee accounts, clearing accounts), keep no cached balance: their
payments only insert entries, which never contend, and their balance is
derived from the daily snapshot plus the day's entries when someone asks,
which is rare (a dashboard, a payout). There's also one fee account and one
clearing account per shard, not one for the whole system, so no row is shared
across shards; the company-wide fee total is the sum over the 16.

**Checking the cache.** A cached balance is a second copy of the truth, and
copies drift when there are bugs. A nightly job recomputes the balance of
every wallet that changed that day, from its last verified snapshot plus the
day's entries, and compares it with `balance_minor`; any mismatch freezes the
account and pages someone. The same job checks that each shard's entries sum
to zero, and that the accounts carrying money between shards (the last deep
dive) add up, across the 16, to exactly the transfers still in flight.

## Deep dive: paying through a processor you don't control

Inside our database a transaction either commits or doesn't. The processor
offers no such thing. A call to authorize can come back approved, come back
declined, or not come back at all, and the last case is the hard one: the
request may have been lost on the way there, or the approval lost on the way
back, and from our side the two look identical. Between those, a real card may
or may not have a hold on it. This is the **unknown outcome problem**, and it
shapes most of what follows.

Three ways to handle a timeout:

**Treat it as a failure.** Tell the customer the payment failed. If the first
attempt went through, the customer has a hold for a payment we have no
record of, and pays twice when they try again.

**Ask the processor what happened, then decide.** Processors generally let you
look up a payment by a reference you attached to it, so query by our payment
ID and use the result. The gap: a request still in flight inside the
processor may not show up yet, so "not found" doesn't prove it never arrived.

**Retry with the same idempotency key.** Many processors accept a
caller-chosen idempotency key on each call and, if they see the same key
again, return the result of the first request instead of running it again. A
retry of a lost request then runs it for the first time; a retry of a lost
answer gets that answer. Neither doubles the charge.

**The choice** is the third, with the second as a fallback. The chain of keys
runs end to end:

1. The caller's `Idempotency-Key` (`k1`) protects the call into our API. It's
   recorded, with the new payment `p_42` in state `authorizing`, in one
   transaction **before** the processor is called. From then on, `p_42` is
   the one payment for that intent, however many times the caller retries.
2. Our calls to the processor use keys derived from the payment, not from the
   attempt: `p_42-auth` for authorizing, `p_42-cap` for capturing. Every retry,
   by whichever server or worker makes it, sends the same key.
3. The ledger records the capture with `source_ref` = `p_42:capture`, unique,
   so it's recorded once however many paths report it.

![Sequence of one $25.00 card payment, p_42. The checkout sends POST /payments with Idempotency-Key k1 to the payment service, which inserts p_42 in state authorizing with key k1 into the ledger shard, then sends authorize 2500 with key p_42-auth to the processor. No answer comes back within 8 seconds, so the payment service sends the authorize again with the same key, and the processor answers approved, auth_77, the first attempt's result. The payment service records p_42 authorized, sends capture auth_77 with key p_42-cap, and the processor answers captured. The payment service writes one transaction to the ledger shard: p_42 captured plus 3 entries, and answers the checkout 201, captured. Later the processor sends webhook evt_9, capture succeeded; the payment service records evt_9 as new, finds p_42 already captured, writes no entries, and answers the processor 200.](/diagrams/payment-system/card-payment-sequence.svg)

Retries are spaced out with
[exponential backoff](/systems-and-infrastructure/exponential-backoff) and
jitter so a struggling processor isn't hit by every server at once. Each call
has an 8-second timeout, and the payment service gives an API call about 20
seconds in total. If it still has no definite answer, it stops holding the
caller: the payment stays in `authorizing` (or `authorized`, if the capture is
what timed out), the API answers
`202` with state `pending`, and an outbox row asks the payment workers to
resolve it. A worker first looks the payment up at the processor by our
payment ID, then retries with the same key, backing off for up to about an
hour; if the processor still can't answer by then, the payment goes to a
person through a [dead-letter queue](/systems-and-infrastructure/dead-letter-queue).
An authorized payment that should have been captured and wasn't is either
captured or voided by the same workers, so no customer is left with a hold for
nothing. Assuming one call in a thousand times out, that's 50,000 calls a
day through this path, almost all resolved by the first retry.

**Crashes at each step** come out the same way, because every step is either
inside one database transaction or repeatable with the same key:

- Before the `authorizing` row commits: nothing happened anywhere. The
  caller's retry starts fresh.
- After it commits, before or during the processor call: `p_42` sits in
  `authorizing`. The caller's retry with `k1` finds it and carries on from
  there, and if the caller never retries, a worker sweeping for payments
  stuck in a non-final state for more than a minute does.
- After the processor approved or captured, before our state update commits:
  the same as a timeout. The retry gets the stored answer; for a capture, the
  processor's webhook may get there first, and either way `source_ref`
  lets only one of them post entries.

Two workers can pick up the same stuck payment. That needs no
[distributed lock](/systems-and-infrastructure/distributed-locks): both send
the same processor key, so the processor does the work once, and the state
update is a conditional write on `state` and `version`, so one of them wins
and the other finds zero rows updated and stops. The price is a duplicate call
to the processor now and then, which costs nothing.

**Webhooks** arrive at least once, possibly out of order, and possibly for
things we already know; the processor retries until we answer `2xx`. The
handler checks the request's signature (a code the processor computes over the
body with a secret shared with us, so a forged webhook fails), then in one
transaction inserts the event into `processor_events`, whose primary key is
the processor's event ID, so a duplicate fails on insert and is answered `200`
with nothing done. In the same transaction it moves the payment's state
forward only if the event's state is later than the current one (an
"authorized" arriving after "captured" moves nothing) and posts entries only
under the event's `source_ref`. It answers `200` after the commit, never
before, so a crash in between just means the processor sends it again.

**What this does not guarantee.** Inside our database, the effect is exactly
once: one payment per key, one ledger transaction per `source_ref`. Across the
boundary, we get at-least-once calls and rely on the processor's idempotency
keys to make them one charge. If the processor has a bug, or a card network
behind it double-processes something, no key on our side prevents it. That's
the reason the next deep dive exists.

## Deep dive: reconciliation

**Reconciliation** checks what our records say happened against what the
processor says happened, every day. It is the backstop for the failures the
rest of the design can't rule out: a lost webhook plus a bug in the recovery
workers, a processor that charged twice, a fee that doesn't match the
contract.

Each day the processor publishes a **settlement file**: one line per item in
the batch it paid out (captures, refunds, chargebacks), with its own
reference, our payment ID (sent as metadata on every call), gross amount, fee,
net amount and currency. There are two ways to compare it with the ledger.

**Totals only.** Sum the day's captures in the ledger, sum the file, compare.
It's cheap. When the totals disagree it says nothing about which of 25 million
payments is wrong, and two opposite errors can cancel out and hide both.

**Item by item.** Match every file line to a ledger transaction by the
processor's reference, falling back to our payment ID. The batch job gets the
day's ledger transactions on the clearing accounts from a read-only copy of
each shard (so it adds no load to the primaries;
[read replicas](/systems-and-infrastructure/read-replicas) covers the lag, and
the job runs hours after the day closes), joins the two sides on the reference
and compares amounts. 25 million lines on each side is a routine join for a
batch engine, minutes of work.

**The choice** is both: the totals first, as a quick sanity check and to
confirm the bank deposit (the net total in the file must equal the money that
arrived in our bank, which is a second match against the bank statement), then
the item match. Each unmatched or mismatched item is a **break**, and breaks
come in a few kinds:

- **In the ledger, not in the file.** Usually timing: a payment captured at
  23:59:58 by our clock lands in the processor's next batch. Such an item is
  marked pending and rechecked in the next two files; only then does it
  become a real break. A real one means we credited a merchant for money we
  may never receive. The payment is flagged, the processor is asked about
  it, and, if it never happened, a reversing transaction takes the credit
  back.
- **In the file, not in the ledger.** The worst kind: a customer was charged
  and we have no record, so the merchant was never credited. It means an
  unknown outcome was never resolved or was resolved wrongly. The fix posts
  the missing capture through the normal ledger path with the same
  `source_ref` the capture would have had (`p_42:capture`), so if a late
  webhook arrives afterward, it can't post a second copy. A second line for a
  payment we recorded once is a double charge, and is refunded to the
  customer.
- **Amounts differ.** Most often fees: the processor charged a different fee
  than the contract says. The difference is posted to the "processor fees
  paid" account with a note, and a pattern of them goes to whoever manages the
  processor relationship.

Corrections are never edits. Every fix is a new ledger transaction of type
`adjustment`, with the break it resolves and the person or rule that approved
it, so an auditor can see what was wrong, when it was found and who fixed it.
Known timing breaks resolve themselves automatically, and the rest go to a
queue for the finance operations team. The number of open breaks, and how old
the oldest is, are among the most-watched numbers in the whole system.

Reconciliation also gates payouts. A merchant's balance can include captures
that haven't been matched yet; payouts to the merchant's bank only draw on
the part whose captures have been matched to a settlement, so we never send
out money that we may turn out not to have received. A merchant balance has no
cached row to check against, so two payouts computing the available amount at
once could each take all of it. A payout therefore starts with `SELECT ... FOR
UPDATE` on the merchant's `accounts` row, which payments never lock since
they only insert entries, so payouts for one merchant run one at a time.
Holding that lock, it computes the available amount and commits `merchant −X,
payout clearing +X` together with the `payouts` row `po_3` and an outbox row.
A worker then asks the bank to send it, with `po_3` as the idempotency key, so
a retry can't send it twice, and the bank's confirmation posts the second
transaction under `po_3:confirm`.

## Deep dive: sharding the ledger and moving money between shards

One database primary can't take 22,800 transactions a second at peak with
room to spare, so the ledger is split into 16 shards.
[Partitioning vs. sharding](/systems-and-infrastructure/partitioning-vs-sharding)
covers the general mechanics; the question here is what to split by.

**By account** is the natural key: every balance check and history query is
about one account. An account's ID is hashed to pick its shard, and all of its
entries live there. A small **account-to-shard directory**, cached on every
payment server, overrides the hash for the few accounts deliberately placed
elsewhere, such as a merchant moved to a shard of its own (the failure modes
say when). Payments and idempotency keys go on the shard of the
account the request starts from (the payer's wallet for a wallet payment or
transfer, the merchant's balance for a card payment), so that the first
transaction of any request is local to one shard. System accounts that every
payment touches, the fee and clearing accounts, have one copy per shard, as
the ledger deep dive described, and so do the bank and processor-fee accounts
that settlement uses: the daily settlement is posted as one transaction on
each shard, for that shard's share of the batch. A card payment then touches only the
merchant's shard: its clearing account, the merchant, its fee account. It's
one local transaction.

A wallet payment or transfer touches two customer accounts, and with 16 shards
they are on different shards 15 times in 16. A transaction on one database
can't include rows on another, so something has to give. Three options:

**A distributed transaction (two-phase commit).** A coordinator asks both
shards to prepare, holding their locks, then tells both to commit. It keeps
the transfer atomic. The cost: every cross-shard transfer takes an extra round
trip while holding locks, including Alice's wallet row; if the coordinator
dies between the phases, both shards hold their locks until it recovers, and
Alice can't pay anyone in the meantime. Many databases support the protocol,
but running it at about 2,700 cross-shard transfers a second at peak
(23.4 million a day ÷ 86,400 seconds × 10) is a large operational
commitment.

**A distributed SQL database**, which shards itself and runs cross-shard
transactions internally. It keeps the programming model of one database, adds
latency to every cross-shard commit, and is a more complex system to learn and
run, for the one workload that most needs to be boring.

**Two local transactions and a clearing account (a saga).** Split the transfer
into two steps, each balanced within its own shard, with money passing
through an inter-shard clearing account that exists on every shard. Alice (on
shard 3) sends Bob (on shard 11) $10:

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

Step 1 does all the checking: Alice's balance, her account's status, limits.
The API answers once step 1 commits, because from then on the transfer can't
fail for lack of money. The outbox row goes to a payment worker, which runs
step 2 and then step 3. Outbox delivery is at least once, so step 2 may be
attempted twice, and its unique `source_ref` makes the second attempt a
no-op: a worker that finds `x_55:credit` already there treats step 2 as done
and moves on to what follows it, marking `x_55` completed after a credit, or
the return below after a refusal. Between the
steps, the money is visibly in transit: shard 3 is up $10 on its clearing
account, shard 11 not yet down, and the two clearing accounts sum across
shards to exactly the transfers in flight. Bob sees the money a few hundred
milliseconds later, not in the same instant.

Step 2 can fail only if Bob's account can't take credits, because it was
closed or frozen after step 1 checked it. The refusal is itself recorded on
shard 11, in one transaction: a ledger transaction of type `rejected` with no
entries under the same `source_ref`, `x_55:credit`, and an outbox row "return
x_55". The marker matters: without it, a redelivered "credit x_55" arriving
after Bob's account was unfrozen would credit Bob after Alice had been paid
back, and money would be created. With it, every later attempt finds
`x_55:credit` taken. The return is a **compensating** step on shard 3, one
transaction under `source_ref` `x_55:return`: a conditional update of `x_55`
from `debited` to `returned`, and the entries
`inter-shard clearing @3 −1000, wallet alice +1000`. That's the
[saga pattern](/systems-and-infrastructure/saga-pattern): a chain of local
transactions, each with an undo, instead of one global one. A step that keeps
failing for another reason, such as shard 11 being down, is retried with
backoff, with an alert once a transfer has been in transit for a few minutes.
A [workflow engine](/systems-and-infrastructure/workflow-engines) could run the
chain and keep each transfer's progress; with three steps and one undo, the
outbox and a worker are enough.

**The choice** is the saga through clearing accounts. It keeps every database
transaction on one shard, so a slow or failing shard delays only the
transfers touching it, and no lock is ever held across a network call. It
costs two more transactions for each of 23.4 million movements a day (counted
in the estimates), two extra entries each, a moment in which the money is in
neither wallet, and a nightly check that inter-shard clearing sums to the
transfers in flight and that none has been in flight for long. The ledger
still balances at every instant, because each step balances on its own.

## Failure modes and bottlenecks

**The processor is down or slow.** Card payments and top-ups fail or go
`pending`; wallet payments and transfers never touch the processor and carry
on. A [circuit breaker](/systems-and-infrastructure/circuit-breaker) around
processor calls stops the payment service from sending every request into a
dead endpoint and waiting 8 seconds for each; while it's open, card payments
get a fast `503` and the checkout can offer the wallet instead. Payments
caught mid-call sit in `authorizing` as "pending", and the workers resolve
them as the processor recovers, pacing themselves so they don't become the
load that knocks it over again. A second processor to route around outages
would slot in behind the same payment states, at the cost of reconciling two
settlement files.

**A shard's primary fails.** Its synchronous replica is promoted, typically
within a minute. Nothing confirmed is lost, since the replica had every
committed transaction; requests touching that shard's accounts fail with
`503` until the promotion finishes, and callers retry with their idempotency
keys. The other 15 shards are unaffected, and so are transfers between two
other shards. Cross-shard transfers whose second step lands on the failed
shard wait in the queue and complete afterward. This is where the 99.95% goes.

**A flash sale at one merchant.** Every payment to that merchant goes to one
shard, with no cached-balance row to lock, so the cost is only inserts, but
each card payment is about five transactions on that shard (three for the
payment, about two for its webhooks). At 1,425 transactions a second per shard
at peak, against a planning ceiling of 2,500, the spare 1,075 covers about 200
extra payments a second from one merchant. A merchant expected to exceed that
is moved ahead of the event to a dedicated shard, with its own fee and
clearing accounts, through the account-to-shard directory.

**The outbox relay or event queue stops.** Payments still commit, and their
outbox rows pile up in the shards. Cross-shard transfers stay in transit and
merchant notifications are delayed, but no money is lost or doubled; the
relay catches up from where it left off. The age of the oldest unpublished
outbox row is alerted on.

**A bug that creates or destroys money.** The zero-sum check at commit stops
the crude cases. A balanced but wrong transaction, such as a fee computed
wrongly or one payment posted twice under two different `source_ref`s, gets
past it. Those surface in reconciliation for card payments, and in a nightly
check that every payment has exactly the ledger transactions its state implies
(one capture, succeeded and pending refunds adding up to `refunded_minor`). Freezing the affected
accounts and posting corrections is routine, since fixing anything never
requires editing the ledger.

**Knowing any of this is happening.**
[Observability](/systems-and-infrastructure/observability) for a payment
system means business signals alongside technical ones: authorization
approval rate (a sudden drop is usually our bug, not a wave of declines),
count of payments in non-final states by age, oldest in-transit transfer,
open reconciliation breaks, and p99 latency of the processor and of each
shard.

## Trade-offs

- **Double entry over a balance column.** About 3.6 rows per movement instead
  of two updates, in exchange for a ledger that can check its own consistency
  and rebuild any balance at any past moment.
- **Append-only entries.** Mistakes stay in the history next to their
  corrections, which is what auditors and support staff want to see.
- **Cached balances for wallets only.** Wallet debits are checked in one
  conditional update. Merchant, fee and clearing accounts skip the cache to
  avoid lock contention, so reading their balance costs a sum over the day's
  entries.
- **Consistency over availability.** A shard that is failing over refuses
  payments for about a minute rather than accept them without a trustworthy
  balance; hence 99.95%, not 99.99%.
- **A saga over distributed transactions.** No lock spans two shards, and a
  slow shard hurts only its own accounts. In return, money spends a few hundred
  milliseconds in transit, and there's a compensation path to build and test.
- **Idempotency keys end to end, and reconciliation anyway.** The keys make
  retries safe inside our walls and with a processor that honors them. That
  the processor honors them is a promise we can't check in the request path,
  so the daily match checks it after the fact.

What would change the design: currency conversion would add the company's
own foreign-exchange accounts, with every conversion booked as a pair of
transactions, one per currency, each summing to zero. Growing well past this
scale mostly means more shards, since no request touches more than two; the
reconciliation and nightly checks, which read everything, would be the first
parts to need a bigger batch platform.
