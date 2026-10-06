---
title: Context Budget for an AI Coding Harness
summary: Every rule, skill and check added to steer a coding agent costs space and attention on every run, so a harness stays useful only if additions are justified and removals are routine.
date: 2026-09-30
---

Suppose an agent pushes a broken change straight to your main branch. Somebody adds a line to the file the agent reads at the start of each session: "Always run the full test suite before committing." That line is the first step of a harness. A **harness** is everything in a repository that steers an AI coding agent without being part of the product: the instruction file, the skills it loads for particular tasks, the hooks that fire on its actions, the checks it must pass, and the [evals](/ai-and-ml/what-are-evals) that test whether the rest still works. [Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers which form a rule should take. This topic is about how many rules there should be.

## Why does it keep growing?

Each addition is reasonable. A sentence goes in after an agent does something wrong. A review turns up a gap, so a check goes in. After a **run** (one agent session, or one pass of a change through a multi-step pipeline) goes badly, the **retrospective**, a look back at what went wrong, proposes one more step. Every addition is visible work that fixes a problem somebody just saw. Removal feels risky because nobody can be sure what a sentence was preventing, so it stays, and each addition makes the next look normal.

## What does one line cost?

Models read text in chunks called [tokens](/ai-and-ml/tokenization), and everything the agent reads occupies its [context window](/ai-and-ml/context-window), the limited amount of text it can consider at once. A file loaded at the start of every session sits there on every turn, and again in every **subagent**, a separate agent the main one starts for a subtask, that loads it. Caching, where a provider reuses work on text it has seen before, can make repeat reads cheaper in money, but the space is used either way.

Space is the smaller cost. The bigger one is focus: instructions compete. With forty rules, the model has to work out which apply, and the one that matters can get less weight among many that don't, the way a long checklist gets skimmed. Then there is upkeep. A rule has to stay true as the code changes, and one that has quietly become false is worse than none, because the agent follows it. [Keeping Agent Docs Current](/coding-agents/keeping-ai-native-docs-from-going-stale) covers that problem, and fewer rules means less of it.

One project added a fix for each problem it hit and, in under three weeks, had about 52,000 words of process documents (design specs excluded) beside about 144,000 words of published content. Cutting duplicated text, moving explanations out of the files agents work from, and collapsing run logs to a table brought it to about 38,000. One rule went entirely: the plan for every new check on the site's markdown had to list all the ways the markdown could be laid out, and each **review round**, one pass of review and fixes, turned another layout into a test. [Triaging AI code review](/coding-agents/triaging-ai-code-review) covers what replaced it.

## Keeping it lean

Start with the always-loaded file. It should be a router that says where things are, not a container for them:

```markdown
| When you are…                | Read first           |
| ---------------------------- | -------------------- |
| Adding a topic               | docs/content.md      |
| Changing UI                  | docs/DESIGN.md       |
| Running or debugging a check | docs/verification.md |
```

Detail lives in the file for that task and is read only when the task comes up. A line limit enforced by a check keeps the router from refilling.

Before adding anything, ask five questions. What happened that demands it? A problem that occurred counts; "best practice" doesn't. Does it already exist under another name? Who reads it, and when? "Every agent, every session" is a reason for doubt. What keeps it true? What could be removed to make room?

Run the opening rule through them. What happened? An agent committed a change that broke tests. Does it exist? The **pull request**, the step where a change is proposed before merging, already runs the suite and can refuse a failing change. Who reads it? Every agent in every session, including the many that never commit. What keeps it true? Nothing; it's a sentence. What could go? Nothing, it only adds. The gap is that the agent could skip the pull request at all. A branch setting that forbids direct pushes closes it, and nobody has to remember a rule.

That's the general pattern: a check often beats a sentence. A rule works only if the agent reads and follows it, while a script that fails the build behaves the same way each run and can replace a paragraph instead of adding one. Checks have upkeep too, and a growing pile of them is its own bloat.

Deletion has to be scheduled, because nothing in the cycle removes anything on its own. A periodic audit should name at least one thing to delete or merge, and a retrospective should ask what could be removed before it proposes anything new. When a run is expensive, record where the cost went (agent runs, stage, review rounds) before adding steps; without that number, a process change is a guess, and guessing tends toward adding.

## Is smaller always better?

No. A check that has caught real mistakes, a review that finds real bugs, and an eval that shows the reviewer still works each cost something too, and each has an incident or a result to point to. The goal is a harness where every piece is there for a reason someone can name.

**Rule of thumb.** Before adding a rule to what an agent reads, name the incident behind it and what would remove it; if a check or a setting can enforce it, prefer that, and delete something each time you audit.
