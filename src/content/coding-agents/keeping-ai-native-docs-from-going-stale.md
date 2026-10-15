---
title: Keeping Agent Docs Current
summary: Why the instructions that steer a coding agent go stale faster than ordinary docs, and the layers of checks that shorten how long a stale line survives.
date: 2026-09-14
---

Picture a repository where a coding agent does much of the work. At the start of every session the agent reads an **instructions file**, a plain document of rules for working in this repository. One line says: "Run `make test` before every commit." Last month the team moved to a different build tool, and the right command is now `npm test`. Nobody updated the line. What happens next, and how do you stop it from happening again?

This page follows that one stale line: why it does more damage than a stale line in ordinary docs, why "just remember to update it" fails, and the five layers that each catch it at a different moment.

## What a stale line does to an agent

The agent runs `make test`, gets an error, and either improvises or reports success on a check that never ran. A human reading the same line would likely shrug and ask a teammate. The agent usually won't stop to ask. It does what the file says.

Ordinary docs describe the code, so a wrong line confuses a reader. An agent's instructions are part of how the work gets done, so a wrong line steers the work. From the inside, "do what the instructions say" and "do the right thing" look identical, which is why a stale line produces confident wrong work.

The instructions file is one of three places such steering lives. The other two are named procedures the agent can be told to run (skills), and automated triggers that fire on certain actions (hooks). [Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers which belongs where. All three change whenever the process changes.

## Why "update the docs when you change something" isn't enough

Add a rule to the instructions: when you change a convention, update the file. Whoever switched `make` to `npm`, often an agent, would then fix the line too.

That works only when the author remembers, and the author is the worst-placed person to notice a gap. They already hold the new state in their head, so the omission looks normal, the way a typo you just typed slips past your own proofreading. A rule that depends on the mind that made the change is least reliable in exactly the case it exists for.

So you add layers that don't depend on the author's memory, ordered here from cheapest to most thorough.

## Layer 1: remove the second copy

If the instructions file lists the test command and the build config also defines it, there are two copies, and two copies can disagree. Point the file at the config instead: "run the project's test script." Now the build tool can change and the line stays true. A fact that is never copied can't drift.

This works whenever the other place is something the agent can read. When the fact has to be written out in prose, you need a way to notice that it changed.

## Layer 2: test anything mechanical

Some claims in a doc can be checked by a program: this file exists, this folder matches this list, this command appears in the build config. A test that fails the build the moment they disagree beats a comment saying "keep these in sync." For our example, a check that every command named in the instructions file exists as a script fails on the day the tool changes, with no one needing to remember anything.

A test can only check what a program can read. "This section describes the release process" is a claim about meaning.

## Layer 3: have someone else read it

A claim about meaning needs a reader who didn't write the change, the same reason code review exists. A reviewer asked "what docs does this change affect?" will often catch what the author's memory missed. The reviewer can be another person or a separate agent with fresh context.

Review only sees changes that go through review, though, and small direct edits often skip it.

## Layer 4: prompt where every change passes

Every change, however it was made, passes through one point: just before it ships. A reminder wired to that moment, such as a **hook** on the commit or push command, can ask "did this change anything the docs describe?" It doesn't need to block anything. It only needs to put the question in front of someone.

Review and the reminder each see one change at a time. Drift also builds up from many small changes, none of which triggered any check alone.

## Layer 5: sweep the whole repo now and then

Occasionally read every doc and compare each claim against the current repository. A full read is expensive, so run it on a schedule or after a batch of changes, not on every commit.

## What the layers buy you

Back to the stale `make test` line. With a single source, it never existed. Without one, the test catches it the day the build config changes, the reminder catches it at commit time, the reviewer catches it when the change is proposed for merging, and the sweep catches it eventually. Each layer sees a different slice of the problem, and a line slips through only if every layer misses it.

So none of this makes documentation correct forever. What changes is how long a stale line survives: from "until someone trips over it, perhaps never" to "until the next related change or the next sweep." Each layer also costs something to run and maintain, so add them in the order above and stop when the gap is short enough that it stops mattering. The same logic favors small instructions: [Context Budget for an AI Coding Harness](/coding-agents/context-is-a-budget) explains why fewer, shorter instructions are also fewer places to go stale.

**Rule of thumb.** Store each fact in one place, test what a program can check, have someone other than the author read the rest, and sweep the whole repo on a schedule for what slipped through.
