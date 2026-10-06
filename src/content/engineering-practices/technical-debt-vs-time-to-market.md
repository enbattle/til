---
title: Technical Debt vs. Time to Market
summary: A shortcut that ships sooner is a loan, worth taking when shipping early teaches or wins you something, and manageable only if you write down what you skipped and when you will repay it.
date: 2026-09-14
---

Say you run a small team building an online store. Your checkout needs shipping costs, and the proper way is a rates service that asks carriers for live prices. That takes two more weeks. Or you could paste a lookup table of flat prices for your four launch regions into the code and ship tomorrow. Which do you pick?

Two ideas sit behind that choice. **Time to market** is how long it takes to get something in front of real users. **Technical debt** is the future cost of a shortcut you take now: a hardcoded value, a skipped test, copy-pasted code, missing error handling. The shortcut works today, but every later change near it gets slower and riskier. Neither "always do it properly" nor "always ship the fastest thing" is a good policy. The answer depends on what shipping sooner buys you.

## Why call it debt?

Because it behaves like a loan. You get something now (the launch, a week earlier) and you pay for it later, with interest. The interest is the extra effort every change near the shortcut costs you. Someone adding a fifth region has to read the table, work out which values are stale, and test by hand because nothing checks them.

The interest compounds. Features built on top of the table assume it exists. The free-shipping promotion reads from it, and so does the tax calculation. Each one makes the table harder to replace, so the repayment cost grows too. You can end the debt in two ways: **repay** it by replacing the shortcut with the proper version (here, the rates service), or retire it by deleting the feature that depends on it.

## When is taking the loan worth it?

When what you learn or win by shipping early is worth more than the interest. If you don't yet know whether anyone will buy your product, the two weeks you save are two weeks of evidence. If nobody buys, you throw the table away and never pay for the rates service you didn't build. A shortcut that gets thrown away before it hurts was the cheapest option all along. Speed can also pay without teaching you anything: a holiday sale or a contract date that a later launch would miss.

It is a bad deal when the code is something you already know you will keep and extend, such as payment handling. There the shortcut doesn't buy learning, only a short delay in a bill you will certainly pay, unless a fixed date is worth more than the interest.

## Recorded debt versus forgotten debt

The size of the shortcut matters less than whether anyone knows about it. **Recorded debt** is a decision someone wrote down: "we hardcode rates for four regions to test demand, and we replace them if it works." **Forgotten debt** is the same code with no record, because nobody stopped to think or because the deadline ate the plan to come back.

Imagine both versions of your table. In the recorded one, there is a comment and a ticket: "hardcoded rates for the 4 launch regions; replace with the rates API before adding a fifth region." Six months later, still at four regions, a customer reports a wrong shipping price. Whoever picks it up reads the ticket and knows where to look.

In the forgotten version, nothing says the table exists. The same person starts at the bug report, has to search for where prices come from, and only then discovers the table is out of date. Same code, same shortcut. The only difference is the cost of finding it, and that difference is invisible until something breaks.

## How do you keep it recorded?

Name the shortcut when you take it. A `TODO` comment that says what was skipped and why, plus a ticket in the tracker, is enough. A code reviewer helps here: asking "is this on purpose?" turns a silent shortcut into a recorded one, and reviewing the diff is the cheapest moment to ask. The same goes for tests. Skipping them on throwaway code is a loan, but skipping them on code that stays means you pay later in bugs (see the [testing pyramid](/engineering-practices/testing-pyramid) for where tests earn their cost).

Recording is only half of it. The ticket needs a trigger for repayment, such as "when we add a fifth region" or "when demand is validated", so you know when to act. A ticket with no trigger is a note nobody reads.

**Rule of thumb.** Take a shortcut only when shipping sooner teaches you something or wins something a later date would lose, and write down what you skipped and when you will revisit it. A shortcut that is written down is debt you manage, and one that isn't tends to become permanent.
