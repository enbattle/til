# Content-review scenarios

Each scenario is a fully fabricated draft topic or case study —
frontmatter and body, exactly as if it were about to be added via its skill — with
**exactly one** deliberately planted problem. These drafts are fixtures
for this eval only: never write them into `src/content/`. Give a
scenario's draft, verbatim, to a fresh reviewer agent along with
the real Stage 3 instruction from `docs/content-review.md`, filled in for
the draft's skill (built fresh at run time), and record
whether the review actually catches the planted problem. The
`content-review-eval` skill has the full procedure and grading, and
`../README.md` this repo's general eval philosophy.

Each scenario names the **section** the draft claims to belong to, so a
real run can glob that section's current sibling topics for the
near-duplicate check the same way a real `add-topic` review would.

`CR-*` scenarios test `add-topic`'s review. The `CS-*` scenarios after them
test `add-case-study`'s review the same way, with a case-study draft instead.

---

### CR-01 — undefined jargon (trap for "define terms before using them")

<!-- premise: src/content/systems-and-infrastructure/bloom-filters.md missing -->
<!-- premise: src/content/systems-and-infrastructure/bloom-filter.md missing -->

**Section:** `systems-and-infrastructure`, where a data structure belongs (a
reviewer rightly flagged the earlier `engineering-practices` placement on
2026-10-06). Until then the draft avoided this section because its closing
"Where you'll meet this" rule drew real findings that outranked the planted
one on 2026-09-24; the draft now ends with that section, naming only systems
from docs/content.md's fixed set, so the section's rules are met.
**Planted violation (the only one; the rest of the draft was corrected on
2026-09-24, and brought to the Writing Standard's Teaching progression rules on
2026-10-15, so this one stands out):** never defines "hash function" before
relying on it as load-bearing vocabulary — a reader with zero background has no way
to know what "hash the item" actually means or why multiple hashes are
used.

````markdown
---
title: Bloom Filters
summary: A space-efficient way to check "definitely not present" instantly, at the cost of occasional false positives.
date: 2026-09-16
---

Say you run a sign-up page, and as someone types a username you check whether
it's already taken. You have 10 million accounts, and each check is a database
query that takes a few milliseconds. Most names people try are new, so most of
those queries come back empty. Could you skip the empty ones?

This page starts with the obvious fix and where it breaks, builds the structure
that replaces it, works out how often that structure is wrong and how big it
must be, and ends with what it can't do.

## Keep every name in memory?

The obvious fix is to hold the whole set of usernames in the app server's
memory and check it before the database. A name that isn't in the set is free,
with no query at all.

It works, but it is big. A name takes 10 to 20 bytes, and a typical in-memory
set adds about 40 to 80 bytes of bookkeeping for each entry:

```text
10,000,000 names × 50 to 100 bytes = 500 MB to 1 GB
```

That is a lot of memory for one check, and it grows with every sign-up. The
question only needs a yes or a no, so storing every name is more than it asks
for.

## A smaller answer: the Bloom filter

Suppose you keep far less than the names, and accept being wrong in one
direction only. A small structure in memory answers "could this name already
exist?" with one of two answers. "Definitely not" is always right, so you tell
the user the name is free without touching the database. "Possibly" can be
wrong, so you go and ask the database.

That structure is a **Bloom filter**. It never wrongly says no, but it
sometimes wrongly says yes, and a wrong yes is called a **false positive**.

The filter is a **bit array**: a long row of bits, each 0 or 1, all 0 to start.
Ours has 100 million of them:

```text
100,000,000 bits ÷ 8 bits a byte = 12,500,000 bytes = 12.5 MB
```

To add a username, you hash the name with several different hash functions,
say seven, and each one gives you a position in the array. You set those seven
bits to 1. Adding `alice` might set bits 3, 41206, 9880112 and four others.
Each new account goes in as it's created, and existing ones are added when the
filter is built.

To check a name, you hash it the same way and look at the same seven positions.
If any of them is 0, the name was never added, because adding it would have set
that bit. If all seven are 1, the name was probably added.

Why only "probably"? Because the bits are shared. Ten million names have each
set seven bits, and a name nobody has registered can land on seven bits that
other names happened to set. The filter says "possibly," you query the
database, and it comes back empty.

That wasted query is the whole cost of a false positive. The database still has
the last word, so a wrong "possibly" never reaches the user. So: a 0 anywhere
proves the name is absent, and all 1s only suggest it's present. How often does
that suggestion mislead?

## How wrong, and how big?

It depends on the bits per name and the number of hash functions. Ours has 100
million bits for 10 million names, 10 bits each. With k hash functions, m bits
and n names, the chance that an unused name finds all its bits set is about
(1 − e^(−kn/m))^k:

```text
kn/m       = 7 × 10,000,000 ÷ 100,000,000 = 0.7
e^(−0.7)   ≈ 0.497, so 1 − 0.497 = 0.503
0.503^7    ≈ 0.0082, about 1 in 120
```

Under 1% of checks for a free name waste a query.

Why seven, and not one or fifty? Too few, and each name marks only a bit or
two, so an unused name has to match very little to slip through. Too many, and
the array fills with 1s and nearly everything matches. The best count is about
0.7 times the bits per name, which for our 10 bits is seven.

Squeeze the same 10 million names into half the memory, 5 bits each, and the
best count drops to 0.7 × 5 ≈ 3:

```text
kn/m       = 3 × 10,000,000 ÷ 50,000,000 = 0.6
e^(−0.6)   ≈ 0.549, so 1 − 0.549 = 0.451
0.451^3    ≈ 0.092, about 1 in 11
```

Set against the exact set of names, that is 12.5 MB instead of 500 MB to 1 GB,
paid for with one wasted query in 120 checks of a free name. The saving comes from never storing the
names, and so do the filter's limits.

## What it can't do

Since it never stored the names, a Bloom filter can't list them. It also can't
forget one. When a user deletes their account, clearing their seven bits could
clear a bit that another name relies on, and the filter would start saying
"definitely not" about a name that exists. That is the one mistake it promised
never to make, so a standard filter only grows. If you need deletes, a variant
called a **counting Bloom filter** keeps a small counter at each position
instead of a single bit, at several times the memory.

It also gets worse as it fills. Put 20 million names in the same array:

```text
kn/m       = 7 × 20,000,000 ÷ 100,000,000 = 1.4
e^(−1.4)   ≈ 0.247, so 1 − 0.247 = 0.753
0.753^7    ≈ 0.14, about 1 in 7
```

That is about 17 times the 1 in 120 it started at. Size the filter for the
count you expect, and rebuild it bigger when the sign-ups head past that.

**Rule of thumb.** Put a Bloom filter in front of a slow lookup when most
queries are for things that aren't there, the exact set is too big to keep in
memory, and an occasional wasted lookup is acceptable.

## Where you'll meet this

A URL shortener that generates random short codes can keep a filter of every
code issued, so most new codes, which are unused, skip the lookup for a clash. A
notification pipeline can keep one of message IDs already sent, and look up
only the "possibly" answers before dropping a duplicate.
````

**Expected finding:** flags that "hash function" (and "hash the item")
is used as load-bearing vocabulary without ever being defined — a reader
with no prior background has no way to know what happens when you "hash"
something or why a bit position results from it.
**Fails if:** the review says nothing worth flagging, or flags something
else instead (e.g. a style nitpick) without ever naming the missing
definition.

---

### CR-02 — AI-patterned tone

<!-- premise: src/content/engineering-practices/feature-flags.md missing -->
<!-- premise: src/content/engineering-practices/feature-flag.md missing -->

**Section:** `engineering-practices`
**Planted violation:** a stock "not just X — it's Y" closer, filler
intensifiers stacked without adding information, and a bullet list where
every single item follows an identical bolded-lead-in-plus-dash rhythm
with zero variation.

````markdown
---
title: Feature Flags
summary: A way to ship code to production without releasing it to users yet, decoupling deploy from release.
date: 2026-09-16
---

Say your team sells concert tickets online, and you're rebuilding the checkout
page. The new version will take three weeks. Meanwhile everyone else keeps
merging into the main line of the code's history, the **trunk**, and the
trunk is deployed to production, the servers customers use, every day. What
do you do with three weeks of half-finished checkout code?

You could keep it on a separate **branch**, your own copy of the history, until
it's done. But for three weeks the trunk moves on without you, and on the day
you merge, you're reconciling three weeks of everyone else's changes with
yours, under pressure, in the most important page on the site. You'd rather
merge small pieces every day. Doing that without showing customers a
half-built checkout is what feature flags are for.

## A conditional you can change at runtime

A feature flag is a conditional check in your code that decides whether
a piece of functionality is active, controlled by a value you can change
without redeploying — usually a config service (a small internal service
your servers read settings from), a database row, or a third-party flag
provider (a company that hosts the flags for you). This genuinely, actually decouples two things
that normally happen together: deploying code (getting it onto
production servers) and releasing a feature (making it visible to
users).

In the checkout code, it looks like this:

```js
if (flags.isOn('new-checkout', user)) {
  renderNewCheckout(cart);
} else {
  renderOldCheckout(cart);
}
```
````

Your team merges new-checkout work into the trunk every day, and it's deployed
every day, but `new-checkout` is off, so customers keep seeing the old page.
The new code is in production and nobody can reach it yet.

Why pass `user` in? Because the flag doesn't have to be all-or-nothing. The
flag service stores a rule, such as "on for staff accounts" or "on for 1% of
customers." For a percentage, it turns each user's ID into a number from 0 to
99 and switches the flag on for users below 1. The same user always gets the
same number, so a customer doesn't flip between checkouts on every page load.

That split unlocks a few real, actually useful patterns:

- **Gradual rollout**: turn a flag on for 1% of users, watch metrics,
  then dial it up — catching a bad change before it reaches everyone.
- **Kill switch**: turn a risky feature off instantly if it's causing
  problems, without waiting on a redeploy of the old version.
- **A/B testing**: show two different flag states to two user segments
  and compare outcomes.
- **Trunk-based development**: merge unfinished work behind a flag so
  it's off in production, avoiding long-lived feature branches.

## Rolling out the new checkout

When the new checkout is finished, you turn it on for staff first and buy
tickets yourselves. Then 1% of customers. You watch the completed-purchase
rate on the dashboard. Suppose it drops for that 1%: a payment button doesn't
respond on one older browser. You switch the flag off, and within seconds to
a minute, depending on how the flag service pushes changes, every customer is back on the old checkout. There's no emergency redeploy of
the previous version, which would also undo every other change that went out
with it. You fix the button, and try 1% again, then 10%, then everyone.

## What flags cost

So why not put everything behind a flag? Because every flag is an `if` with
two sides, and both sides have to keep working. While `new-checkout` exists,
you have two checkouts to test and maintain. Add a flag for the new search and
one for the new cart, and three flags that can each be on or off already make
eight combinations to test, and each new flag doubles that.

That's why it helps to sort flags by how long they're meant to live. A
**release flag**, like `new-checkout`, exists only to roll out one change: once
the new checkout is on for everyone, you delete the flag and the old checkout
code with it. A long-lived flag stays on purpose, such as a kill switch around
a feature that leans on a slow outside service. Release flags that nobody
deletes are where flags go wrong. A year later, nobody remembers whether
turning one off is safe.

It's not just a toggle in your code — it's a deployment strategy in
disguise, letting you separate "is this code live" from "is this code
visible" as two genuinely independent questions. That's the real power
of feature flags.

**Rule of thumb.** Put a change behind a flag when you want to be able to
turn it off without a deploy, and remove a release flag once it's fully rolled out.

`````

**Expected finding:** flags the "not just X — it's Y" closer, the
stacked filler intensifiers ("genuinely, actually," "real, actually
useful"), and the bullet list's mechanically identical rhythm across
every item, as reading like generically AI-patterned prose rather than
something a knowledgeable person actually wrote.
**Fails if:** the review says nothing worth flagging, or only catches
one of the three tells without naming the pattern as a tone problem.

---

### CR-03 — over-explained figurative language

<!-- premise: src/content/engineering-practices/rubber-duck-debugging.md missing -->

**Section:** `engineering-practices`
**Planted violation:** introduces "rubber duck debugging" casually and
correctly, then spends a passage literally defending the term against a
misreading no reader would actually have.

````markdown
---
title: Rubber Duck Debugging
summary: Explaining your code line-by-line to an inanimate object, so the act of articulating it out loud surfaces the bug yourself.
date: 2026-09-16
---

Say you've written a small function for a recipe site that averages a recipe's
star ratings:

```python
def average_rating(ratings):
    total = 0
    for i in range(1, len(ratings)):
        total += ratings[i]
    return total / len(ratings)
```

A recipe rated 5, 3 and 4 should average 4.0. Yours shows 2.33. You've read
the function five times and it looks fine every time. What now?

Rubber duck debugging is explaining your code, out loud, line by line,
to something that can't talk back — traditionally a rubber duck sitting
on your desk. Partway through the explanation, you frequently spot the
bug yourself, before your listener says a word.

The name comes from _The Pragmatic Programmer_, a 1999 book by Andrew Hunt
and David Thomas, which tells of a programmer who carried a rubber duck around
and debugged by explaining code to it.

## Trying it on the average

So you pick up the duck and start talking. "`total` starts at zero. Then for
each position in the list, I add the rating at that position to the total."
Which positions, exactly? You have to say it out loud. "From `range(1,
len(ratings))`, so position 1, then 2." And there it is: Python numbers list
positions from 0, so the rating at position 0, the 5, never gets added. The
loop sums 3 and 4, gets 7, and divides by 3.

Nothing about the code changed between your fifth silent reading and your
first spoken one. What changed is that you had to say what each line does,
in order, in words specific enough to be wrong.

## Why explaining finds what reading misses

It works because the bug is usually already visible to you; you just
haven't been forced to slow down and state your assumptions explicitly.
When you reread your own code, you read what you meant to write. Your eye
lands on the loop, you recognize "add up the ratings," and you move on.
Explaining it to someone who knows nothing takes that shortcut away. You
can't say "and here it adds them up"; you have to say which ones. That
forces you to commit to what each line is _supposed_ to do, out loud, in
order, which is exactly the step most silent debugging skips.

To be clear, the duck itself has no debugging ability and doesn't need
to be a literal rubber duck — a real duck isn't required, and neither is
any object at all, technically; a photo, a plant, or a patient colleague
works identically, since the mechanism was never about the duck having
any special property, biological or otherwise. The point isn't the duck;
it's forcing verbalization.

## Doing it well

Does it matter how you explain? It does. Explain the code you have, line by
line, rather than the plan in your head. The plan was right; the code is where
the bug is. In the ratings function, "it averages the ratings" is the plan,
and it's true of the function you meant to write. "It loops from 1" is the
code, and it's where the 5 went missing.

Say what you expect at each step, with real values. "With 5, 3 and 4, after
the loop, `total` should be 12." When you can't predict a value, that's the
line to print the value at and look.

Writing works too. Many programmers have drafted a long question to a
colleague, described the function, what it should return and what it returns
instead, and found the bug before sending it. The question has to make sense
to someone with none of your context, which is the same constraint the duck
imposes.

## When the duck can't help

So when should you stop talking and ask a person? When the bug isn't in your
code's logic but in something you don't know. Suppose `average_rating` were
fixed and a popular recipe still showed the wrong average, because the library
that loads ratings returns only the first 20 unless you ask for more. You
could explain your code perfectly and never find it, because your explanation
would repeat the same wrong assumption. Talking through your code checks your
reasoning against your code. It can't check it against facts you don't have.

That's where a colleague earns their place over the duck. In **pair
programming**, two people write code together at one machine, one typing and
one reviewing as they go. Your pair plays the duck's role, since you're
explaining as you go anyway, and can also ask a follow-up question or point out
the fact you were missing.

**Rule of thumb.** When you're stuck, explain the code aloud, line by line,
before asking anyone for help.
`````

**Expected finding:** flags the paragraph that opens "To be clear, the duck
itself has no debugging ability" as over-explaining a
casual, widely-understood figurative term — defending "rubber duck
debugging" against a literal misreading ("the duck itself has no
debugging ability... biological or otherwise") that no reader would
actually have, instead of trusting the phrase to land.
**Fails if:** the review says nothing worth flagging, or flags the
metaphor's presence itself rather than its over-explanation.

---

### CR-04 — unverified/inaccurate technical claim

<!-- premise: src/content/ai-and-ml/temperature-and-sampling.md missing -->
<!-- premise: src/content/ai-and-ml/llm-temperature.md missing -->
<!-- premise: src/content/ai-and-ml/sampling.md missing -->

**Section:** `ai-and-ml`
**Planted violation:** states, confidently and without qualification,
that temperature 0 makes LLM output "fully deterministic on any
provider" — a claim that's oversimplified to the point of being wrong in
practice (GPU floating-point non-determinism, batching effects, and
mixture-of-experts routing mean most providers don't actually guarantee
bit-for-bit reproducibility at temperature 0, and several providers
document this explicitly).

```markdown
---
title: Temperature and Sampling in LLM Output
summary: How temperature and top-p shape which token an LLM picks next, and why "temperature 0" doesn't mean what people assume.
date: 2026-09-16
---

Ask a large language model (LLM), the kind of model behind a chatbot, to
finish the sentence "My favorite fruit is" twice, and you may get "apple" once
and "mango" the next time. Why would the same model, given the same words,
answer differently? Because it doesn't pick its answer outright. It weighs the
options and then draws one, and two settings, temperature and top-p, decide
how that draw works.

## A distribution, then a draw

An LLM writes text one **token** at a time, where a token is a chunk of text:
a short word, or a piece of a longer one. The model has a fixed **vocabulary**
of every token it knows, typically tens of thousands to a couple of hundred
thousand of them.

At the end of "My favorite fruit is", the model gives you a probability for
every token in its vocabulary, and they add up to 1; that full list is a
**probability distribution**. Your next token comes from **sampling** it:
drawing one token at random, weighted by those probabilities, so a token at
0.3 comes up about three times in ten.

Suppose that, to keep the arithmetic small, the model's whole distribution
after "My favorite fruit is" falls on four tokens:

| Token  | Probability |
| ------ | ----------- |
| apple  | 0.50        |
| mango  | 0.30        |
| banana | 0.15        |
| kiwi   | 0.05        |

Sampling from this picks "apple" half the time, "mango" 30% of the time, and
"kiwi" once in twenty tries. That's why your two runs differed.

## Temperature reshapes the distribution

Temperature is a number you set on the request, and it reshapes the fruit
table before the draw, deciding how strongly the odds lean toward apple. Each
probability is raised to the power 1/temperature, and the results are rescaled
to add up to 1 again. At temperature 1, nothing changes.

What happens at 0.5? Each probability is squared. Apple's 0.50 becomes 0.25
and kiwi's 0.05 becomes 0.0025, a hundred times smaller, where before it was
ten times smaller. After rescaling, apple is about 0.68, mango 0.25, banana
0.06 and kiwi under 0.01. The favorite gets more favored.

And at 2? Each probability is replaced by its square root, which pulls them
together: apple about 0.38, mango 0.29, banana 0.21, kiwi 0.12. Kiwi now comes
up more than one time in ten.

So a low temperature shifts probability toward the top candidate, and near 0
it is almost always picked, while a high temperature flattens the distribution so
less-likely tokens get picked more often, producing more varied (and more
error-prone) output. For a fruit, variety is harmless. For the next token of a
date or a line of code, an unlikely token is usually a wrong one.

## Top-p trims the shortlist

Top-p, also called **nucleus sampling**, is a second setting you can pass,
and it shortens the list you draw from instead of changing the odds. You pick
a threshold p, keep the most likely tokens until their probabilities add up to
at least p, and draw only from that shortlist.

Take the fruit table at temperature 1 and p = 0.9. Go down the list, adding up
as you go: apple brings the total to 0.50, mango to 0.80, banana to 0.95. That
crosses 0.9, so the shortlist is apple, mango and banana. Kiwi can't be picked
at all. The three survivors are rescaled to add up to 1 (apple about 0.53,
mango 0.32, banana 0.16), and the draw happens among them.

How is that different from a low temperature? Temperature changes the odds of
every token but rules none out. Top-p leaves the odds among the shortlisted
tokens in proportion and cuts off the long tail of unlikely ones, which in a
real vocabulary means many thousands of tokens that each have a tiny chance.
Both can be set on the same request; in most implementations temperature
reshapes the distribution first and top-p trims it after. Some providers
recommend adjusting one and leaving the other at its default, since both
control how varied the output is.

## Temperature 0

What about turning temperature all the way down? Raising to the power 1/0
isn't defined, so implementations treat temperature 0 as a special case: skip
the draw and take the most likely token, which for our fruit is apple.

Setting temperature to 0 makes an LLM's output fully deterministic on
any provider, since it always just picks the single highest-probability
token every time with no other source of randomness. This makes
temperature 0 the right setting whenever you need the exact same output
for the exact same input, such as automated testing or caching model
responses.

**Rule of thumb.** Lower the temperature when you want focused, predictable
answers, and raise it when you want variety.
```

**Expected finding:** flags the temperature-0-determinism claim as
oversimplified/inaccurate — in practice, most providers' infrastructure
(floating-point non-associativity across parallelized GPU batches,
mixture-of-experts routing that depends on what else is in a batch, etc.)
means temperature 0 is only "mostly" or "usually" deterministic, not
guaranteed bit-for-bit reproducible, and several providers document this
caveat explicitly rather than promising true determinism.
**Fails if:** the review says nothing worth flagging on this claim, or
only raises an unrelated concern without questioning the determinism
claim itself.

---

### CR-05 — clean baseline (false-positive control)

<!-- premise: src/content/engineering-practices/semantic-versioning.md missing -->
<!-- premise: src/content/engineering-practices/semver.md missing -->

**Section:** `engineering-practices`
**Planted violation:** none — this is a control. The draft defines its
terms, builds up from first principles, uses a concrete example, and
makes no unverified claims. The eval here is whether the review
reports only things that are true of the text, rather than inventing a
defect to justify itself. It is declared under `engineering-practices`, and
no topic in any section covers versioning or dependency updates, so the
near-duplicate check has nothing to match and the closing "Where you'll meet
this" rule for `systems-and-infrastructure` topics doesn't apply; the subject
matter is not what this scenario tests. Until 2026-09-28 the control was a
"Liveness vs. Readiness Probes" draft, which every run from 2026-09-21 on
rightly called a near-duplicate of `self-healing-systems` (same distinction,
same cache warm-up example), so the control moved to this subject.
Its claims follow the Semantic Versioning 2.0.0 specification (semver.org:
the reset rule, `0.y.z` as initial development where anything may change) and
npm's documentation: the caret and tilde ranges, including the caret's
leftmost-nonzero rule below `1.0.0` (`^0.3.1` is `>=0.3.1 <0.4.0`, `^0.0.3`
is `>=0.0.3 <0.0.4`); the default `^` save prefix; `package-lock.json`,
written by default since npm 5, which a plain `npm install` follows while it
still satisfies `package.json`; `npm ci` removing `node_modules`, erroring
when the lockfile and `package.json` disagree, and never writing either file;
and `npm update` moving packages to the newest version their ranges allow.
Python's version scheme is PEP 440, not SemVer.

```markdown
---
title: Semantic Versioning
summary: What the three numbers in a version like 2.4.1 promise, and how a package manager (for example, npm) relies on that promise to decide which updates to install without asking.
date: 2026-09-28
---

Most projects are built on **dependencies**: libraries, meaning code someone
else wrote and published, that your project calls. A **package manager**
such as npm, for JavaScript, downloads them for you. Say
your project formats dates with a small library, call it `datelib`, at version
`1.4.2`. Its authors keep publishing new versions, and every time they do you
face the same question: can I take this update without anything breaking? A
version number can't answer that on its own, unless the library's authors have
agreed on what the numbers mean.

## What the three numbers promise

Semantic Versioning, or SemVer, is that agreement, written down as a
short specification at semver.org (the current version is 2.0.0). A version
has three parts, `MAJOR.MINOR.PATCH`, and each one is a promise about the library's
**public API**: the functions, options and behavior its authors document for
other people to use, as opposed to the internals they're free to rewrite.
Compared with the release before it:

- PATCH goes up for a bug fix that leaves the API as it was.
- MINOR goes up when something is added, such as a new function or option,
  and everything that already existed works as before.
- MAJOR goes up for any change that isn't backward compatible, meaning code
  written against the previous version could stop working: something removed
  or renamed, or documented behavior changed.

Raising one number resets the numbers to its right to zero, so the release
after `1.4.2` is `1.4.3`, `1.5.0` or `2.0.0`.

Watch `datelib` go through all three. Its `formatDate` function prints the
wrong month for December dates; the fix ships as `1.4.3`. Next, the authors
add `formatRelative`, which turns a date into text like "3 days ago". Nothing
that existed changed, so that's `1.5.0`. Then they rename `formatDate` to
`format` and drop the old name. Your project calls `formatDate`, so it would
now fail, and that release has to be `2.0.0`.

What about versions below `1.0.0`? The specification treats `0.y.z` as initial
development, where anything may change at any time, and `1.0.0` is the release
where the authors commit to a public API.

## How npm uses it

A JavaScript project lists its dependencies in a
`package.json` file at its root, and because the numbers carry meaning, it can
say which versions of each it accepts, a **version range**, instead of
**pinning** one, that is, naming a single exact version such as `1.4.2`.

Your `package.json` might say `"datelib": "^1.4.2"`. The caret accepts
anything from `1.4.2` up to but not including `2.0.0`: the December fix and
`formatRelative`, but not the rename that would break your calls. `~1.4.2` (a
tilde) is stricter and accepts only patches, from `1.4.2` up to but not
including `1.5.0`, so `1.4.3` but not `1.5.0`. When you add a package with
`npm install <name>`, npm records it with a caret by default.

Below `1.0.0`, where the specification promises nothing, npm adds a convention
of its own: the caret treats a change to the leftmost nonzero number as
breaking. Had `datelib` still been at `0.3.1`, `^0.3.1` would accept later
`0.3` patches but not `0.4.0`, and `^0.0.3` accepts only `0.0.3` itself.

## Why ranges aren't enough

With ranges alone, every install
resolves them again, usually to the newest version each one accepts. Install
the day `1.4.3` comes out and you get `1.4.3`; a teammate who installs a week
later, after `1.5.0` is out, gets `1.5.0`. Two machines now run different code.

And the promise is only as good as the people making it. If your code had
worked around the December bug by correcting the month itself, the `1.4.3`
fix breaks your dates, patch or not. Authors also sometimes misjudge what
counts as breaking.

So npm also writes a **lockfile**, `package-lock.json`, recording the exact
version of every package it installed, including the dependencies of your
dependencies. Your lockfile says `datelib` is `1.4.3`. With it committed, your
teammate's plain `npm install` installs `1.4.3` too, as long as it still
satisfies the range in `package.json`. `npm ci`, meant for automated builds, is
stricter: it deletes any installed packages (the `node_modules` folder) first,
fails if the lockfile and `package.json` disagree, and never rewrites the
lockfile.

## Taking an update on purpose

How does `datelib` ever move, then? Someone changes the lockfile. Running
`npm update` moves each package to the newest version its range allows, so
`datelib` goes to `1.5.0`, never `2.0.0`. Installing a specific version with
`npm install <name>@<version>` works too. To take `2.0.0`, you edit the range
to `^2.0.0`, rename your `formatDate` calls, and reinstall (the locked version
only moves if it no longer fits the new range). Dependency bots such as
Dependabot open pull requests (proposed changes for someone to review) that
change the range and the lockfile for you; fixing the calls is still yours.

Each route shows up as a change to `package-lock.json`, so an upgrade becomes a
deliberate change that can be reviewed and tested like any other, instead of
something that arrives unnoticed on the next install.

**Rule of thumb.** Let version ranges say which updates you'd accept, and
commit the lockfile so you choose when to take them.
```

**Expected finding:** no finding that is false of the text. A thorough
reviewer will usually still raise real gaps in any draft (a missing
worked example, a nearby topic that overlaps, whether the subject fits
the section); those are acceptable and are recorded in the run's notes,
not graded as failures. A literal "nothing to flag" bar would punish
exactly the rigor the review is supposed to have, and every run from
2026-09-16 to 2026-09-28 (all on the earlier probes draft) produced real
findings on this control.
**Fails if:** the review reports a defect that isn't true of the draft: a
fabricated claim, a misreading of what the text says, or a correct
technical statement called wrong (for example, calling the caret's
narrower `0.y.z` range, `^0.0.3` matching only `0.0.3`, a plain `npm install`
following the lockfile, or a bug fix shipping as a patch, an error).

---

### CR-06 — a paragraph that names four terms at once (trap for "Teaching progression")

<!-- premise: src/content/computing-fundamentals/regular-expressions.md missing -->
<!-- premise: src/content/engineering-practices/regular-expressions.md missing -->

**Section:** `computing-fundamentals`.
**Planted violation (the only one; the draft otherwise follows every
Teaching progression rule: a route sentence, describe-then-name, worked
arithmetic, stage transitions and a one-line restatement):** the paragraph
opening "A regex is built from a few kinds of piece" introduces four terms the
page teaches (character class, quantifier, anchor, group) at once, each
defined in a parenthesis inside one long sentence. The audit of 2026-10-14
found this the most common reason a beginner gets lost.

````markdown
---
title: Regular Expressions
summary: A regular expression is a short pattern that checks text, and the same tool that validates a ZIP code instantly can, written carelessly, take seconds.
date: 2026-10-14
---

Say your sign-up form asks for a US ZIP code. Valid input is five digits, like `90210`, or five digits, a dash and four more, like `90210-1234`. How do you check that in one line instead of twenty lines of character-by-character code?

A **regular expression**, or regex, is the usual answer: a short pattern that describes what valid text looks like, which a library checks for you. This page builds the ZIP pattern piece by piece, shows how a careless version of it can freeze a server, and shows how to write one that can't.

## Matching one character at a time

The simplest regex is plain text. The pattern `90210` matches the characters `9`, `0`, `2`, `1`, `0`, in that order.

That works for one ZIP code. There are tens of thousands of them, so you need a way to say "any digit" instead of one particular digit.

## The ZIP code pattern

A regex is built from a few kinds of piece: a **character class** (a set of characters in square brackets, any one of which matches, like `[0-9]`), a **quantifier** (a count written after a piece, like `{5}` for exactly five), an **anchor** (`^` for the start of the text, `$` for the end) and a **group** (parentheses that treat several pieces as one unit, which a `?` after it makes optional), and together they give `^[0-9]{5}(-[0-9]{4})?$`.

Read it left to right against `90210-1234`. The `^` pins the match to the start. `[0-9]{5}` takes `90210`. The group takes `-1234`, and `$` confirms nothing is left over. Against `90210`, the group finds no dash, and the `?` lets it match nothing instead.

Why the anchors? Without them, the library looks for the pattern anywhere inside the text. `[0-9]{5}` alone would accept `abc90210xyz`, because five digits appear somewhere inside it.

So the full pattern says: start, five digits, optionally a dash and four digits, end.

That handles every valid ZIP code. The trouble starts when a pattern gives the library more than one way to match the same text.

## When a pattern has choices

Most regex libraries match by trying one way and, when it fails, going back to try the next. Going back like this is called **backtracking**. The ZIP pattern has at most two ways to try, with the dash part or without it, so a check finishes almost at once.

Now suppose someone loosens the field so users can type a dash anywhere. A `+` after a piece means "one or more of it", so they write `^([0-9]+-?)+$`: one or more groups, each made of digits and an optional dash. It accepts every valid ZIP code, plus looser input like `90-210`, but it hides a choice. Feed it 26 digits followed by a `!`. The `!` makes every attempt fail, but the library can't know that until it has tried every way of splitting the digits into groups, and each extra digit doubles the number of ways. Between 26 digits there are 25 gaps, and each gap either splits two groups or doesn't, so there are 2 × 2 × … 25 times over:

```
11 digits: 2^10 ≈ 1,000 ways
21 digits: 2^20 ≈ 1,000,000 ways
26 digits: 2^25 ≈ 33,500,000 ways
```

Each way costs at least one step. At 100 million steps a second:

```
33,500,000 ÷ 100,000,000 ≈ 0.34 seconds
```

That is a third of a second for one check of one short string. Five more digits double it five more times:

```
2^30 ÷ 2^25 = 32
0.34 seconds × 32 ≈ 11 seconds
```

This blow-up is called **catastrophic backtracking**. When the input comes from users, one crafted string can tie up a server for seconds.

An attack built on it is called ReDoS, regular-expression denial of service: making a service too busy to answer anyone else.

So a pattern turns slow when the same text can be split many ways: the work can grow explosively, here doubling with every character. How do you keep that choice out?

## Avoiding it

The fix is to make sure any text can be matched only one way. The strict ZIP pattern already does. If you want looser input, write `^[0-9]+(-[0-9]+)*$`: every group after the first must start with a dash, so a run of digits can't be split two ways. (It also rejects a trailing dash, which is no loss.) Now the `!` is rejected after about one try per digit. In general, look for a repetition whose pieces could match the same text more than one way, and make each piece start with something only it can match.

Two other defenses help. Cap the input's length before matching: a ZIP field never needs more than 10 characters. And some regex libraries, such as Go's standard one and Google's RE2, never backtrack, so their time grows in step with the input's length instead of doubling with each character. They give up a few rarely needed features to get there.

One catch with anchors. In Python, Java and PHP, `$` also matches just before a final newline, so `90210` followed by a newline passes, and in Ruby `^` and `$` match at every line break. To validate a whole input, use the whole-string match your language offers, such as Python's `re.fullmatch` or Ruby's `\A` and `\z`.

**Rule of thumb.** Match the whole input, cap its length, and never let a repeated piece match the same text in more than one way.
````

**Expected finding:** flags the "A regex is built from a few kinds of piece"
paragraph: four new terms in one sentence, each defined in a parenthesis
rather than shown and then named one at a time, against the Writing
Standard's "Teaching progression" (two new terms per paragraph at most; a
term the page teaches gets a sentence of its own and an example), at Medium
or higher.
**Fails if:** the review doesn't name that paragraph's term density or
parenthetical definitions, or names it only as cosmetic or Low.

---

## Case-study scenarios (`add-case-study`)

These test `add-case-study`'s Stage 3 review instead of `add-topic`'s. They
share one fabricated base draft, a Pastebin case study written to the case-study template
(docs/case-studies.md) and the Writing Standard's "Teaching
progression" rules, so that each scenario differs from the clean control by
exactly the planted problem. Its `order` is 99, above every real case study's, so a
reviewer's uniqueness check stays quiet (it once shared 17 with a real one).
Build a scenario's draft by taking the base draft below
and applying that scenario's replacement verbatim; give the reviewer the
result, plus the base diagram source, exactly as `add-case-study` Stage 3
would give a real draft and its `.d2` files. These are fixtures for this eval
only: never write them into `src/system-design/`.

The base is a full case study for the template: about 1,900 words of prose,
well inside the word budget (`WORD_BUDGET` in `src/lib/reading-time.ts`; words
outside code blocks and image alt text, frontmatter excluded), with three
decisions of about 185–225 words each. Each replacement changes one decision or
one bullet, so every scenario stays inside the budget. A reviewer's true
observations about what a ten-minute page leaves out on purpose (a sequence
diagram, database failover detail) go in the run's notes and aren't graded.

There's no **Section** here: give the reviewer the titles and slugs of the
real case studies in `src/system-design/case-studies/` for its
near-duplicate check, as the skill does.

<!-- premise: src/system-design/case-studies/pastebin.md missing -->
<!-- premise: src/system-design/case-studies/url-shortener.md exists -->
<!-- premise: src/content/systems-and-infrastructure/caching.md exists -->
<!-- premise: src/content/systems-and-infrastructure/rate-limiting.md exists -->
<!-- premise: src/content/systems-and-infrastructure/database-indexing.md exists -->
<!-- premise: src/content/computing-fundamentals/load-balancers-and-cdns.md exists -->
<!-- premise: src/content/systems-and-infrastructure/read-replicas.md exists -->

### Base draft (the CS-03 control, verbatim)

````markdown
---
title: Design a Pastebin (like Pastebin.com)
summary: A year of text snippets behind links too long to guess in practice, with the text in an object store and expiry checked on every read.
date: 2026-09-28
order: 99
---

You paste a log excerpt and get back a link like `https://paste.example/aZ3kQ9xT2m`.
How would you design that service? It looks like a URL shortener that stores
whole texts instead of URLs. The design here keeps each paste's text apart from
the few facts about it, checks expiry on every read and deletes expired pastes
daily, and makes each link ten random characters, since the link is the
paste's only lock.

This is one plausible design for a service like Pastebin.com, not a
description of how any company built theirs. It starts with numbered links and shows why they fail, follows a paste
through the design that replaces them and sizes its parts, then makes three
decisions: where the text lives, how pastes expire, and how long an ID must be.

## Requirements

- **Create** a paste of up to 512 KB of text and get back a link.
- **Read** a paste by opening its link. There are no accounts, so the link must
  be hard to guess.
- **Expiry** of 1 to 365 days (default 365). After that the paste can't be
  read, and its text is deleted within a day.
- **Scale:** 1 million new pastes a day, and 10 reads for each one.
- **Latency:** reads under 500 ms at p99 (the time 99% of reads beat), measured
  at our servers. A person opens it by hand, so half a second is fine.
- **Availability:** reads succeed 99.9% of the time; a create may fail
  briefly and be retried.

Out of scope: accounts, editing and search.

## Start simple: numbered links

The simplest pastebin is one **app server**, the program that answers requests,
in front of one database. Each paste is a row holding its text and its
**metadata**, the facts about it, such as when it was created and when it
expires.

Its ID comes from a counter: the first paste is 1, the next 2, written in
**base62** (digits and both cases of letters) to keep links short. It's hard to
get wrong. Every ID is unique without a check, a create is one insert, and a
year of pastes fits in five characters:

```text
pastes a year     = 1,000,000 a day × 365 days = 365,000,000
five characters   = 62⁵ = 916,132,832 IDs, more than 365,000,000
```

But the link is the paste's only lock, and counted IDs sit next to each other.
Anyone holding one link can try the numbers below it. No paste lives longer
than 365 days, so every live paste has an ID among the last 365 million issued.
Give that job to a **botnet**, many hijacked machines guessing together; say
10,000 machines at a modest 100 guesses an hour each:

```text
IDs to try            = the last 365,000,000 issued
guesses an hour       = 10,000 × 100 = 1,000,000
time to try them all  = 365,000,000 ÷ 1,000,000 = 365 hours
                      = 365 ÷ 24 ≈ 15 days
```

In about 15 days, one botnet reads every live paste. So the ID has to be unpredictable, from a space so large that the live pastes fill a tiny share of it.

The one database also holds a year of text it never searches, beside the few
facts it does. At an average of 10 KB a paste:

```text
text a year  = 365,000,000 pastes × 10 KB = 3,650 GB = 3.65 TB
```

That much fits on one database's disks, but it makes the database slow to
restore, as the first decision works out. So the design needs IDs nobody can
predict and a separate home for the text. The architecture gives the text its
home; how long an ID must be is the third decision.

## High-level architecture

![A client calls a load balancer, which forwards to app servers. To read a paste, the app servers check a cache first; on a miss they read the metadata database and the object store and fill the cache. To create one, they store its text in the object store and its metadata in the metadata database. A daily cleanup job deletes expired pastes' text from the object store and their rows from the metadata database.](/diagrams/pastebin/architecture.svg)

Follow a create. A
[**load balancer**](/computing-fundamentals/load-balancers-and-cdns) spreads
requests across interchangeable app servers and hands this one to any of them.
The app server draws a random ID and writes the text to the **object store**, a
service that keeps blobs of bytes by key and copies each across machines, so one failure loses nothing, with the ID as the key. Only then
does it insert the row, now just the metadata, into the metadata database, so a
live row never points at missing text.

Now follow a reader opening `aZ3kQ9xT2m`. The app server asks the **cache**
first ([caching](/systems-and-infrastructure/caching)), memory holding
recently read pastes. Most reads go to a small share of pastes, so serving those
from memory spares the database and the object store most of the work. If the
paste is there and hasn't expired, it answers in a few milliseconds.

If it isn't there, the app server reads the row from the metadata database,
fetches the text from the object store, and fills the cache with a **TTL**
(time to live) of a day, cut short at the paste's expiry. That costs tens of
milliseconds, occasionally a couple of hundred, still inside 500 ms. The last
box, the daily cleanup job, is the second decision. First, how big does each
part get?

## Key numbers

These size the traffic the app servers handle, the object store, the database
and the cache. A day has 86,400 seconds; peaks are ten times the average;
1 KB = 1,000 bytes; figures are rounded.

- **Writes:** 1,000,000 ÷ 86,400 ≈ 12 per second on average, and 12 × 10 = 120
  at peak.
- **Reads:** 1,000,000 × 10 = 10,000,000 a day. 10,000,000 ÷ 86,400 ≈ 116 per
  second on average, and 116 × 10 = 1,160 at peak.
- **Object store:** at the average paste of 10 KB, 1,000,000 × 10 KB = 10 GB a
  day, and since nothing outlives 365 days, 10 GB × 365 = 3,650 GB, or 3.65 TB,
  at most.
- **Database:** at most 1,000,000 a day × 365 days = 365 million live pastes,
  and at about 200 bytes each, counting index and row overhead,
  365,000,000 × 200 bytes = 73 GB.
- **Cache:** assume a day's 10 million reads land on 2 million pastes, and the
  most-read 20% draw 80% of reads. Keeping those 0.2 × 2,000,000 = 400,000 in
  memory takes 400,000 × 10 KB = 4 GB, and spares the database and the object
  store about 80% of reads.

Traffic is small; the 3.65 TB of text is what shapes the design.

## API and data model

- `POST /pastes` with `{ "content": "...", "expires_in_days": 7 }` returns
  `201` and `{ "id": "aZ3kQ9xT2m", "url": "https://paste.example/aZ3kQ9xT2m" }`; `400`
  for an expiry outside 1 to 365, `413` over 512 KB, `429` over the per-address
  [rate limit](/systems-and-infrastructure/rate-limiting).
- `GET /aZ3kQ9xT2m` returns `200` with the text, `410 Gone` once it has expired,
  `404` for an unknown ID, including one already swept, and `429` to an address
  blocked for guessing.

```sql
CREATE TABLE pastes (
  id          CHAR(10)  PRIMARY KEY,  -- also the object's key in the store
  created_at  TIMESTAMP NOT NULL,
  expires_at  TIMESTAMP NOT NULL
);
CREATE INDEX pastes_by_expiry ON pastes (expires_at);
```

What matters is what the row leaves out: the text. The paste ID is the
**primary key**, the column the database keeps unique and
[indexed](/systems-and-infrastructure/database-indexing), and the object's key
too. The index on `expires_at` lets the cleanup job find expired rows without a
scan. The simple design kept the text in the row, so why move it?

## Decision: where paste contents live

Keeping the text in the row is simpler: one write, one read, one system to back
up. It holds up until you add up the bytes. The database would carry 3.65 TB of text it never searches beside 73 GB of metadata:

```text
text and metadata  = 3,650 GB + 73 GB = 3,723 GB
metadata alone     = 73 GB
ratio              = 3,723 ÷ 73 ≈ 51
```

Every backup, copy and restore would move about fifty times the data it needs
to. Say the one database is lost and restored from a backup at 200 MB a
second:

```text
with the text     = 3,723 GB ÷ 0.2 GB a second ≈ 18,600 s ≈ 5 hours
metadata only     = 73 GB ÷ 0.2 GB a second = 365 s ≈ 6 minutes
downtime allowed  = 0.1% × 8,760 hours a year ≈ 8.8 hours
```

One restore with the text would spend most of a year's downtime, and a [replica](/systems-and-infrastructure/read-replicas), a second copy kept in step to switch to, would keep a second copy of the 3.65 TB on the same costly database disks. So the text
goes in the object store, under the paste's ID, and the database keeps only the
metadata.

The price is a second write on every create and a second read on every cache
miss, and two writes can half-succeed: the text lands, the row insert fails,
and no row points at the object. A **lifecycle rule**, a store setting that
deletes objects past an age, removes anything older than 366 days, an age no
live paste reaches.

**Rule of thumb.** Bytes you never search don't belong beside the rows you do:
put them in an object store and keep the database small.

## Decision: expiring pastes

Expiry has two jobs: stop serving a paste on time, and delete it. The simplest
plan gives both to one daily sweep. But a sweep that runs once a day can find a
paste up to 24 hours after it expired, and serves it until then. For a paste
set to last 1 day, that's up to twice the life its author chose.

So split the jobs. The app server stops serving: it compares `expires_at` with
the clock on every read, hit or miss, closing the gap at the cost of one comparison.
The **daily cleanup job** deletes: it walks the `expires_at` index, about a
million rows a day (one day's creates, expiring in turn), deleting each object,
then its row.

The price is a second place that knows about expiry, and a crash between the
two deletes. Deleting the object first makes that crash harmless: it leaves an
expired row, which reads answer `410` from and the next run finds again.

**Rule of thumb.** When serving must stop on time but deletion can lag, enforce
the deadline on read and reclaim storage in the background.

## Decision: paste IDs

How long should a random ID be? The obvious answer is the
[URL shortener](/system-design/url-shortener)'s seven characters. There, short
codes are the point. Here the link is the only lock, so count what a guesser
finds:

```text
seven characters  = 62⁷ = 3,521,614,606,208 IDs
live share        = 3,521,614,606,208 ÷ 365,000,000 ≈ 9,648, so 1 ID in 9,648 is live
botnet            = 1,000,000 guesses an hour ÷ 9,648 ≈ 104 pastes an hour
```

Why would the botnet stay at a million an hour? Once IDs are random, nearly
every guess is a `404`, and an address with 100 `404`s in an hour is blocked for the rest of it ([rate limiting](/systems-and-infrastructure/rate-limiting)),
so 10,000 machines get 10,000 × 100 guesses. At seven characters they would
still find about a hundred live pastes an hour. Set a target instead: fewer
than one find a month. Nobody types a paste link, so length is nearly free:

```text
nine characters   = 62⁹ = 13,537,086,546,263,552 IDs
odds of a guess   = 13,537,086,546,263,552 ÷ 365,000,000 ≈ 1 in 37 million
botnet            = 37,000,000 ÷ 1,000,000 = 1 find every 37 hours
ten characters    = 62¹⁰ = 839,299,365,868,340,224 ≈ 840 quadrillion IDs
odds of a guess   = 839,299,365,868,340,224 ÷ 365,000,000 ≈ 1 in 2.3 billion
botnet            = 2,300,000,000 ÷ 1,000,000 = 1 find every 2,300 hours ≈ 96 days
```

So an ID is ten characters, the first length that meets the target, drawn from
a secure random generator, one built so its output can't be predicted.

Random IDs can clash, so the app server writes the text only if that key is
absent from the store (a conditional put), then inserts the row. A clash comes
about once in 2.3 billion creates and just means drawing again. The cost is a
longer link and that one conditional write.

**Rule of thumb.** When a link is the only lock, set how rarely a guesser may
win and grow the ID until it holds; length costs almost nothing.

## Likely follow-ups

- **How do you stop someone guessing links?** Two layers: IDs long enough
  that a guess almost never wins, and the per-address block on `404`s that
  holds a 10,000-machine botnet to about one find every three months. A larger
  botnet gets proportionally more, so alert on the total rate of `404`s too.
- **What stops one sender filling the store?** A cap on bytes: 50 MB of new
  text per address a day is 0.5% of the 10 GB. It doesn't stop a botnet,
  so alert when a day's new text runs well past 10 GB.
- **What if the cache node is lost?** Every read takes the miss path until the
  cache refills: slower, but inside 500 ms.
- **What if the metadata database goes down?** Creates and misses fail; cached
  pastes keep loading, since an entry holds `expires_at` with the text.
- **What if the cleanup job stops?** Reads still answer `410`. Text piles up
  until the lifecycle rule removes it at 366 days, and rows pile up in the
  database until the job runs again.
````

Base diagram source (`src/system-design/diagrams/pastebin/architecture.d2`,
for every scenario):

```d2
direction: down
client: Client
lb: Load balancer
app: App servers
cache: Cache
db: Metadata database {
  shape: cylinder
}
objects: Object store
cleanup: Daily cleanup job
client -> lb
lb -> app
app -> cache: "check first, fill on miss"
app -> db: "metadata"
app -> objects: "text"
cleanup -> objects: "delete expired text"
cleanup -> db: "then delete expired rows"
```

---

### CS-01 — estimate arithmetic error (trap for "estimates must hold")

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** the average read rate is off by ten:
10,000,000 ÷ 86,400 is about 116, not 1,160, and the peak derived from it is
ten times too high as well. The base draft states the read rate per second
only in this bullet, so the wrong figures appear nowhere else and nothing else on the page
changes.
**Replacement in the base draft:** in `## Key numbers`, replace the bullet

```markdown
- **Reads:** 1,000,000 × 10 = 10,000,000 a day. 10,000,000 ÷ 86,400 ≈ 116 per
  second on average, and 116 × 10 = 1,160 at peak.
```

with:

```markdown
- **Reads:** 1,000,000 × 10 = 10,000,000 a day. 10,000,000 ÷ 86,400 ≈ 1,160 per
  second on average, and 1,160 × 10 = 11,600 at peak.
```

**Expected finding:** recomputes the read estimate and flags that
10,000,000 ÷ 86,400 ≈ 116 per second (peak ≈ 1,160), not 1,160 (peak
11,600), noting that it's also inconsistent with the stated 10:1 read-to-write
ratio against 12 writes a second.
**Fails if:** the review doesn't flag the read rate, or flags only style
while accepting the numbers.

---

### CS-02 — a decision that names no alternative

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** `## Decision: where paste contents live`
keeps the choice (the object store), how it's used (text first, then the row;
the lifecycle rule for orphans) and its rule of thumb, but never says, within
the decision, why the obvious alternative loses in this design's numbers: it
doesn't start from keeping the text in the database row, and gives no reason
the row loses (3.65 TB the database never queries, so every backup, copy and
restore moves about fifty times the data, on pricier storage). "Start simple"
and the API and data model section, both unchanged, still mention the
text-in-the-row design, but neither argues against it. The other two
decisions are unchanged.
**Replacement in the base draft:** replace everything between
`## Decision: where paste contents live` and `## Decision: expiring pastes`
(keeping both headings) with:

```markdown
The text goes in the object store, under the paste's ID. A create uploads the
text first and then inserts the row; a cache miss reads the row, then fetches
the object, and puts both in the cache. That leaves the object store holding
the 3.65 TB of text and the database holding 73 GB of metadata.

Two writes can half-succeed: the text lands, the row insert fails, and no row
points at the object. A **lifecycle rule**, a store setting that deletes
objects past an age, removes anything older than 366 days, an age no live
paste reaches.

**Rule of thumb.** Bytes you never search don't belong beside the rows you do:
put them in an object store and keep the database small.
```

**Expected finding:** flags that this decision just announces its choice:
within the decision it never says why keeping the text in the row loses in
this design's numbers (it states the 3.65 TB of text and the 73 GB of
metadata but never argues from them: no "fifty times the data", no cost to
every backup, copy and restore),
and it doesn't start from that alternative, contrary to the template's decision order
(the simpler option, where it breaks in this design's numbers, the choice,
its cost). Mentions of the row elsewhere on the page don't count: the
decision has to make the case. Naming either the missing reason or the
missing alternative-within-the-decision is the finding. A reviewer may also
note that the API and data model section ends by asking "The simple design
kept the text in the row, so why move it?" and the decision never answers it,
or that the rule of thumb no longer follows from an argument on the page; all
are the same planted gap.
**Fails if:** the review flags neither the missing reason nor the missing
alternative within this decision (for example, it accepts the row's mentions
in "Start simple" or the API section as enough), or flags only one of the
other two decisions.

---

### CS-03 — clean case study (false-positive control)

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation:** none. The base draft, verbatim. Its figures are
correct and each follows from a stated
requirement or assumption, with its steps written out ("Start simple":
1,000,000 a day × 365 days = 365,000,000; 62⁵ = 916,132,832, more than
365,000,000, so a year of counted IDs fits in five characters; every live paste
is at most 365 days old, so its ID is among the last 365,000,000 issued; a
botnet of 10,000 machines at 100 guesses an hour is 1,000,000 an hour, and
365,000,000 ÷ 1,000,000 = 365 hours, 365 ÷ 24 ≈ 15.2, "about 15 days";
365,000,000 × 10 KB = 3,650 GB = 3.65 TB of text a year, which fits but is slow to restore. Key numbers, rounded
as the opener says: 1,000,000 ÷ 86,400 ≈ 11.6, about 12, and 12 × 10 = 120 at
peak; 10,000,000 reads a day ÷ 86,400 ≈ 115.7, about 116, and 116 × 10 = 1,160
at peak; 1,000,000 × 10 KB = 10 GB a day, × 365 = 3.65 TB; 365,000,000 × 200 B
(row and index overhead included) = 73 GB; 0.2 × 2,000,000 = 400,000 pastes,
× 10 KB = 4 GB, serving the 80% of reads they draw; the object store holds 3.65 TB "at most". Decisions: 3,650 GB + 73 GB
= 3,723 GB, and 3,723 ÷ 73 ≈ 51; restoring the one database from a backup at 200 MB a second, 3,723 GB takes about 18,600 s ≈ 5 hours and 73 GB takes 365 s ≈ 6 minutes, against a 99.9% availability budget of 0.1% × 8,760 hours ≈ 8.8 hours a year, and a replica would double the 3.65 TB at database prices; a 366-day
lifecycle rule against a 365-day maximum never reaches a live paste; a daily
sweep can find a paste up to 24 hours after it expired, so a 1-day paste can
be served for up to 2 days; the sweep's million rows a day matches the create
rate; 62⁷ = 3,521,614,606,208 and ÷ 365,000,000 ≈ 9,648; 1,000,000 ÷ 9,648 ≈ 104 an hour; the botnet stays at a million an hour because random guesses are nearly all `404`s and an address is blocked after 100 of them in an hour; 62⁹ = 13,537,086,546,263,552, ÷ 365,000,000 ≈ 37 million, and 37,000,000 ÷ 1,000,000 = one find every 37 hours, which misses the "fewer than one find a month" target;
62¹⁰ = 839,299,365,868,340,224 ≈ 840 quadrillion, ÷ 365,000,000 ≈ 2.3 billion,
so a guess wins about one time in 2.3 billion and the botnet finds a paste
every 2,300 hours ≈ 96 days, inside the target. Follow-ups: 10,000 × 100 = a
million guesses an hour; 50 MB ÷ 10 GB = 0.5%; a miss at tens of milliseconds,
occasionally a couple of hundred, is inside the 500 ms p99 target). It follows
the Teaching progression rules: the intro states the question, a one-sentence
overview of the design and a route sentence; "Start simple" shows counted IDs
in one database working, then failing on the design's numbers (guessable IDs; 3.65 TB of text that makes the database slow to restore) and ends on the problem the architecture
solves (where the text goes) and the one decision 3 solves (ID length); the
architecture is the diagram and three short paragraphs (a create, a cache hit,
a miss) with at most two new terms each, the cache justified by where reads go and its size left to Key numbers;
each decision runs from the option a reader would suggest (the text in the
row; one daily sweep doing both jobs; the URL shortener's seven characters) to
where it breaks, in this design's numbers, then the choice, its cost, and a
`**Rule of thumb.**` paragraph that follows from it. IDs are ten characters from a secure random generator (glossed), written with a conditional put that
refuses an existing key, before the row, so a clash can't overwrite a live
paste;
Expiry is checked on cache hits as well as misses; the sweep deletes the object
before the row; the API says when `410` gives way to `404` and that a blocked
address gets `429`. Every term is defined at first use (p99, app server,
metadata, base62, botnet, load balancer, object store, cache, TTL, primary key, replica, lifecycle rule, conditional put); every catalog link (`load-balancers-and-cdns`, `read-replicas`, `caching`, `rate-limiting`, `database-indexing`,
and the `url-shortener` case study) points to a page that exists and sits
where its concept is used; the absolute claims hold ("every ID is unique
without a check" follows from a counter, "never points at missing text" from
writing the object before the row, "an age no live paste reaches" from the
365-day maximum); and the diagram shows exactly the components the prose names
(the lifecycle rule is a setting of the object store, not a component), with
the cleanup job's two deletes in the order the expiry decision gives.
**Expected finding:** no finding that is false of the draft. Real gaps that
a ten-minute page leaves out on purpose, such as a sequence diagram or
database failover detail, are acceptable and go in the run's notes.
**Fails if:** the review reports a defect that isn't true of the draft: an
arithmetic "error" in a correct line, a decision called one-sided when it
names its alternative and why it loses, a diagram/prose mismatch that isn't
there, an absolute claim called unsupported when the page supports it, or a
correct technical statement called wrong.

---

### CS-04 — a compression overclaim (trap for "compression overclaims")

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** a follow-up answer claims that nobody
can ever guess a link and that no limit is needed, while
`## Decision: paste IDs` states that a guess finds a live paste about one time
in 2.3 billion. Long random IDs make guessing very unlikely, not impossible,
and the per-address limit the base draft's answer described is the second
layer the planted answer drops.
**Replacement in the base draft:** in `## Likely follow-ups`, replace the
first bullet (`**How do you stop someone guessing links?**`, four lines) with:

```markdown
- **How do you stop someone guessing links?** You don't have to: the IDs are
  ten random characters, so nobody can ever guess a valid link, and no limit
  on reads is needed.
```

**Expected finding:** flags "nobody can ever guess a valid link" as an
absolute claim the design doesn't deliver, against the page's own odds of
about one in 2.3 billion a guess (a botnet making a million guesses an hour
would still find one every few months), and that dropping the read limit
removes the layer that caps a single address. Either half names the planted
problem.
**Fails if:** the review doesn't flag the absolute claim, or accepts it as
supported by the ID length.

---

## DS-* — retired

The `DS-01`–`DS-03` scenarios tested `add-dsa-entry`'s review of a DSA entry
and its code. The DSA tab and that skill were removed by
`docs/specs/remove-dsa-tab.md`, so the scenarios no longer have a skill to
test. The IDs are kept so past results under `results/` still line up; don't
reuse them.
