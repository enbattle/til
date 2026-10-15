---
title: The Testing Pyramid
summary: Unit, integration and end-to-end tests catch different bugs at different costs, which is why most suites keep many cheap tests and few expensive ones.
date: 2026-09-14
---

Say you run an online shop, and you have just added coupons: a customer types a code at checkout and the cart total drops. You want to know it works after every future change. What kind of test do you write, and how many?

This page tries the obvious answer, clicking through the shop like a customer, then covers the three kinds of test, the pyramid they form, other shapes, and how to choose.

## The obvious approach: test it like a customer

The direct test does what a customer does. A script opens the checkout page in a browser, enters `SAVE10`, and reads the total. This is an **end-to-end test**: it drives the whole assembled system from the outside.

Now test every coupon rule this way. Say there are 200 cases, and a browser test takes about 4 seconds.

```text
200 tests × 4 seconds = 800 seconds ≈ 13 minutes per run
```

Thirteen minutes is too long to wait before every commit, so people stop running the suite. A test is **flaky** when it sometimes fails with no code change, and browser tests flake because they depend on timing, the network and shared test data. If each test fails for no reason about 1 run in 50, a run has about 200 ÷ 50 = 4 false failures. Once people learn a red build is usually noise, they stop trusting it. And a failure could come from the page, server, database or test environment, so you start by investigating.

So this approach is slow, noisy and hard to debug. Tests of smaller pieces would fix that, if they gave the same confidence.

## Three kinds of test, three kinds of bug

A **unit test** runs one function in isolation, with no real database, network or browser. You call `applyDiscount(cart, coupon)` with many coupons and check each total. A failure points at one branch of one function. The 200 rule cases as unit tests, at about 5 milliseconds each, take 200 × 0.005 = 1 second.

But unit tests can't see everything. Say `applyDiscount` calls a lookup in the database, and the unit test replaces the database with a **mock**, a stand-in that returns canned answers. If coupon codes are stored uppercase and the real lookup compares case-sensitively, every unit test passes while customers typing `save10` get nothing.

An **integration test** catches that. It runs real pieces together, such as the lookup against a real test database, so the real comparison rules apply. It costs more than a unit test, since a database must start, but far less than a browser.

So unit tests catch wrong logic, integration tests wrong wiring between pieces, and end-to-end tests what exists only in the assembled system, like an "Apply coupon" button never connected to `applyDiscount`. Each costs more than the one before. Which mix should we buy?

## Why the pyramid shape?

Draw unit tests as a wide base, integration tests above them, and a few end-to-end tests as the tip. This is the **testing pyramid**: speed, flakiness and debugging all get worse as you climb, so put the most tests at the bottom.

For the shop, that means the 200 coupon rules as unit tests, 20 integration tests at about 0.5 seconds each, and 2 end-to-end tests for the journeys that must never break, such as add to cart, apply a coupon, pay.

```text
unit         200 × 0.005 s =  1 s
integration   20 × 0.5 s   = 10 s
end-to-end     2 × 4 s     =  8 s
total                      ≈ 19 s
```

The inverted shape, mostly end-to-end and manual tests with few unit tests, is Alister Scott's **ice-cream cone**. It works at first, then decays into the slow, flaky suite from the start of this page.

## When another shape fits

The pyramid is a default, not a law. The **testing trophy**, Kent C. Dodds's shape popular in frontend work, argues for a thick middle: static checks (type checking and linting, which catch mistakes without running the code) as its base, a few unit tests, mostly integration tests, and a few end-to-end tests. Mock-heavy unit tests can pass while the wiring is broken, like the mocked lookup above, so the trophy favors integration tests. It fits where those are cheap, such as when the database starts in a second. Neither shape helps when what you depend on belongs to another team.

## What about other teams' services?

Suppose checkout calls a separate payments service owned by another team. Mocking it in unit tests is only your guess about its behavior, and running the real one in every end-to-end test is slow and fragile.

A **contract test** sits between them. Your team writes down what it sends and what it expects back, for instance "POST `/charges` with an amount and a currency returns a charge id". The payments team runs that expectation against its real service in its own build, so a change that breaks it fails their build before anything ships. Your own tests run against a stub generated from the same contract, so your mock stops being a guess.

## Deciding what goes where

That leaves the everyday question of which test a new behavior needs. Ask two questions of any behavior, such as "a 10% coupon rounds correctly".

1. Can a unit test catch it? The rounding rule lives in one function, so yes. Write many unit tests here, including odd cases like zero or negative totals.
2. If not, what is the cheapest test that can? A wrong lookup needs a real database, so use an integration test. A broken service boundary needs a contract test. Only a bug that exists in the assembled system, like the unwired button, needs an end-to-end test.

When an end-to-end test finds a bug, fix it, then add a lower-level test that would have caught it, so the next one is cheaper.

**Rule of thumb.** Test each behavior at the lowest level that can catch its bug: many fast unit tests, integration tests where real components must meet, contract tests at service boundaries, and a handful of end-to-end tests for the journeys that must never break.
