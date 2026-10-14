---
title: Software Design Principles
summary: SoC, SOLID, KISS, DRY, YAGNI and TDD are short names for habits that keep code easy to change, and any of them does harm when applied by rote.
date: 2026-10-14
---

You'll hear experienced developers say "keep it DRY" or "YAGNI" in code review. Each acronym names a habit that prevents one kind of code that is painful to change.

Say you run a small online shop, and checkout is one function. `stripe_api` stands for a card-payment provider's library:

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

It works. Now apply each principle to it.

## SoC: Separation of Concerns

A **concern** is one job the program has to do. `checkout` does five: it validates the cart, prices it, takes payment, saves the order and sends an email. **Separation of Concerns** says each job should live in its own section of code, so you can change one without touching the others.

Why does that matter here? Suppose marketing wants a new receipt wording. Today you edit the same function that charges cards, and a typo there could break payments. Split it up:

```python
def checkout(cart, card_number, email, coupon):
    validate(cart)
    total = price(cart, coupon)
    charge_card(card_number, total)
    save_order(cart, total)
    send_receipt(email, total)
```

Now the receipt wording lives in `send_receipt`, far from the card-charging code.

## SOLID: five rules for classes

Splitting functions is a start. **SOLID** is five rules, collected by Robert C. Martin, for the next level up: **classes**, which bundle data with the functions that act on it (called **methods**).

Say you want to test `checkout` without charging a real card. So payment becomes an object (one instance of a class) that `checkout` receives:

```python
class CardPayment:
    def __init__(self, card_number):
        self.card_number = card_number

    def charge(self, amount):
        stripe_api.charge(self.card_number, amount)

def checkout(cart, email, coupon, payment):
    validate(cart)
    total = price(cart, coupon)
    payment.charge(total)
    ...
```

`checkout` now relies on one promise: `payment` has a `charge(amount)` method. A promise like that is an **interface**, a list of methods a class agrees to provide. Any class that keeps it can stand in, including a fake one in a test. Call this one `Payment`. The five letters:

- **S, Single responsibility.** A class should have one reason to change. This is SoC applied to one class: `CardPayment` changes when the card provider does, never when the receipt does.
- **O, Open/closed.** Code should be open to extension (new behavior added as new code) without edits to code that already works. When the shop adds PayPal, you write a `PayPalPayment` class with its own `charge`, and `checkout` doesn't change.
- **L, Liskov substitution.** Anything that claims to be a `Payment` must behave like one. If `PayPalPayment.charge` quietly skipped small amounts, `checkout` would ship unpaid orders.
- **I, Interface segregation.** Code shouldn't have to depend on methods it doesn't use. If `Payment` also required `save_card`, `checkout` would depend on a method it never calls, and cash on delivery would need a fake one. Put `save_card` in a separate, smaller interface.
- **D, Dependency inversion.** High-level code (what checkout does) shouldn't depend on low-level details (which payment library it calls); both should depend on an interface. `checkout` knows only `Payment`, and only `CardPayment` knows about Stripe. Handing the object in as a parameter is called **dependency injection**, the usual way to apply this rule.

## KISS: Keep It Simple, Stupid

SOLID adds structure, so the next acronym is the brake. **KISS** says to pick the simplest design that meets today's need. Suppose you were tempted to replace the coupon `if` with a rules engine that reads discount formulas from a config file. With one coupon, that engine is more code to read, test and debug than the line it replaces.

## DRY: Don't Repeat Yourself

Simple doesn't mean copied, though. Say the cart page computes the total with its own copy of the sum and the 10% coupon. When the sale becomes 15%, someone updates checkout and forgets the cart page, and customers see one price and pay another. **DRY**, from the book _The Pragmatic Programmer_, says each piece of knowledge should live in one place. Make `price(cart, coupon)` the only place that knows the rule, and call it from both.

## YAGNI: You Aren't Gonna Need It

What about code for tomorrow? You might think "we'll sell in other countries someday" and add currency conversion to `price`. **YAGNI**, from Extreme Programming (a development method built around small, frequent releases), says not to build for a requirement you only imagine. If that day never comes, you maintained unused code for nothing; if it comes, the real requirements will likely differ from your guess. Where KISS asks for the simplest design for a need, YAGNI asks whether the need exists at all.

## TDD: Test-Driven Development

The last acronym is about order of work. In **TDD**, you write a small failing test for the behavior you want, write just enough code to pass it, then tidy up. Before raising the sale to 15%, you'd write a test that a 100-dollar cart with the coupon costs 85, watch it fail, then change the code. Writing the test first makes you call your code before it exists, which shows early when it is awkward to use, the way a `checkout` you couldn't test without a real card led to the `Payment` interface. The [testing pyramid](/engineering-practices/testing-pyramid) covers which kinds of test to write.

## Use them with judgment

Each of these can be overused. Suppose the receipt email and the order confirmation page both format the total as money, and you merged them behind one shared helper. Next month the email needs plain text and the page needs the customer's local currency style. The helper grows an extra true/false parameter to switch behavior, then another, until it is harder to change than the two copies were. That merge broke KISS in the name of DRY: the copies looked alike but held different knowledge. Sandi Metz put it as "duplication is far cheaper than the wrong abstraction," an abstraction being shared code like that helper. When you can't yet tell whether two copies share a rule, a common habit is to wait for a third before extracting a helper.

**Rule of thumb.** Keep code simple and build only what today needs. Add structure, such as a split, an interface or a shared helper, when you can point to the change or test it makes easier, and write the test before you make that change.
