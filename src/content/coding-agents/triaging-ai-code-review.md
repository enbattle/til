---
title: Triaging AI Code Review
summary: A review loop that fixes every finding it's handed fills a project with tests nobody needed, and a triage step between review and fix stops that.
date: 2026-09-29
---

Imagine a project that publishes markdown articles. One of its checks says every bullet in an article's summary section must link to the section that explains it. The check passes on every article. Then an AI reviewer reports:

> Medium: a bullet list inside a blockquote isn't checked, so an unlinked bullet there would pass.

Should you fix that? The answer depends on how the review is set up.

## Where the reviewer comes from

Some AI coding workflows split a change across separate agents: one writes tests, one writes the code, one reviews. An [AI agent](/ai-and-ml/what-are-ai-agents) here is a language model that can read files, run commands and edit code on its own. The reviewer is **adversarial**: it's told to assume the change is wrong until it has checked for itself. It also runs in a **fresh context**, a new session that hasn't seen the conversation where the code was planned. An author reviewing their own work tends to read what they meant rather than what's there, a blind spot [Keeping Agent Docs Current](/coding-agents/keeping-ai-native-docs-from-going-stale) also covers.

That setup is good at finding problems. The trouble is what happens to the findings.

## How a review loop turns into bloat

A naive loop looks like this:

```
review → findings → fix every true finding (test first, then code) → review again → …
```

Three things in it push the same way. The reviewer grades the severity of its own findings, and being adversarial, it will find something. A finding that is true becomes work, whether or not anything could ever trigger it. And each fix adds a permanent test or rule, which gives the next round fresh code to attack.

Back in our project, the blockquote finding is true. It's also true that no article has put a bullet list inside a blockquote, and the authoring guide doesn't suggest it. Sent straight to the fix loop, it adds a branch to the check plus a **test fixture** (a small sample input the test runs against). The next round then finds lists nested three deep, or links in reference style (`[text][label]`, with the address defined elsewhere in the file). In one project, four rounds of this left a structure test of nearly a thousand lines, most of it testing the checker rather than the articles.

## Triage: a step between review and fix

The reviewer stays adversarial. What changes is who decides which findings become work.

**The reviewer names a realistic trigger for each finding.** For app behavior, that's a real input that hits the problem. For a check, it's an edit an author following the project's own guide could plausibly make, or a case the documentation says the check covers; a mismatch between the docs and the check is itself a finding. A finding with no trigger is labelled **theoretical**.

**A second party confirms or disputes it.** Usually that's the agent that implements fixes, checking each finding against the current code in a scratch copy, so the checking doesn't change the code under review: does the input occur, does the problem reproduce? The two roles lean opposite ways. A reviewer tends to overrate what it finds, and an implementer tends to wave findings off. The person who owns the product settles disputes.

**Each finding gets one outcome:**

| Outcome          | When                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Fix, with a test | The problem is reachable with real inputs and could come back.                                                           |
| Fix, no new test | Prose, docs or layout, where a test would only restate the change.                                                       |
| Known limitation | True, but nothing realistic reaches it, or the fix costs more than the risk. Written down where the next reader sees it. |
| Reject           | Not true of the current code, with the evidence that shows it.                                                           |

The blockquote finding is a known limitation: recorded in the pull request, and not fixed until an article uses that shape.

Does "unlikely" always settle it? No, because impact counts as much as likelihood. A class of bug whose damage is severe, such as a security hole like [prompt injection](/ai-and-ml/prompt-injection), lost data, or money created or destroyed, isn't dismissed because it hasn't happened yet. If the project has written rules it treats as non-negotiable, breaking one is a fix, and only the rules' owner can waive it.

## Keeping the loop from restarting

Rejects and known limitations go where the next round will read them, and a reviewer raises one again only with new evidence. Otherwise every round re-argues the last.

New tests have to earn their place too. A **regression test** exists to catch a fixed problem coming back, and it's added only for "fix, with a test". It should run against real output, such as the rendered page, rather than a re-implementation of it, since passing on a copy proves nothing about the real thing. In that project, the structure test was rewritten to check the rendered page instead, and it enforced the same rules in under three hundred lines.

Finally, give the loop a cap and a severity bar. A small cap, such as two rounds, keeps it bounded. Past the cap, only high-severity findings justify another round, and anything lower becomes a known limitation by default and goes to the owner.

## Ordinary engineering, at higher volume

None of this is new. Bug trackers separate severity (how bad) from priority (how soon), and "won't fix" is a normal resolution. The usual testing advice, the [testing pyramid](/engineering-practices/testing-pyramid) among it, is to test a behavior once, at the lowest layer that proves it.

What AI review changes is volume. An agent can produce a dozen plausible findings, and a fix for each, in minutes. Where should the triage rule live? [Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers the choice. To check that a reviewer still catches what it should after its instructions change, use [evals](/ai-and-ml/what-are-evals): a planted defect it must find, and a clean control it must not invent findings for.

**Rule of thumb.** Let the reviewer find everything, but make a finding earn its fix: name a trigger a real input or author could hit, weigh impact as well as likelihood, and write down what you decline so it isn't argued again.
