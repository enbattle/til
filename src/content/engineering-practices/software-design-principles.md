---
title: Software Design Principles
summary: SoC, SOLID, KISS, DRY, YAGNI and TDD are short names for habits that keep code easy to change, and any of them does harm when applied by rote.
date: 2026-10-14
---

In code review you'll hear "keep it DRY" or "that's not YAGNI," each shorthand for a habit that keeps code easy to change. Say you run a small online shop, and checkout is one function (`stripe_api` stands for a card-payment provider's library):

```python
def checkout(cart, card_number, email, coupon):
    if not cart:
        raise ValueError("empty cart")
    total = sum(item.price * item.qty for item in cart)
    if coupon == "SALE":
        total = total * 0.9
    stripe_api.charge(card_number, total)          # take payment
    db.execute("INSERT INTO orders ...", total)    # save the order
    smtp.send(email, f"Thanks! You paid {total}")  # email a receipt
```

It works. Six habits answer three questions about it: where to cut code apart (SoC, then SOLID, its version for classes), how much to build (KISS and YAGNI say less, DRY says no copies), and in what order to work (TDD).

## SoC: Separation of Concerns

A **concern** is one job the program has to do, and `checkout` does five. Suppose marketing wants new receipt wording: you'd edit the function that charges cards, and a typo could break payments. So give each job its own function:

```python
def checkout(cart, card_number, email, coupon):
    validate(cart)
    total = price(cart, coupon)
    charge_card(card_number, total)
    save_order(cart, total)
    send_receipt(email, total)
```

The wording now lives in `send_receipt`, far from the card code. That is **Separation of Concerns** (SoC): each job in its own place, so you can change one without touching the others.

Next you want to test `checkout` without charging a real card.

## SOLID, one letter at a time

To test without a real card, payment becomes something `checkout` receives. A **class** bundles data with the functions that act on it, called **methods**:

```python
class CardPayment:
    def __init__(self, card_number):
        self.card_number = card_number

    def charge(self, amount):
        """Charge exactly `amount`, or raise an error."""
        stripe_api.charge(self.card_number, amount)

def checkout(cart, email, coupon, payment):
    validate(cart)
    total = price(cart, coupon)
    payment.charge(total)
    ...
```

`checkout` now relies on one promise: `payment` has a `charge(amount)` method that charges exactly that amount or raises an error. A list of methods a class promises to provide is an **interface**, and we'll call this one `Payment`. Any class that keeps the promise can stand in, including a fake in a test. Five rules, together called **SOLID**, guard that arrangement.

**Single responsibility.** Suppose `CardPayment` also sent the receipt email. It would change for two reasons, a new card provider and new receipt wording. Keep each class to one reason to change. This is SoC applied to one class.

**Open/closed.** The shop adds PayPal. If `checkout` contained `if method == "paypal"`, every new method would mean editing working code. Instead you write a `PayPalPayment` class with its own `charge`. Code should be open to extension and closed to edits.

**Liskov substitution.** Suppose `PayPalPayment.charge` quietly skipped amounts under 5 dollars. It has the method but breaks the promise, and `checkout` would ship unpaid orders. Anything claiming to be a `Payment` must keep the whole promise.

**Interface segregation.** Suppose `Payment` also required `save_card`. `checkout` never calls it, yet a store-credit payment has no card to save and would need a do-nothing stub. Code shouldn't have to depend on methods it doesn't use, so put `save_card` in a separate, smaller interface.

**Dependency inversion.** At first, `checkout` called Stripe directly. The rule: high-level code (what checkout does) should depend on an interface, not on low-level details (which library it calls). Now `checkout` and `CardPayment` both depend on `Payment`: `checkout` knows only the interface, and only `CardPayment` knows Stripe.

Passing the object in as a parameter is **dependency injection**, one technique for getting there. It is not the rule itself: code that builds a `CardPayment` inside `checkout` breaks the rule, while code that looks its payment up in a **registry**, a shared table of ready-made objects, keeps it.

So SOLID adds structure, and structure has a price.

## KISS: Keep It Simple, Stupid

Suppose you were tempted to replace the coupon `if` with a rules engine reading discount formulas from a config file. With one coupon, it is more code to read and debug than the line it replaces. **KISS** says to pick the simplest design that meets today's need.

## DRY: Don't Repeat Yourself

Simple doesn't mean copied, though. Say the cart page has its own copy of the sum and the 10% coupon. When the sale becomes 15%, someone updates checkout and forgets the cart page, and customers see one price and pay another.

**DRY**, from the book _The Pragmatic Programmer_, says each piece of knowledge should live in one place. These two copies hold the same knowledge, since the price shown must be the price charged. So make `price(cart, coupon)` the only place that knows the rule, and call it from both.

## YAGNI: You Aren't Gonna Need It

What about code for tomorrow? You might add currency conversion to `price` because "we'll sell abroad someday." **YAGNI**, from Extreme Programming (a method built around small, frequent releases), says not to build for a requirement you only imagine. If it never comes, you maintained unused code; if it does, the real need will likely differ from your guess. KISS asks for the simplest design for a need; YAGNI asks whether the need exists.

## TDD: Test-Driven Development

The last acronym is about order of work. Before raising the sale to 15%, you'd write a test that a 100-dollar cart with the coupon costs 85, watch it fail, change `price` until it passes, then tidy up. Working in that order, a small failing test first, is **TDD**. A test written first shows early when code is awkward to use, as the untestable `checkout` led to `Payment`. The [testing pyramid](/engineering-practices/testing-pyramid) covers which tests to write.

## Use them with judgment

Each of these can be overused. Suppose the receipt email and the confirmation page both format the total as money, and you merged them behind one shared helper. Next month the email needs plain text and the page needs local currency style. The helper grows true/false switches until it is harder to change than the two copies were. That merge broke KISS in the name of DRY: the copies looked alike but held different knowledge.

As Sandi Metz put it, "duplication is far cheaper than the wrong abstraction," an abstraction here being a shared helper like that one. When you can't yet tell whether two copies share a rule, wait for a third before extracting a helper.

**Rule of thumb.** Write the simplest code that meets today's need, with its test first. Add a split, an interface or a shared helper only when you can name the change or test it makes easier, and when you can't tell whether two copies share a rule, wait for a third.
