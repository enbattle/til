---
title: The Testing Pyramid
summary: Unit, integration and end-to-end tests catch different bugs at different costs, which is why most suites keep many cheap tests and few expensive ones.
date: 2026-09-14
---

Say you run an online shop, and you have just added coupons: a customer types a code at checkout and the cart total drops. You want to know it works, today and after every future change. What kind of test do you write? The answer depends on which bug you are trying to catch, and the **testing pyramid** is the usual way to think about it.

## Three kinds of test, three kinds of bug

A **unit test** runs one function or class in isolation, with no real database, network or browser. You call `applyDiscount(cart, coupon)` with a dozen coupon values and check the totals. It runs in milliseconds, and when it fails, it points at one branch of one function.

An **integration test** runs a few real pieces together, such as your discount lookup against a real test database. It catches what a unit test with a **mock** (a stand-in object that returns canned answers) cannot. Suppose coupon codes are stored uppercase and the lookup compares them case-sensitively. A mocked database does not know the real comparison rules, so every unit test passes while real customers typing `save10` get nothing.

An **end-to-end test** drives the whole system the way a user does, for example a script that opens the checkout page in a browser, enters a code and reads the total. It catches the bug the other two cannot, such as an "Apply coupon" button that is never connected to `applyDiscount`.

The cost goes up as you move along that list. Unit tests are quick and need no setup. Integration tests need a database to start and reset. End-to-end tests need the full system running, and usually take seconds each.

## Why the pyramid shape?

Draw unit tests as a wide base, integration tests above them, and end-to-end tests as a small tip. Three costs explain the shape.

- **Speed.** A thousand unit tests can finish in seconds. A thousand browser tests can take an hour, and a suite that slow stops being run before every commit.
- **Flakiness.** A test is **flaky** when it sometimes fails with no code change. End-to-end tests depend on timing, the network and shared test data, so they flake more often than a function call does. Once people learn that a red build is often noise, they stop trusting it.
- **Failure localization.** When a unit test fails, you know where to look. When the checkout test fails, the cause could be the page, the API, the database or the test environment, and you start by investigating.

The inverted shape, mostly end-to-end and manual tests with few unit tests, is Alister Scott's **ice-cream cone**. It often appears when testing happens mainly through the UI, for instance a QA team automating what it used to click by hand, or when legacy code is too tangled to unit test. It works at first, then decays into a slow, flaky suite that people skip.

## When another shape fits

The pyramid is a default, not a law. The **testing trophy**, Kent C. Dodds's shape popular in frontend circles, argues for a thick middle: static checks (type checking and linting) as its base, a few unit tests, mostly integration tests, and a few end-to-end tests. Its reasoning is that mock-heavy unit tests can pass while the real wiring is broken, like the mocked coupon lookup above. Where integration tests are cheap, because the database starts in a second or the components render in memory, the trophy is a good fit.

## What about other teams' services?

Suppose checkout calls a separate payments service owned by another team. You can't unit test your way to confidence, because you would be mocking the payments service, and your mock is only your guess about its behavior. Running a real payments service in every end-to-end test is slow and fragile.

A **contract test** sits between them. Your team writes down what it sends and what it expects back, for instance "POST `/charges` with an amount and a currency returns a charge id". The payments team runs that recorded expectation against its real service in its own build. If they change the response and break your expectation, their build fails before anything ships. Your own tests run against a stub generated from the same contract, so your mock stops being a guess. This is often called consumer-driven contract testing, because the caller defines the contract.

## Deciding what goes where

Ask the same two questions of any behavior, such as "a 10% coupon rounds correctly".

1. Can a unit test catch it? The rounding rule lives in one function, so yes. Write many unit tests here, including the odd cases such as zero, negative and very large totals.
2. If not, what is the cheapest test that can? A wrong lookup needs a real database, so use an integration test. A broken service boundary needs a contract test. Only a bug that exists in the assembled system, like the unwired button, needs an end-to-end test.

Then, reserve end-to-end tests for the few journeys that must never break, such as browse, add to cart, pay. When an end-to-end test finds a bug, fix it, then add a lower-level test that would have caught it, so the next one is cheaper.

**Rule of thumb.** Test each behavior at the lowest level that can catch its bug: many fast unit tests, integration tests where real components must meet, contract tests at service boundaries, and a handful of end-to-end tests for the journeys that must never break.
