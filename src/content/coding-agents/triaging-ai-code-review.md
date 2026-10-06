---
title: 'Triaging AI Code Review: Keeping Adversarial Review From Bloating Your Codebase'
summary: Why an AI review loop that fixes every finding it's handed slowly fills a codebase with tests and rules nobody needed, and the triage step that keeps the reviewer's independence without the bloat.
date: 2026-09-29
---

Some AI coding workflows split a change across three separate agents: one
writes tests, one writes the code, and one reviews the result. An
[AI agent](/ai-and-ml/what-are-ai-agents) here means a language model that
can read files, run commands and edit code on its own. The reviewer is
**adversarial**: it's told to assume the change is wrong until it has checked
for itself, and it runs in a **fresh context**, a new session that hasn't seen
the conversation where the code was planned and written. It works because an
author reviewing their own work reads what they meant rather than what's
there, a blind spot
[keeping AI-native docs from going stale](/coding-agents/keeping-ai-native-docs-from-going-stale)
covers in more depth.

The trouble starts with what happens to the findings.

## How a review loop turns into bloat

A typical loop looks like this:

```
review → findings → fix every real finding (a test first, then the code) → review again → …
```

Three things in that loop push in the same direction:

1. **The reviewer grades its own findings.** Told to be adversarial, it will
   find something, and it decides how severe that something is.
2. **"Real" means "true", not "matters".** A finding that is technically
   correct becomes work, whether or not anything in the project could ever
   trigger it.
3. **Each fix adds a permanent test or rule.** The next review round reads the
   new code, finds the next edge case, and the cycle repeats.

Nothing in the loop ever asks whether a finding is worth fixing. After a few
rounds the project carries tests for inputs no one will write and rules
nobody needs, and every future change has to keep them passing.

## A worked example

Suppose a project publishes markdown articles and has a check that every
bullet in an article's summary section links to the section that explains
it. The check passes on every real article. A review round reports:

> Medium: a bullet list inside a blockquote isn't checked, so an unlinked
> bullet there would pass.

That's true. It's also true that no article in the project has ever put a
bullet list inside a blockquote, and the authoring guide doesn't suggest it.
If the finding goes straight to the fix loop, the project gains a
blockquote-walking branch in the check and a **test fixture** for it (a small
sample input the test runs against), and the next round finds the next shape:
lists nested three deep, links written in reference style (`[text][label]`,
with the address defined elsewhere in the file). In one real project, four rounds of this left a structure
test at nearly a thousand lines, most of them testing the checker itself
rather than the articles. Rewritten to inspect the rendered page instead, it
enforced the same rules in under three hundred.

## Triage: a step between review and fix

The reviewer stays adversarial, because that's what makes it good at finding
problems. What changes is who decides which findings become work, and how.

**The reviewer names a realistic trigger for every finding.** For app
behavior that's a real input or piece of content that hits the problem. For a
check, it's an edit an author following the project's own guide could
plausibly make, or a case the documentation says the check covers. A
mismatch between the docs and the check counts as a finding by itself. A
finding with no trigger is labelled **theoretical**.

**Someone in the developer's role confirms or disputes it.** An agent separate from the reviewer, often the one that implements fixes, checks each finding against the current code:
does the input occur, does the problem reproduce, can anything reach it? It
reproduces in a scratch copy of the project, so checking a finding can't
change the code under review. The two roles lean opposite ways: a reviewer
tends to overrate what it finds, and a developer tends to wave findings off.
The person who owns the product decides the ones they disagree on, much as a product owner takes a tester's bug
report back to the developers before anyone starts work.

**Each finding gets exactly one outcome:**

| Outcome          | When                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fix, with a test | The problem is reachable with real inputs and could come back.                                                           |
| Fix, no new test | Prose, docs or layout, where a test would only restate the change.                                                       |
| Known limitation | True, but nothing realistic reaches it, or the fix costs more than the risk. Written down where the next reader sees it. |
| Reject           | Not true of the current code, with the evidence that shows it.                                                           |

The blockquote finding above is a known limitation: true, recorded in the
pull request, and not fixed until an article actually uses that shape.

Impact counts as much as likelihood. A class of bug whose damage is severe (a security hole such as [prompt injection](/ai-and-ml/prompt-injection),
lost data, money created or destroyed) isn't dismissed because it hasn't
happened yet. Triage weighs how bad it would be against how likely it is,
and for those classes "unlikely" isn't enough. If the project has written
rules it treats as non-negotiable, breaking one is always a fix, and only
the person who owns those rules can waive it.

Rejects and known limitations are written down where the next review round
will read them, and a reviewer raises one again only with new evidence;
otherwise every round re-litigates the last. New tests have to earn their
place too. A **regression test**, one that exists to catch a fixed problem
coming back, is added only for "fix, with a test", and it runs against real
output (the rendered page, the real config file) rather than a
re-implementation of it, since passing on a copy proves nothing about the real
thing. Finally, the loop needs both a cap and a severity bar. A small cap, such as two rounds, keeps the loop bounded; past it, only high-severity findings justify
another round, and anything lower becomes a known limitation by default and
goes to the owner.

## This is ordinary engineering practice

Google's published code review guide
tells reviewers to approve a change once it clearly improves the code's
overall health, even if it isn't perfect, and treats many comments as
suggestions the author can push back on. Bug trackers separate a bug's
severity (how bad) from its priority (how soon), and "won't fix" is a normal
resolution. Security work sizes a defense to a **threat model**, a written
account of who might attack and how, rather than to every input anyone can
imagine. And the usual testing advice, the [testing pyramid](/engineering-practices/testing-pyramid)
among it, is to test a behavior once, at the lowest layer that proves it.

What AI review changes is volume. An agent can produce a dozen plausible findings, and a fix for each, in minutes, so a loop without
triage accumulates far faster than a human team would. The same judgment
applies; it just has to be written into the process, because nobody in an
automated loop will apply it by instinct.

## Where it fits in the tooling

Triage is one of the process rules an AI-assisted project keeps somewhere an
agent will read it. [Documentation, skill or hook?](/coding-agents/documentation-vs-skill-vs-hook)
covers where a rule like this should live, and
[keeping AI-native docs from going stale](/coding-agents/keeping-ai-native-docs-from-going-stale)
covers keeping it true. To see whether a reviewer still catches what it should
after its instructions change, use [evals](/ai-and-ml/what-are-evals): a
planted defect it must find and a clean control it must not invent findings
for. Run both after any change to the review or triage rules, because a
"theoretical" label that lets a real defect through is exactly the failure
triage could introduce.
