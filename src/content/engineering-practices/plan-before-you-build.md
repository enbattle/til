---
title: Plan Before You Build: How Engineering Teams Work Before Writing Code
summary: Why experienced teams write a short design doc and get alignment before the first line of code.
date: 2026-09-13
---

It's tempting to treat "start coding" as the first step of building
something. For a five-minute fix, that's fine. For anything bigger — a new
feature, a system that touches several parts of a codebase, a decision
that's expensive to reverse — teams that build reliably do something less
obvious first: they write down the problem and the proposed approach, in
plain language, before touching an editor.

## Why bother writing anything down first

Code is a very expensive way to ask "does this make sense?" Writing a
paragraph that says what you're building and why takes minutes; writing,
testing, and then discovering the approach was wrong can take days. A
short written plan is a cheap place to catch:

- **A misunderstood problem.** Maybe the real complaint wasn't what you
  assumed it was.
- **A missed constraint.** Someone reading the plan might know a reason
  the obvious approach won't work.
- **Multiple reasonable approaches**, each with different trade-offs
  (speed vs. flexibility, simplicity vs. future-proofing) that are worth
  choosing between deliberately instead of by accident.

This is the same reason architects draw blueprints before pouring
concrete: changing a drawing costs nothing; changing a poured foundation
costs a great deal.

## What this looks like in practice

Different companies give it different names — a **design doc**, an
**RFC** (Request for Comments), a **PRD** (Product Requirements
Document) — but the shape is similar. A short design doc usually answers:

1. **What problem are we solving, and for whom?** Not "what are we
   building," but what's broken or missing without this.
2. **What's the proposed approach?** Described in prose and rough
   diagrams, not code.
3. **What are the alternatives, and why not those?** Naming the roads not
   taken is what makes a decision look deliberate instead of arbitrary.
4. **What's explicitly out of scope?** Just as important as what's in —
   it stops a small change from quietly growing.

The document is short on purpose — long enough to think clearly, short
enough that a teammate will actually read the whole thing. At companies
with a strong writing culture — Amazon's six-page narrative memos are the
best-known example — this is a normal part of shipping anything
nontrivial, not extra bureaucracy layered on top of "real work."

Not every decision needs a full document. Many teams keep a lightweight
**decision log** — a running table of `Decision | Date | Why | Alternatives
considered` — for smaller calls that still deserve a written reason, without
the overhead of a full doc.

## Capturing _why_, not just _what_

Once a decision is made, some teams also write a short **ADR**
(Architecture Decision Record): a few paragraphs, checked into the
repository next to the code, that says what was decided and why. The
value shows up months later, when someone (often the same person who
wrote it) is staring at an unusual piece of code and wondering "why is
this done this way?" A commit message answers _what_ changed. An ADR
answers _why_ — including the option that seemed obviously better and
turned out not to be.

## Getting alignment before scaling up

Once a plan exists, it gets reviewed — by a teammate, a tech lead, or
whoever else the decision affects — _before_ significant work begins. This
step is what actually saves time: a five-minute comment on a doc ("have
you considered X?") is far cheaper than the same feedback arriving after
a week of work is already built the other way.

After alignment, the next habit worth borrowing is building a **thin
vertical slice** first: the smallest version of the thing that works
end-to-end, rather than building every layer to completion before
connecting them. A thin slice proves the shape of the approach is right
while it's still cheap to change, and gives everyone something real to
react to instead of reacting to a document.

## When to skip all of this

None of this is a ritual to perform on every task. A one-line bug fix or
a well-understood, low-risk change doesn't need a design doc — writing
one would cost more than it saves. The judgment call is proportional: the
less certain the approach, the more expensive it is to reverse, or the
more people it affects, the more it's worth putting the plan in writing
before the code.
