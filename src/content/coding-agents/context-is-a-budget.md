---
title: Context Budget for an AI Coding Harness
summary: Every rule, skill and check added to steer a coding agent costs space and attention on every run, so a harness stays useful only if additions are justified and removals are routine.
date: 2026-09-30
---

Suppose a team uses an AI coding agent on the repository for their web shop, and one day the agent pushes a broken change straight to the main branch. Somebody adds a line to the instruction file, a text file the agent reads at the start of every session: "Always run the full test suite before committing." Fixed. But six months of lines like that later, is the agent better off or worse?

This page follows that file as it grows: the pieces that get built around it, why they keep multiplying, what each one costs, and how to cut them back.

## How the pile builds up

The first line is the whole setup. Next week the agent rounds prices wrongly in the checkout code, so the team writes a longer guide to how the shop handles money. It is too long for the instruction file, so it goes in a separate file that the agent loads only when a task touches payments. That kind of task-specific instruction file is a **skill**.

Then the agent edits a generated file that gets overwritten on the next build. A short script is set up to run automatically whenever the agent tries to edit that folder and to refuse. A script that fires on the agent's actions is a **hook**. Later someone adds a script to the build that fails if a price is ever stored as a floating-point number, which rounds cents. That is a **check**.

Together these pieces, which steer the agent without being part of the shop, are the **harness**, and [Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers which form a given rule should take. This page is about how many pieces there should be.

## Why does it keep growing?

After every bad week the team adds something that fixes the problem somebody just saw. Removal feels risky, because nobody can say what a sentence was preventing, so it stays. Each addition also makes the next one look normal. By month six the shop's instruction file has 40 rules.

## What does one line cost?

Models read text in chunks called [tokens](/ai-and-ml/tokenization). Everything the agent reads sits in its [context window](/ai-and-ml/context-window), the limited amount of text it can consider at once. The always-loaded file is in that window on every turn. Work out what the shop's file costs:

```text
40 rules × 60 words (a rule plus its reason) = 2,400 words
2,400 words × 4 tokens per 3 words ≈ 3,200 tokens
```

A session often starts **subagents**, separate agents the main one hands a subtask to, and each loads the file again. With three of them, the file takes 3,200 tokens in each of four windows, 4 × 3,200 = 12,800 tokens read before any work starts. Prompt caching, where the provider reuses work on text it has already processed, can make those repeat reads cheaper in money, but each window loses the space either way.

Space is the smaller cost. The bigger one is focus: instructions compete. With 40 rules the model has to work out which apply, and the one that matters can get less weight among many that don't, the way a long checklist gets skimmed. Then there is upkeep. If the team renames a folder, every rule that mentions it is now false, and a false rule is worse than none, because the agent follows it. [Keeping Agent Docs Current](/coding-agents/keeping-ai-native-docs-from-going-stale) covers that problem, and fewer rules means less of it.

So how do you cut the file down without losing what the rules protect?

## Keeping it lean

Start with the always-loaded file. It should be a router that says where things are, not a container for them:

```markdown
| When you are…                | Read first           |
| ---------------------------- | -------------------- |
| Touching checkout or prices  | docs/money.md        |
| Changing the UI              | docs/design.md       |
| Running or debugging a check | docs/verification.md |
```

Detail lives in the file for that task and is read only when the task comes up. The shop's 40 rules become a dozen lines and three task files. A line limit enforced by a check keeps the router from refilling.

Before adding anything, ask five questions. What happened that demands it? A problem that occurred counts; "best practice" doesn't. Does it already exist under another name? Who reads it, and when? "Every agent, every session" is a reason for doubt. What keeps it true? What could be removed to make room?

Run the opening line through them. What happened? An agent committed a change that broke tests. Does it exist? The **pull request**, the step where a change is proposed before merging, already runs the test suite and can refuse a failing change. Who reads it? Every agent in every session, including the many that never commit. What keeps it true? Nothing; it's a sentence. The gap is that the agent could skip the pull request altogether. A repository setting that forbids direct pushes to main closes it, and nobody has to remember a rule.

That is the general pattern: a check often beats a sentence. A rule works only if the agent reads and follows it, while a script that fails the build behaves the same way each time and can replace a paragraph instead of adding one. Checks have upkeep too, though, and a growing pile of them is its own bloat.

Deletion has to be scheduled, because nothing in the cycle removes anything on its own. Every few months the team audits the harness and must name at least one thing to delete or merge. That raises the opposite worry: can a team cut too much?

## Is smaller always better?

No. A check that has caught real mistakes costs something, and so does an [eval](/ai-and-ml/what-are-evals), a test of whether the harness still steers the agent as intended, but each has an incident or a result to point to. The goal is a harness where every piece is there for a reason someone can name.

**Rule of thumb.** Before adding a rule to what an agent reads, name the incident behind it and what would remove it; if a check or a setting can enforce it, prefer that, and delete something each time you audit.
