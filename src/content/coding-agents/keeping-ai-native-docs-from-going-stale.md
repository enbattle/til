---
title: Keeping Agent Docs Current
summary: Why the instructions that steer a coding agent go stale faster than ordinary docs, and the layers of checks that shorten how long a stale line survives.
date: 2026-09-14
---

Picture a repository where a coding agent does much of the work. Its instructions file, which the agent reads at the start of every session, says: "Run `make test` before every commit." Last month the team moved to a different build tool, and the right command is now `npm test`. Nobody updated the line. What happens next?

The agent runs `make test`, gets an error, and either improvises or reports success on a check that never ran. A human reading the same stale line would likely shrug and ask a teammate. The agent usually won't stop to ask, and it does what the file says.

## Why instructions drift faster than ordinary docs

Ordinary documentation describes code, and it goes stale when the code changes. An agent's instructions are different: they are part of how the work gets done. The instructions file, the named procedures the agent can be told to run (often called skills), and the automated triggers that fire on certain actions (hooks) all steer behavior directly. [Documentation vs. Skill vs. Hook](/coding-agents/documentation-vs-skill-vs-hook) covers which of the three a piece of guidance belongs in.

Because they steer behavior, they change whenever the process changes, and a wrong line does damage instead of just confusing a reader. The agent also can't tell. From the inside, "do what the instructions say" and "do the right thing" look the same, so a stale line produces confident wrong work.

## Why "the agent updates the docs" isn't enough

The obvious fix is a rule: when you change a convention, update the instructions. Whoever switched `make` to `npm`, often an agent, would then fix the line too.

That rule works only when the author remembers to apply it, and the author is the person worst placed to notice a gap. They already hold the new state in their head, so an omission looks normal, the way a typo you just typed slips past your own proofreading. A rule that depends on the same mind that made the change is least reliable in exactly the case it exists for. So you add checks that don't depend on the author's memory, and no single check catches everything.

## The layers, from cheapest to most thorough

**Remove the second copy.** The most reliable fix is a fact that exists in one place. If the instructions file lists the test command, and the build config already defines it, point the file at the config ("run the project's test script") instead of repeating the command. A fact that is never copied can't drift. This works whenever the other place is something the agent can read.

**Write a test for anything mechanical.** Some claims in a doc can be checked by a program: this file exists, this folder matches this list, this command appears in the build config. A test that fails the build the moment they disagree beats a comment saying "keep these in sync." For our example, a check that every command named in the instructions file exists as a script would have failed the day the tool changed.

**Have someone else read it.** A prose claim like "this section describes the release process" can't be asserted by a test. It needs a reader who didn't write the change, the same reason code review exists. A reviewer asked "what docs does this change affect?" will often catch what the author's own memory missed. That reviewer can be another person or a separate agent with fresh context.

**Prompt at the moment everything passes through.** Independent review covers only changes that go through the review process, and small direct edits often skip it. The point every change shares, however it was made, is just before it ships. A reminder wired to that moment, such as a hook on the commit or push command, can ask "did this change anything the docs describe?" It doesn't need to block anything. It only needs to put the question in front of someone.

**Sweep the whole repo now and then.** Drift also builds up from many small changes, none of which triggered any check alone. Occasionally read every doc and compare each claim against the current repository. A full read is expensive, so run it on a schedule or after a batch of changes, not on every commit.

## What the layers buy you

Back to the stale `make test` line. With a single source, it never existed. Without one, the test catches it the day the build config changes, the reminder catches it at commit time, the reviewer catches it when the change is proposed for merging, and the sweep catches it eventually. Each layer sees a different slice of the problem, and a line slips through only if every layer misses it.

None of this makes documentation correct forever. What changes is how long a stale line survives: from "until someone trips over it, perhaps never" to "until the next related change or the next sweep." Each layer also costs something to run and maintain, so add them in the order above and stop when the gap is short enough that it stops mattering. The same pressure to keep the instructions small applies here: [Context Budget for an AI Coding Harness](/coding-agents/context-is-a-budget) explains why fewer, shorter instructions are also fewer places to go stale.

**Rule of thumb.** Store each fact in one place, test what a program can check, have someone other than the author read the rest, and sweep the whole repo on a schedule for what slipped through.
