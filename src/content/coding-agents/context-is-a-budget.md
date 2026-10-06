---
title: 'Context Is a Budget: Keeping an AI Coding Harness Lean'
summary: Why the rules, skills and checks that steer a coding agent keep growing, what each addition costs on every run, and the habits that keep a harness small enough to stay useful.
date: 2026-09-30
---

A **harness** is everything in a repository that steers an AI coding agent
rather than making up the product itself: the instruction file the agent reads
at the start of every session, the skills and procedures it loads for
particular tasks, the hooks that fire on its actions, the checks it has to
pass, and the [evals](/ai-and-ml/what-are-evals) that test whether the rest
still works. [Documentation, skill or hook?](/coding-agents/documentation-vs-skill-vs-hook)
covers which of those forms a rule should take. This topic is about how many
rules there should be.

## Why a harness grows

An agent does something wrong and a sentence goes into its instructions
telling it not to. When a review turns up a gap, the fix is usually a new
check. After a **run** (one agent session, or one pass of a change through a
multi-step pipeline) goes badly, the **retrospective**, a look back at what
went wrong, tends to propose one more step. Each addition is reasonable, and
each is visible work that fixes a problem somebody just saw. Removing
something feels riskier: nobody can be sure what a sentence was preventing,
so it stays, and each addition makes the next one look normal.

## What an addition costs

**Tokens.** Models read text in chunks called
[tokens](/ai-and-ml/tokenization), and everything an agent reads takes up part
of its [context window](/ai-and-ml/context-window), the fixed amount of text it
can consider at once. A file loaded at the start of every session sits in that
window on every turn of every session, and in every **subagent** (a separate
agent the main one starts for a subtask) that loads it too. Caching, where a
provider reuses work on text it has seen before, can make those repeat reads
cheaper in money, but the space is used either way.

**Focus.** Instructions compete. A model given forty rules has to work out
which ones apply, and a rule that matters can get less weight among many that
don't, the same way a long checklist gets skimmed. The more rules there are,
the less likely any one of them is to be followed.

Then there's upkeep. Every rule has to stay true as the code changes around
it, and a rule that has quietly become false is worse than no rule, because
the agent follows it. [Keeping AI-native docs from going stale](/coding-agents/keeping-ai-native-docs-from-going-stale)
covers that problem; the fewer rules there are, the less of it there is.

One project added a fix for each problem it hit for under three weeks and
ended up with about 52,000 words of process documents (not counting design
specs, which agents read only when looking up a decision) next to about
144,000 words of published content. Cutting duplicated text, moving
explanations out of the files agents work from, and collapsing run logs to a
summary table brought that to about 38,000 words. One rule went entirely:
whenever a new check read the site's markdown, the plan for it had to list
every way the markdown could be laid out (a list nested in a list, a list
inside a quote, a link written in reference style), and in practice each
**review round**, one pass of review and fixes, turned another of those into a
test. [Triaging AI code review](/coding-agents/triaging-ai-code-review)
covers what replaced it.

## Keeping it lean

**Keep always-loaded files as routers.** The instruction file every session
reads should say where things are, not contain them:

```markdown
| When you are…                | Read first           |
| ---------------------------- | -------------------- |
| Adding a topic               | docs/content.md      |
| Changing UI                  | docs/DESIGN.md       |
| Running or debugging a check | docs/verification.md |
```

Detail lives in the file for that task and is read only when the task comes
up. A line limit that a check enforces keeps the router from filling up again.

Before adding anything, answer five questions:

1. What happened that demands this? A problem that occurred counts; "best
   practice" or "might be useful" doesn't.
2. Does it already exist, perhaps under another name?
3. Who reads it, and when? "Every agent, every session" is a reason for doubt.
4. What keeps it true? Name the check or the review that would notice when it
   goes stale.
5. What could be removed to make room?

Take a proposed rule for the always-loaded file: "Always run the full test
suite before committing." What happened? An agent committed a change that
broke tests. Does it exist? The pull request, the step where a change is
proposed before it's merged, already runs the suite and refuses to merge a
failing change. Who reads it? Every agent, every session, including the many
that never commit. What keeps it true? Nothing; it's a sentence. What could
go? It would only add. The real gap turns out to be that the agent pushed
straight to the main branch and skipped the pull request, and a branch setting
that forbids direct pushes closes it without anyone having to remember a rule.

A check like that is often better than a sentence. A rule an agent must
remember works only if it's read and followed, while a script that fails the
build behaves the same way every time it runs, for whatever it tests, and it
can replace a paragraph of instructions instead of adding one. Checks have
upkeep of their own, though, and a check that keeps growing is its own kind of
bloat. The stale-docs topic linked above makes the case for layering checks
under the prose.

Deletion has to be part of the routine, because nothing else in the cycle
removes anything. A periodic audit of the harness should name at least one
thing to delete or merge, and a retrospective should ask whether something
could be removed or simplified before it proposes anything new. When a run
is expensive, record where the cost went (how many agent runs, which stage,
how many review rounds) before adding steps to fix it. Without that number, a
process change is a guess, and guessing usually means adding.

## Where the line is

Lean doesn't mean minimal. A check that has caught real mistakes, a review
that finds real bugs, and an eval that shows the reviewer still works each
cost something too, and each has an incident or a result to point to. The
goal is that everything in the harness is there for a reason someone can
name, so an agent, or a person, can trust that every rule it reads matters.
