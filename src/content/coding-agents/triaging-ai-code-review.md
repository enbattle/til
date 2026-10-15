---
title: Triaging AI Code Review
summary: A review loop that fixes every finding it's handed fills a project with tests nobody needed, and a triage step between review and fix stops that.
date: 2026-09-29
---

A teammate opens a **pull request**, a proposed code change that others review before it's merged. It adds `validateSignup`, which checks a sign-up form: the email must contain an `@`, and the password must be at least 8 characters. An AI reviewer reads the change and reports four findings.

Each finding has a **severity**, the reviewer's own label for how bad the problem is. High means real users are harmed or the system is exposed. Medium means wrong behavior in a less common case. Low means a rough edge, such as a confusing message.

```text
High:   Sam@x.com and sam@x.com register as two different people.
High:   Passwords are never checked for length.
Medium: An email address 5,000 characters long passes validation.
Low:    The error message says "invalid input" without saying which field.
```

Should the author fix all four? This page covers the reviewer, how a loop that fixes everything goes wrong, and the triage step that stops it.

## Where the reviewer comes from

Some AI coding workflows split a change across separate agents: one writes tests, one writes the code, one reviews. An [AI agent](/ai-and-ml/what-are-ai-agents) here is a language model that can read files, run commands and edit code on its own. The reviewer is **adversarial**: it's told to assume the change is wrong until it has checked for itself.

It also runs in a **fresh context**, a new session that hasn't seen the conversation where the code was planned. An author reviewing their own work tends to read what they meant rather than what's there. That setup is good at finding problems. The trouble is what happens to the findings.

## How a review loop turns into bloat

A naive loop looks like this:

```
review → findings → fix every true finding (test first, then code) → review again → …
```

Run it on the sign-up change. The author fixes every true finding, each with a new test, and sends the code back.

Three things in the loop push the same way. The reviewer grades its own findings, and being adversarial, it will find something. A true finding becomes work, whether or not anything could ever trigger it. And each fix adds a permanent test and a new branch of code, which gives the next round fresh code to attack.

So round two reports that an email with an invisible zero-width character passes, then one with a lookalike letter from another alphabet. Each is true, and each adds a check and a test. Say the six-line function reaches sixty lines, with most tests covering inputs nobody has ever typed. Nothing in the loop decides which true findings deserve work.

## Triage: a step between review and fix

**Triage** means sorting findings by what they deserve before anyone acts on them. The reviewer stays adversarial. What changes is who decides which findings become work.

**The reviewer names a realistic trigger for each finding**: a real input, or a real edit, that hits the problem. For an automated check, such as a lint rule, a gap between what its docs promise and what it does counts. A finding with no trigger is labelled **theoretical**. For the sign-up change, `Sam@x.com` has a trigger: someone retypes their address with a capital letter and gets a second account. The 5,000-character email has one only if someone crafts a request by hand.

**A second party confirms or disputes it.** Usually that's the agent that implements fixes: does the input occur, does the problem reproduce in a scratch copy of the code? A reviewer tends to overrate its findings and an implementer to wave them off, so each checks the other. The person who owns the product settles disputes.

**Each finding then gets one outcome:**

| Outcome          | When                                                                         | Sign-up example                                                |
| ---------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Fix, with a test | Reachable with real inputs, and could come back.                             | The capital-letter duplicate: compare emails in lowercase.     |
| Fix, no new test | Prose, docs or layout, where a test would only restate the change.           | The error message: name the field.                             |
| Known limitation | True, but nothing realistic reaches it, or the fix costs more than the risk. | The 5,000-character email: the database rejects it anyway.     |
| Reject           | Not true of the current code, with the evidence.                             | `validateSignup` already rejects passwords under 8 characters. |

Does "unlikely" always settle it? No, because impact counts as much as likelihood. A bug whose damage is severe, such as a security hole like [prompt injection](/ai-and-ml/prompt-injection), lost data, or money created or destroyed, isn't dismissed because it hasn't happened yet. If the team has written rules it treats as non-negotiable, breaking one is a fix, and only the rules' owner can waive it.

So a finding becomes work only once it has a real trigger, a second opinion and an outcome. Even so, the next round can bring the same arguments back.

## Keeping the loop from restarting

Rejects and known limitations go where the next round will read them, and a reviewer raises one again only with new evidence. Otherwise every round re-argues the last.

New tests have to earn their place too. A **regression test** exists to catch a fixed problem coming back, and it's added only for "fix, with a test". It should call the real `validateSignup`, not a re-implementation of its rules, since passing on a copy proves nothing about the real thing.

Finally, cap the loop, at two rounds say. Past the cap, only High findings justify another round, and anything lower becomes a known limitation and goes to the owner.

## Ordinary engineering, at higher volume

None of this is new. Bug trackers separate severity (how bad) from priority (how soon), and "won't fix" is a normal resolution. The [testing pyramid](/engineering-practices/testing-pyramid) says to test a behavior once, at the lowest layer that proves it. What AI review changes is volume: an agent can produce a dozen plausible findings, and a fix for each, in minutes.

[Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers where the triage rule should live. To check that a reviewer still catches what it should, use [evals](/ai-and-ml/what-are-evals): a planted defect it must find, and a clean control it must not invent findings for.

**Rule of thumb.** Let the reviewer find everything, but make a finding earn its fix: name a trigger a real input or edit could hit, weigh impact as well as likelihood, and write down what you decline so it isn't argued again.
