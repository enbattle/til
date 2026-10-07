# Content-review scenarios

Each scenario is a fully fabricated draft topic, case study or DSA entry —
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

`CR-*` scenarios test `add-topic`'s review. The `CS-*` and `DS-*` scenarios
after them test `add-case-study`'s and `add-dsa-entry`'s reviews the same
way, with a case-study draft or a DSA entry and its code instead.

On 2026-10-07 the five `CR-*` drafts were brought to the catalog standard
(docs/writing-standard.md, "Catalog topics"): 600–900 words of prose, one
running example carried through, the lecturer voice, every term defined, and
a closing rule of thumb, so that each planted violation is again the draft's
only real problem and CR-05 is again clean. Their planted violations kept
their original wording; CR-02 and CR-03 now fence the draft with four
backticks because the draft holds a code block.

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
2026-09-24 so this one stands out):** never defines "hash function" before
relying on it as load-bearing vocabulary — a reader with zero background has no way
to know what "hash the item" actually means or why multiple hashes are
used.

```markdown
---
title: Bloom Filters
summary: A space-efficient way to check "definitely not present" instantly, at the cost of occasional false positives.
date: 2026-09-16
---

Say you run a sign-up page, and as someone types a username you check whether
it's already taken. You have 10 million accounts, and each check is a database
query that takes a few milliseconds. Most names people try are new, so most of
those queries come back empty. Could you skip the empty ones?

A **Bloom filter** lets you. It's a small structure kept in memory, in front of
the database, that answers one question: "could this name already exist?" It
gives one of two answers. "Definitely not" is always right, so you can tell the
user the name is free without touching the database. "Possibly" can be wrong,
so you go and ask the database. The filter never wrongly says no, but it
sometimes wrongly says yes, and a wrong yes is called a **false positive**.

## How it works

The filter is a **bit array**: a long row of bits, each 0 or 1, all 0 to start.
Ours has 100 million of them, which is 12.5 MB.

To add a username, you hash the item with several different hash functions,
say seven, and each one gives you a position in the array. You set those seven
bits to 1. Adding `alice` might set bits 3, 41206, 9880112 and four others.
Every new account goes into the filter this way as it's created, and the filter
must see every one, so with several app servers they share one filter. (If
each server kept its own copy, a name registered a moment ago on another
server could get a wrong "definitely not" here.)

To check a name, you hash it the same way and look at the same seven positions.
If any of them is 0, the name was never added, because adding it would have set
that bit. If all seven are 1, the name was probably added.

Why only "probably"? Because the bits are shared. Ten million names have each
set seven bits, and a name nobody has registered can land on seven bits that
other names happened to set. The filter says "possibly," you query the
database, and it comes back empty. That wasted query is the whole cost of a
false positive: a wrong answer from the filter never reaches the user, because
the database has the last word. (It has the last word on a "definitely not"
too: the uniqueness check in the database still runs when the account is
actually saved, in case two people grab the same free name at once.)

## How wrong, and how big?

So how often does a free name get a "possibly"? It depends on how many bits the
filter has per item and how many hash functions it uses. Our filter has 10 bits
per name. With seven hash functions, about 1 in 120 checks for an unused name
is a false positive, under 1%. Squeeze the same 10 million names into half the
memory, 5 bits each, and the best you can do is about 1 in 11.

Why seven, and not one or fifty? Too few, and each name marks only a bit or
two, so an unused name has to match very little to slip through. Too many, and
every name sets so many bits that the array fills up with 1s and nearly
everything matches. The sweet spot is about 0.7 times the bits per item, which
for our 10 bits is seven.

Now compare the obvious alternative: keep the set of usernames itself in
memory. Ten million names at 10 to 20 bytes each is 100 to 200 MB before any
overhead, against the filter's 12.5 MB. The filter is smaller because it never
stores the names, only bits they touched. You give up exact answers to hold a
fraction of the data.

## What it can't do

Since it never stored the names, a Bloom filter can't list them. It also can't
forget one. When a user deletes their account, clearing their seven bits could
clear a bit that some other name relies on, and the filter would start saying
"definitely not" about a name that exists, the one mistake it promised never to
make. So a standard filter only grows. If you need deletes, a variant called a
**counting Bloom filter** keeps a small counter at each position instead of a
single bit, at several times the memory.

It also gets worse as it fills. The 1-in-120 figure holds for 10 million names;
at 20 million in the same array, the false-positive rate climbs to roughly
1 in 7. Size the filter for the count you expect, and rebuild it bigger when
the sign-ups head past that.

**Rule of thumb.** Put a Bloom filter in front of a slow lookup when most
queries are for things that aren't there and an occasional wasted lookup is
acceptable.

## Where you'll meet this

A URL shortener that generates random short codes can keep a filter of every
code issued, so most new codes, which are unused, skip the lookup for a clash. A
notification pipeline can keep one of message IDs already sent, and look up
only the "possibly" answers before dropping a duplicate.
```

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
````

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
````

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

## Case-study scenarios (`add-case-study`)

These test `add-case-study`'s Stage 3 review instead of `add-topic`'s. They
share one fabricated base draft, a Pastebin case study written to the
five-minute case-study template (docs/case-studies.md, "The template is
enforced"), so that each scenario differs from the clean control by exactly
the planted problem. Its `order` is 99, above every real case study's, so a
reviewer's uniqueness check stays quiet (it once shared 17 with a real one).
Build a scenario's draft by taking the base draft below
and applying that scenario's replacement verbatim; give the reviewer the
result, plus the base diagram source, exactly as `add-case-study` Stage 3
would give a real draft and its `.d2` files. These are fixtures for this eval
only: never write them into `src/system-design/`.

The base is a full-length case study for the template: about 1,130 words of
prose, just under the word budget (`WORD_BUDGET` in `src/lib/reading-time.ts`;
words outside code blocks and image alt text, frontmatter excluded), with three decisions of about 135–145 words each.
Each replacement changes one decision or one bullet, so every scenario stays
inside the budget. A reviewer's true observations about what a five-minute
page leaves out on purpose (a sequence diagram, database failover detail) go
in the run's notes and aren't graded.

There's no **Section** here: give the reviewer the titles and slugs of the
real case studies in `src/system-design/case-studies/` for its
near-duplicate check, as the skill does.

<!-- premise: src/system-design/case-studies/pastebin.md missing -->
<!-- premise: src/system-design/case-studies/url-shortener.md exists -->
<!-- premise: src/content/systems-and-infrastructure/caching.md exists -->
<!-- premise: src/content/systems-and-infrastructure/rate-limiting.md exists -->
<!-- premise: src/content/systems-and-infrastructure/database-indexing.md exists -->

### Base draft (the CS-03 control, verbatim)

````markdown
---
title: Design a Pastebin (like Pastebin.com)
summary: A year of text snippets behind links too long to guess in practice, with the text in an object store and expiry checked on every read.
date: 2026-09-28
order: 99
---

You paste a log excerpt and get back a link like `https://paste.example/aZ3kQ9xT2m`.
It looks like a URL shortener with bigger values, and the interest is in what
bigger values cost: terabytes of text the database never queries, an expiry
that has to actually delete things, and a link that is the paste's only lock.
This is one plausible design for a service like Pastebin.com, not a description
of how any company built theirs.

## Requirements

- **Create** a paste of up to 512 KB of text and get back a link.
- **Read** a paste by opening its link. There are no accounts, so the link must
  be hard to guess.
- **Expiry** of 1 to 365 days (default 365). After that the paste can't be
  read, and its text is deleted by the next daily cleanup.
- **Scale:** 1 million new pastes a day, and 10 reads for each one.
- **Latency:** reads under 500 ms at p99 (the time 99% of reads beat), measured
  at our servers. A person opens it by hand, so half a second is fine.

Out of scope: accounts, editing and search.

## Key numbers

These size the app servers, the object store, the database and the cache. A
day has 86,400 seconds; peaks are ten times the average; 1 KB = 1,000 bytes.

- **Writes:** 1,000,000 ÷ 86,400 ≈ 12 per second on average, about 120 at
  peak.
- **Reads:** 10,000,000 ÷ 86,400 ≈ 116 per second on average, about 1,160 at
  peak.
- **Object store:** assume an average paste of 10 KB. That's 1,000,000 × 10 KB
  = 10 GB a day, and since nothing outlives 365 days, 10 GB × 365 ≈ 3.65 TB in
  all.
- **Database:** about 200 bytes of metadata a paste × 365 million live pastes
  ≈ 73 GB.
- **Cache:** assume a day's 10 million reads land on 2 million pastes, and the
  most-read 20% draw 80% of reads. Keeping those 0.2 × 2,000,000 = 400,000 in
  memory ([caching](/systems-and-infrastructure/caching)) takes 400,000 ×
  10 KB = 4 GB.

Traffic is small; the 3.65 TB of text is what shapes the design.

## High-level architecture

![A client calls a load balancer, which forwards to app servers. To read a paste, the app servers check a cache first; on a miss they read the metadata database and the object store and fill the cache. To create one, they store its contents in the object store and its metadata in the metadata database. A daily cleanup job deletes expired pastes' contents from the object store and their rows from the metadata database.](/diagrams/pastebin/architecture.svg)

Follow a reader opening `aZ3kQ9xT2m`. The **load balancer** spreads requests
across interchangeable **app servers**, and one asks the **cache**: 4 GB of
memory that evicts the least recently used entry (LRU) when full. A hit answers in a
few milliseconds, after checking `expires_at`. On a miss, the app server reads
the row from the **metadata database**, fetches the text from the **object
store** (a service that stores blobs of bytes by key), and fills the cache with
a TTL (time to live) of a day, cut short at `expires_at`. That costs tens of
milliseconds, occasionally a couple of hundred, still inside 500 ms. A create
writes the text to the object store first, then the row, so a live row never
points at missing text.

## API and data model

- `POST /pastes` with `{ "content": "...", "expires_in_days": 7 }` returns
  `201` and `{ "id": "aZ3kQ9xT2m", "url": "https://paste.example/aZ3kQ9xT2m" }`; `400`
  for an expiry outside 1 to 365, `413` over 512 KB, `429` over the per-address
  [rate limit](/systems-and-infrastructure/rate-limiting).
- `GET /aZ3kQ9xT2m` returns `200` with the text, `410 Gone` once it has expired,
  and `404` for an unknown ID, including one already swept.

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
scan. So why not keep the text in the row?

## Decision: where paste contents live

The text goes in the object store. The row is the obvious alternative, and
simpler: one write, one read, one system to back up. Here it loses on size. The
database would carry 3.65 TB of text it never queries beside 73 GB of
metadata, so every backup, copy and restore moves about fifty times the data,
on pricier storage.

The price is a second write on every create, and two writes can half-succeed:
the text lands, the row insert fails, and no row points at the object. A
**lifecycle rule**, a store setting that deletes objects past an age, removes
anything older than 366 days, an age no live paste reaches.

**Rule of thumb.** Large blobs that are only ever read whole belong in an
object store; the database keeps the small rows you query.

## Decision: expiring pastes

Expiry has two jobs: stop serving a paste on time, and delete it. The app
server does the first, comparing `expires_at` with the clock on every read,
hit or miss. The **daily cleanup job** does the second: it walks the
`expires_at` index, about a million rows a day, deleting each object, then its
row.

Why not let the sweep do both? It runs daily, so an expired paste could be
served for up to a day longer; the read check closes that gap for one
comparison. And deleting the object first means a crash in between leaves an
expired row, which reads answer `410` from and the next run finds again.

**Rule of thumb.** When serving must stop on time but deletion can lag, enforce
the deadline on read and reclaim storage in the background.

## Decision: paste IDs

An ID is ten random base62 characters (digits and both cases of letters):
62¹⁰ ≈ 840 quadrillion. The app server draws one and writes the text only if
that key is absent from the store (a conditional put), then inserts the row.
With 365 million live pastes, a clash comes about once in 2.3 billion creates
and just means drawing again.

Why not reuse the [URL shortener](/system-design/url-shortener)'s seven
characters? There, short codes are the point. Here the link is the only lock,
and at seven characters 365 million live pastes fill about one ID in 9,600: a
botnet making a million guesses an hour would find about a hundred private
pastes an hour. Nobody types a paste link, so three more characters cost
nothing and push a guess to about one in 2.3 billion.

**Rule of thumb.** When a link is the only lock, size the ID space so guessing
is hopeless; length is cheaper than adding accounts.

## Likely follow-ups

- **How do you stop someone guessing links?** An address with 100 `404`s in
  an hour is blocked for the rest of it, so a botnet of 10,000 machines gets a
  million guesses an hour. At one in 2.3 billion, that finds a paste about
  once every three months.
- **What stops one sender filling the store?** A cap on bytes: 50 MB of new
  text per address a day is 0.5% of the 10 GB.
- **What if the cache node is lost?** Every read takes the miss path until the
  cache refills: slower, but inside 500 ms.
- **What if the metadata database goes down?** Creates and misses fail; cached
  pastes keep loading, since an entry holds `expires_at` with the text.
- **What if the cleanup job stops?** Reads still answer `410`, but text piles
  up, and the lifecycle rule still removes it at 366 days.
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
app -> objects: "contents"
cleanup -> objects: "delete expired contents"
cleanup -> db: "then delete expired rows"
```

---

### CS-01 — estimate arithmetic error (trap for "estimates must hold")

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation (the only one):** the average read rate is off by ten:
10,000,000 ÷ 86,400 is about 116, not 1,160, and the peak derived from it is
ten times too high as well. The base draft states the read rate only in this
bullet, so the wrong figures appear nowhere else and nothing else on the page
changes.
**Replacement in the base draft:** in `## Key numbers`, replace the bullet

```markdown
- **Reads:** 10,000,000 ÷ 86,400 ≈ 116 per second on average, about 1,160 at
  peak.
```

with:

```markdown
- **Reads:** 10,000,000 ÷ 86,400 ≈ 1,160 per second on average, about 11,600
  at peak.
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
the lifecycle rule for orphans) and its rule of thumb, but never names the
alternative a reader would suggest (keeping the text in the database row) or
says why it loses here (3.65 TB the database never queries, in every backup,
copy and restore, on pricier storage). The other two decisions are unchanged.
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

**Rule of thumb.** Large blobs that are only ever read whole belong in an
object store; the database keeps the small rows you query.
```

**Expected finding:** flags that this decision just announces its choice: it
names no alternative (keeping the text in the row is the obvious one) and
gives no reason in this design's numbers why that alternative would lose,
contrary to the checklist's "each one names the choice, why in this design's
numbers, the one alternative a reader would suggest and why it loses here." A
reviewer may also note that the API and data model section ends by asking
"So why not keep the text in the row?" and the decision never answers it, or
that the rule of thumb no longer follows from an argument on the page; both
are the same planted gap.
**Fails if:** the review doesn't flag the missing alternative in this
decision, or flags only one of the other two decisions.

---

### CS-03 — clean case study (false-positive control)

**Reviewed with:** `add-case-study`'s Stage 3 instruction.
**Planted violation:** none. The base draft, verbatim. Its figures are
correct and each follows from a stated requirement or assumption
(1,000,000 ÷ 86,400 ≈ 11.6, about 12, and × 10 ≈ 116, "about 120" at peak;
10,000,000 ÷ 86,400 ≈ 115.7, about 116, and × 10 ≈ 1,157, "about 1,160";
1,000,000 × 10 KB = 10 GB a day; 10 GB × 365 = 3,650 GB; 365 million live
pastes = 1,000,000 a day × 365 days, and 200 B × 365,000,000 = 73 GB;
10,000,000 reads ÷ 2,000,000 pastes = 5 reads a paste; 0.2 × 2,000,000 =
400,000 pastes, × 10 KB = 4 GB; (3,650 GB + 73 GB) ÷ 73 GB ≈ 51, "about fifty
times the data"; the sweep's million rows a day matches the create rate; a
366-day lifecycle rule against a 365-day maximum never reaches a live paste;
62¹⁰ = 839,299,365,868,340,224 ≈ 840
quadrillion; 62¹⁰ ÷ 365,000,000 ≈ 2.3 billion, so a random ID clashes "about
once in 2.3 billion creates" and a guess finds a paste one time in about 2.3
billion; at seven characters, 62⁷ = 3,521,614,606,208 and 62⁷ ÷ 365,000,000 ≈
9,648, "about one ID in 9,600", and a million guesses an hour ÷ 9,648 ≈ 104,
"about a hundred an hour"; 10,000 machines × 100 guesses = a million an hour,
and 2.3 billion ÷ 1,000,000 ≈ 2,300 hours ≈ 96 days, "about once every three
months"; 50 MB ÷ 10 GB = 0.5%, "0.5% of the 10 GB"; a miss at tens of milliseconds,
occasionally a couple of hundred, is inside the 500 ms p99 target). IDs are
ten random characters whose text is written with a conditional put that
refuses an existing key, before the row, so a clash can't overwrite a live
paste and no two pastes share an ID; the follow-ups say the per-address limit
caps a 10,000-machine botnet at a million guesses an hour (10,000 × 100), and
length makes those find a paste about once every three months. Each of the three
decisions names its choice, the alternative a reader would suggest (the text
in the row; the sweep alone; the URL shortener's seven characters) and why it loses in this
design's numbers, and ends with a `**Rule of thumb.**` paragraph that follows
from it. Expiry is checked on cache hits as well as misses; the sweep deletes
the object before the row, so a crash leaves an expired row the next run
finds again; the API says when `410` gives way to `404`; the cache is capped
at 4 GB with LRU eviction and a TTL cut short at `expires_at`. Every term is
defined at first use (p99, LRU, TTL, object store, primary key, lifecycle
rule, base62); every catalog link (`caching`, `rate-limiting`,
`database-indexing`, and the `url-shortener` case study) points to a page
that exists and sits where its concept is used; the absolute claims hold ("no
two pastes share an ID" follows from the conditional put, "never points at missing text" from writing the object before the row,
"an age no live paste reaches" from the 365-day maximum); and the diagram
shows exactly the components the prose names (the lifecycle rule is a setting
of the object store, not a component), with the cleanup job's two deletes in
the order the expiry decision gives.
**Expected finding:** no finding that is false of the draft. Real gaps that
a five-minute page leaves out on purpose, such as a sequence diagram or
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

## DSA scenarios (`add-dsa-entry`)

These test `add-dsa-entry`'s Stage 3 review. Like the case-study scenarios, they
share one fabricated base: a short Prefix Sums entry (a pattern) and its four
code files, written to the template in `docs/dsa.md`, with the code's comments
carrying the reasons and the walkthrough paragraphs connecting each step to
the next. Build a scenario's files by taking the base and applying that
scenario's replacements verbatim, then give the reviewer the entry and all
four code files, exactly as `add-dsa-entry` Stage 3 would. These are fixtures
for this eval only: never write them into `src/dsa/`. The base code and tests
were run as written (6 pytest and 6 vitest tests pass, and Prettier accepts
the `.ts` files), and the entry's prose, outside code fences and frontmatter,
is 962 words.

There's no **Section**: give the reviewer the titles and slugs of the real
entries in `src/dsa/entries/` for its near-duplicate check, as the skill does,
leaving out the published Prefix Sums entry. It shares the base's slug, so tell
the reviewer the draft is a rewrite of it and not to open the published file
(content-review-eval Stage 1 says why).

<!-- premise: src/dsa/entries/hash-map.md exists -->
<!-- premise: src/dsa/entries/prefix-sums.md exists -->

### Base entry (the DS-03 control, verbatim)

`src/dsa/entries/prefix-sums.md`:

````markdown
---
title: Prefix Sums
summary: Precompute running totals once, and the sum of any stretch of an array becomes one subtraction.
date: 2026-10-01
kind: pattern
---

## Prerequisites

[Hash map](/dsa/hash-map), for the counting version at the end, which stores
running totals and looks each one up in constant time on average. Otherwise
you need only arrays, with positions numbered from 0.

## The idea

Say you have `nums = [3, 1, 4, 1, 5]` and someone keeps asking for the sum of
a stretch of it: positions 1 through 3, then 0 through 4, then 2 through 2.
Adding each stretch up from scratch costs one step per element in it, so a
thousand questions about a long array repeat the same additions over and over.
Can you do the additions once?

You can. A **prefix sum** is the total of an array's first few elements. Build
a second array, `prefix`, where `prefix[i]` is the sum of the first `i`
elements, so `prefix[0]` is 0, the sum of nothing:

| i         | 0   | 1   | 2   | 3   | 4   | 5   |
| --------- | --- | --- | --- | --- | --- | --- |
| prefix[i] | 0   | 3   | 4   | 8   | 9   | 14  |

Now any stretch is one subtraction. The sum of positions 1 through 3 is
everything through position 3, minus everything before position 1:
`prefix[4] - prefix[1] = 9 - 3 = 6`, which is 1 + 4 + 1.

The same table answers a harder question: how many stretches add up to exactly
`k`? The stretch from position `j` up to just before position `i` sums to
`prefix[i] - prefix[j]`, so it sums to `k` when some earlier total equals
`prefix[i] - k`. Walk the array once, keep a count of every total seen so far,
and at each new total ask how many earlier ones sit exactly `k` below it. For
`k = 5`, the totals 8, 9 and 14 find 3, 4 and 9 behind them: three stretches,
`[1, 4]`, `[4, 1]` and `[5]`.

Why not a sliding window, the usual tool for subarrays? A window grows to
raise its sum and shrinks to lower it, which only works when every value is
positive. Put a -2 in the array and growing the window can lower the sum, so
the window no longer knows which way to move. Prefix totals don't care about
signs. The rule: when you need sums over ranges, store the total up to each
point, and every range becomes the difference of two of them.

## When to use it

Reach for prefix sums when a problem statement says something like:

- "the sum of the elements from `i` to `j`", asked many times over an array
  that doesn't change;
- "count the subarrays whose sum is `k`", especially when values can be
  negative, which rules out a sliding window;
- "how many of something are in positions `l` to `r`": vowels in a string,
  ones in a bit array, anything you can add up and undo by subtraction (XOR
  works too, since it undoes itself).

Two signals point away. If the array changes between questions, every total
after the changed position goes stale, and a structure built for updates fits
better. And a range maximum can't be subtracted away, so running totals can't
answer it.

## Walkthrough

```python
from collections import Counter


def build_prefix(nums: list[int]) -> list[int]:
    # One slot longer than nums: prefix[0] = 0 is the sum of no elements, so a
    # range that starts at 0 still has something to subtract.
    prefix = [0] * (len(nums) + 1)
    for i, value in enumerate(nums):
        # Slot i + 1, not i: prefix[i] is the total before nums[i], which this reads.
        prefix[i + 1] = prefix[i] + value
    return prefix
```

```typescript
export function buildPrefix(nums: number[]): number[] {
  // One slot longer than nums: prefix[0] = 0 is the sum of no elements, so a
  // range that starts at 0 still has something to subtract.
  const prefix = new Array<number>(nums.length + 1).fill(0);
  for (let i = 0; i < nums.length; i++) {
    // Slot i + 1, not i: prefix[i] is the total before nums[i], which this reads.
    prefix[i + 1] = prefix[i] + nums[i];
  }
  return prefix;
}
```

One pass, each total built from the one before it, and the example's table
`[0, 3, 4, 8, 9, 14]` is done. (Python's
`list(itertools.accumulate(nums, initial=0))` builds the same list in one
call, and `Counter` is for the counting function below.) With the table built,
a range question costs almost nothing.

```python
def range_sum(prefix: list[int], left: int, right: int) -> int:
    # right is inside the range: prefix[right] would stop just before it.
    return prefix[right + 1] - prefix[left]
```

```typescript
export function rangeSum(prefix: number[], left: number, right: number): number {
  // right is inside the range: prefix[right] would stop just before it.
  return prefix[right + 1] - prefix[left];
}
```

That's two reads and a subtraction however long the range is, and
`range_sum(prefix, 1, 3)` reads 9 and 3 to return 6. Counting runs the other
way: you know the sum you want and need the ranges that make it, so the totals
go into a hash map instead of an array, looked up by value.

```python
def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    # The empty prefix: without it, a subarray that starts at 0 is never counted.
    seen = Counter({0: 1})
    total = 0
    count = 0
    for value in nums:
        total += value
        # Look up before recording total, or total pairs with itself: an empty
        # subarray, counted once per element when k is 0.
        count += seen[total - k]
        seen[total] += 1
    return count
```

```typescript
export function countSubarraysWithSum(nums: number[], k: number): number {
  // The empty prefix: without it, a subarray that starts at 0 is never counted.
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
  for (const value of nums) {
    total += value;
    // Look up before recording total, or total pairs with itself: an empty
    // subarray, counted once per element when k is 0.
    count += seen.get(total - k) ?? 0;
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
```

On the example with `k = 5`, the totals arrive as 3, 4, 8, 9 and 14, and each
of the last three finds its partner (3, 4 or 9) already in `seen`, so the
function returns 3. The table is never stored here, only the running `total`,
and each element costs one lookup and one update, which is where the next
section's numbers come from.

## Complexity

Big-O notation describes how a cost grows with the size of the input, n.
Building `prefix` takes O(n) time, one addition per element, and O(n) extra
space for the n + 1 totals. Each range sum is then O(1): two reads and a
subtraction. Answering q questions costs O(n + q) in total, against O(n × q)
in the worst case when every range is added up from scratch.

Counting takes O(n) time on average: one pass, with a hash-map lookup and
update per element, each O(1) on average. The map holds at most n + 1 distinct
totals, so it takes O(n) space. Checking every pair of start and end instead
is O(n²), even when the table makes each pair's sum O(1).

## Pitfalls

- **Off by one at the right end.** `range_sum` reads `prefix[right + 1]`
  because the range includes `right`. Write `prefix[right]` and the example's
  range 1 through 3 comes out as `prefix[3] - prefix[1] = 5`, missing the 1
  at position 3. Pick one convention for whether `right` is inside the range
  and keep it everywhere.
- **No seed in the count map.** Start `seen` empty and every stretch that
  begins at position 0 is lost. With `k = 8`, `[3, 1, 4]` reaches a total of
  8 and needs a 0 behind it, so the function returns 0 instead of 1.
- **Recording before looking up.** Swap the last two lines of the loop and
  each total finds itself. With `k = 0` the example returns 5, one per
  element, when no stretch of positive numbers sums to 0.
- **Overflow with fixed-width integers.** `prefix[i + 1] = prefix[i] + value`
  is safe here: Python's integers grow as needed, and TypeScript's numbers are
  64-bit floating point, exact for every integer up to 2⁵³ in size, past which
  totals silently round. In a language with 32-bit integers, the totals of a
  long array of large values can overflow even when every element fits.
````

`src/dsa/code/prefix-sums/prefix_sums.py`:

```python
from collections import Counter


def build_prefix(nums: list[int]) -> list[int]:
    # One slot longer than nums: prefix[0] = 0 is the sum of no elements, so a
    # range that starts at 0 still has something to subtract.
    prefix = [0] * (len(nums) + 1)
    for i, value in enumerate(nums):
        # Slot i + 1, not i: prefix[i] is the total before nums[i], which this reads.
        prefix[i + 1] = prefix[i] + value
    return prefix


def range_sum(prefix: list[int], left: int, right: int) -> int:
    # right is inside the range: prefix[right] would stop just before it.
    return prefix[right + 1] - prefix[left]


def count_subarrays_with_sum(nums: list[int], k: int) -> int:
    # The empty prefix: without it, a subarray that starts at 0 is never counted.
    seen = Counter({0: 1})
    total = 0
    count = 0
    for value in nums:
        total += value
        # Look up before recording total, or total pairs with itself: an empty
        # subarray, counted once per element when k is 0.
        count += seen[total - k]
        seen[total] += 1
    return count
```

`src/dsa/code/prefix-sums/test_prefix_sums.py`:

```python
import random
from itertools import accumulate

from prefix_sums import build_prefix, count_subarrays_with_sum, range_sum

SEED = 7


def brute_count(nums, k):
    n = len(nums)
    return sum(sum(nums[i:j]) == k for i in range(n) for j in range(i + 1, n + 1))


def test_empty_input():
    assert build_prefix([]) == [0]
    assert count_subarrays_with_sum([], 0) == 0


def test_one_element():
    prefix = build_prefix([5])
    assert prefix == [0, 5]
    assert range_sum(prefix, 0, 0) == 5
    assert count_subarrays_with_sum([5], 5) == 1
    assert count_subarrays_with_sum([5], 0) == 0


def test_worked_example():
    nums = [3, 1, 4, 1, 5]
    prefix = build_prefix(nums)
    assert prefix == [0, 3, 4, 8, 9, 14]
    assert range_sum(prefix, 1, 3) == 6
    assert range_sum(prefix, 0, 4) == 14
    assert range_sum(prefix, 4, 4) == 5
    assert count_subarrays_with_sum(nums, 5) == 3


def test_counts_zeros_and_negatives():
    assert count_subarrays_with_sum([0, 0, 0], 0) == 6
    assert count_subarrays_with_sum([1, -1, 1], 0) == 2
    assert count_subarrays_with_sum([1, 2, 3], 7) == 0


def test_range_sums_match_brute_force():
    rng = random.Random(SEED)
    for trial in range(50):
        nums = [rng.randint(-50, 50) for _ in range(rng.randint(1, 20))]
        prefix = build_prefix(nums)
        context = f"seed {SEED}, trial {trial}, nums {nums}"
        assert prefix == list(accumulate(nums, initial=0)), context
        for left in range(len(nums)):
            for right in range(left, len(nums)):
                expected = sum(nums[left : right + 1])
                assert range_sum(prefix, left, right) == expected, (
                    f"{context}, range [{left}, {right}]"
                )


def test_counts_match_brute_force():
    rng = random.Random(SEED)
    for trial in range(50):
        nums = [rng.randint(-3, 3) for _ in range(rng.randint(1, 15))]
        k = rng.randint(-3, 3)
        assert count_subarrays_with_sum(nums, k) == brute_count(nums, k), (
            f"seed {SEED}, trial {trial}, nums {nums}, k {k}"
        )
```

`src/dsa/code/prefix-sums/prefix-sums.ts`:

```typescript
export function buildPrefix(nums: number[]): number[] {
  // One slot longer than nums: prefix[0] = 0 is the sum of no elements, so a
  // range that starts at 0 still has something to subtract.
  const prefix = new Array<number>(nums.length + 1).fill(0);
  for (let i = 0; i < nums.length; i++) {
    // Slot i + 1, not i: prefix[i] is the total before nums[i], which this reads.
    prefix[i + 1] = prefix[i] + nums[i];
  }
  return prefix;
}

export function rangeSum(prefix: number[], left: number, right: number): number {
  // right is inside the range: prefix[right] would stop just before it.
  return prefix[right + 1] - prefix[left];
}

export function countSubarraysWithSum(nums: number[], k: number): number {
  // The empty prefix: without it, a subarray that starts at 0 is never counted.
  const seen = new Map<number, number>([[0, 1]]);
  let total = 0;
  let count = 0;
  for (const value of nums) {
    total += value;
    // Look up before recording total, or total pairs with itself: an empty
    // subarray, counted once per element when k is 0.
    count += seen.get(total - k) ?? 0;
    seen.set(total, (seen.get(total) ?? 0) + 1);
  }
  return count;
}
```

`src/dsa/code/prefix-sums/prefix-sums.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildPrefix, countSubarraysWithSum, rangeSum } from './prefix-sums';

const SEED = 7;

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from lo to hi, both included. */
const between = (next: () => number, lo: number, hi: number) =>
  lo + Math.floor(next() * (hi - lo + 1));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function bruteCount(nums: number[], k: number): number {
  let count = 0;
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j <= nums.length; j++) {
      if (sum(nums.slice(i, j)) === k) count++;
    }
  }
  return count;
}

describe('prefix sums', () => {
  it('handles empty input', () => {
    expect(buildPrefix([])).toEqual([0]);
    expect(countSubarraysWithSum([], 0)).toBe(0);
  });

  it('handles one element', () => {
    const prefix = buildPrefix([5]);
    expect(prefix).toEqual([0, 5]);
    expect(rangeSum(prefix, 0, 0)).toBe(5);
    expect(countSubarraysWithSum([5], 5)).toBe(1);
    expect(countSubarraysWithSum([5], 0)).toBe(0);
  });

  it('matches the worked example', () => {
    const nums = [3, 1, 4, 1, 5];
    const prefix = buildPrefix(nums);
    expect(prefix).toEqual([0, 3, 4, 8, 9, 14]);
    expect(rangeSum(prefix, 1, 3)).toBe(6);
    expect(rangeSum(prefix, 0, 4)).toBe(14);
    expect(rangeSum(prefix, 4, 4)).toBe(5);
    expect(countSubarraysWithSum(nums, 5)).toBe(3);
  });

  it('counts with zeros and negatives', () => {
    expect(countSubarraysWithSum([0, 0, 0], 0)).toBe(6);
    expect(countSubarraysWithSum([1, -1, 1], 0)).toBe(2);
    expect(countSubarraysWithSum([1, 2, 3], 7)).toBe(0);
  });

  it('matches a brute-force sum on every range of random arrays', () => {
    const next = rng(SEED);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: between(next, 1, 20) }, () =>
        between(next, -50, 50),
      );
      const prefix = buildPrefix(nums);
      const where = `seed ${SEED}, trial ${trial}, nums [${nums}]`;
      for (let left = 0; left < nums.length; left++) {
        for (let right = left; right < nums.length; right++) {
          const context = `${where}, range [${left}, ${right}]`;
          expect(rangeSum(prefix, left, right), context).toBe(
            sum(nums.slice(left, right + 1)),
          );
        }
      }
    }
  });

  it('matches a brute-force count on random arrays', () => {
    const next = rng(SEED);
    for (let trial = 0; trial < 50; trial++) {
      const nums = Array.from({ length: between(next, 1, 15) }, () =>
        between(next, -3, 3),
      );
      const k = between(next, -3, 3);
      expect(
        countSubarraysWithSum(nums, k),
        `seed ${SEED}, trial ${trial}, nums [${nums}], k ${k}`,
      ).toBe(bruteCount(nums, k));
    }
  });
});
```

---

### DS-01 — a TypeScript bug the tests don't reach (trap for "the code is correct" and "the tests reach the edge cases")

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation (the only one):** the TypeScript loop in `buildPrefix`
stops one element early, so `prefix[n]` stays 0 and every range that ends at
the last element is wrong (`rangeSum(buildPrefix([3, 1, 4, 1, 5]), 0, 4)`
returns 0, not 14). The weakened TypeScript tests still pass (3 of 3, run
against the bugged file), since `rangeSum(prefix, 1, 3)` is 6 with or without
the bug and `countSubarraysWithSum` doesn't use `buildPrefix`. The Python code
and tests are unchanged and correct, and the comments in both files are
unchanged, so the TypeScript comment on the loop body still describes the
correct code.
**Replacements in the base:** in both `prefix-sums.ts` and the entry's first
typescript fence, replace `  for (let i = 0; i < nums.length; i++) {` with:

```typescript
  for (let i = 0; i < nums.length - 1; i++) {
```

and replace `prefix-sums.test.ts` with:

```typescript
import { describe, expect, it } from 'vitest';
import { buildPrefix, countSubarraysWithSum, rangeSum } from './prefix-sums';

describe('prefix sums', () => {
  it('handles empty input', () => {
    expect(buildPrefix([])).toEqual([0]);
    expect(countSubarraysWithSum([], 0)).toBe(0);
  });

  it('sums the middle of the worked example', () => {
    expect(rangeSum(buildPrefix([3, 1, 4, 1, 5]), 1, 3)).toBe(6);
  });

  it('counts subarrays with a given sum', () => {
    expect(countSubarraysWithSum([3, 1, 4, 1, 5], 5)).toBe(3);
    expect(countSubarraysWithSum([0, 0, 0], 0)).toBe(6);
    expect(countSubarraysWithSum([1, -1, 1], 0)).toBe(2);
  });
});
```

**Expected finding:** flags the TypeScript loop bound in `buildPrefix`: the
last element is never added, so `prefix` ends in 0 and any range ending at the
last position is wrong, unlike the Python version; and notes that the
TypeScript tests never check a range that reaches the end (or the whole
`prefix` array, or random ranges), which is why they pass.
**Fails if:** the review doesn't flag the loop bound, or flags only the thin
tests without finding the bug they miss.

---

### DS-02 — a walkthrough paragraph that narrates (trap for "connects the step, doesn't narrate it")

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation (the only one):** the paragraph after the second pair
narrates what `range_sum` does, step by step, in words the code already says:
it takes the arguments, reads two slots, subtracts, returns. It adds no reason
(the comment already carries why it reads `prefix[right + 1]`, so the
paragraph shouldn't repeat that either), no check against the example, and no
link to the next step: nothing says why the counting function that follows
switches from an array to a hash map. The code, its comments and the Pitfalls
are unchanged, so the entry isn't wrong; this paragraph just doesn't do a
walkthrough paragraph's job.
**Replacement in the base:** replace the paragraph that starts "That's two
reads and a subtraction however long the range is," with:

```markdown
The `range_sum` function takes the prefix array, a left position and a right
position. It reads `prefix[right + 1]`, then reads `prefix[left]`, subtracts
the second value from the first, and returns the difference.
```

**Expected finding:** flags this paragraph as narration: it restates the two
lines of code above it in prose, adds nothing the code and its comment don't
already say, and doesn't connect the pair to the next step (the counting
function and why its totals go into a hash map), against the skill's rule that
a walkthrough paragraph connects its pair to the next step and the checklist's
"flag a comment or paragraph that just narrates what a line does."
**Fails if:** the review doesn't flag the paragraph, or flags only the other
walkthrough paragraphs or the comments.

---

### DS-03 — clean entry (false-positive control)

**Reviewed with:** `add-dsa-entry`'s Stage 3 instruction.
**Planted violation:** none. The base, verbatim. The code is correct in both
languages, every line where the obvious alternative breaks (the n + 1 slots,
writing slot `i + 1`, `prefix[right + 1]`, seeding the count with the empty
prefix, looking up before recording) has a comment giving the reason, the same
in both files, and every non-blank line of each file appears once in the
walkthrough, in order. Each walkthrough paragraph checks its pair against the
example and hands off to the next step without repeating the comments. The
worked example holds (prefix `[0, 3, 4, 8, 9, 14]`;
`prefix[4] - prefix[1] = 6`; `prefix[3] - prefix[1] = 5`, missing the 1 at
position 3; with `k = 5`, totals 8, 9 and 14 pair with 3, 4 and 9 for three
subarrays `[1, 4]`, `[4, 1]`, `[5]`; with no seed and `k = 8`, `[3, 1, 4]` is
missed and the result is 0, not 1; with the two loop lines swapped and
`k = 0`, the result is 5, not 0). The tests cover empty input, one element,
the worked example including ranges that reach both ends, zeros, negatives and
a sum that never occurs, every range of 50 seeded random arrays against a
brute-force sum and `itertools.accumulate`, and 50 seeded random counts against
a brute-force count, with the seed and trial in each assertion's message. The
complexity claims hold, a sliding window does fail once negative values are
allowed, 2⁵³ is the limit of exact integers in a 64-bit float (larger ones
round), `itertools.accumulate` takes `initial=` from Python 3.8, a `Counter`
returns 0 for a missing key without inserting it, prefix XOR works because XOR
undoes itself, and `/dsa/hash-map` exists.
**Expected finding:** no finding that is false of the entry. Real gaps are
acceptable and go in the run's notes: the code is shorter than docs/dsa.md's
30–60 line guide (about 20 lines of Python without comments), there's no test
with duplicate values for `range_sum`, or the `Counter` import shows up in the
first pair, before the function that uses it.
**Fails if:** the review reports a defect that isn't true of the entry: a
"bug" in correct code, a wrong figure that's right, a comment or paragraph
called narration that does give a reason or connect a step, a missing
comment at a line that has one, or a correct technical statement called wrong.
