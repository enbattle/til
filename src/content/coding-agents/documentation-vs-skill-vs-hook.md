---
title: 'Documentation, Skill, or Hook? A Framework for AI-Native Codebases'
summary: A decision framework for where a piece of guidance for an AI coding agent belongs — passive context, an invokable skill, or an automated hook — that transfers across tools even though the names don't.
date: 2026-09-14
---

If you work with an AI coding agent long enough, you'll eventually write
some guidance for it — a convention, a checklist, a procedure — and hit
the same question every time: does this go in a document the agent reads
automatically, does it become something explicitly invokable, or does it
become something that fires on its own? Getting this wrong doesn't
usually break anything outright, but it quietly makes the guidance less
likely to actually get followed. This is worth being deliberate about,
because the underlying judgment is the same skill regardless of which
tool you're using — even though the tools all name the pieces
differently.

## Three shapes, defined from first principles

Strip away the branding and there are three fundamentally different
things you can build:

- **Passive, always-loaded context.** A file the agent reads
  automatically at the start of every session, without anyone asking for
  it — project conventions, architecture, house style. It's _always
  there_, whether or not it's relevant to the current task.
- **An invokable, on-demand procedure.** This one has to be _found and
  chosen_, not just read: something with a name, surfaced in a list of
  "things you can ask for," that runs only when explicitly triggered —
  by a person typing a command, or by the agent recognizing the
  situation calls for it.
- **An event-triggered automation** fires on its own when a specific
  action happens — a file gets edited, a command gets run — with no one
  needing to remember to trigger it. It requires zero recall from
  whoever's working, because it's wired to the event itself, not to
  someone's memory of a rule.

## The decision test

Three questions, in order, usually settle it:

1. **Is this true and relevant no matter what the agent is doing right
   now?** If yes — a coding convention, a fact about the project's
   architecture, "we use this library, not that one" — it belongs in
   passive context. Making it something you have to invoke defeats the
   point: you'd need to already know it applies before that were
   possible.
2. Making a rule invokable only helps if someone actually invokes it —
   so the second question is **whether this only matters in a specific,
   recognizable situation where someone needs to trigger it on
   purpose.** A repeatable multi-step procedure, a specific kind of
   change with its own process — these should be distinct, invokable
   units with their own name and description, not a paragraph buried in
   a longer document. A procedure sitting in passive prose only gets
   followed if someone already remembers it exists and goes looking for
   it; a named, invokable unit gets surfaced on its own.
3. **Does this need to happen automatically, with nobody having to
   remember to ask for it?** If yes — a reminder tied to a specific kind
   of edit, an automatic check before a risky action — it belongs as an
   event-triggered hook. This is the only one of the three that removes
   the "did anyone remember" failure mode entirely, because it doesn't
   depend on anyone recalling anything.

The trap to watch for in both directions: turning a fact into an
invokable procedure adds friction (now something has to remember to ask
for a fact that was true the whole time), and turning a procedure into
passive prose loses discoverability (now it only helps the person who
already knew to look). Matching the shape to the actual property of what
you're encoding — a permanent fact, a conditional procedure, or a
triggerable event — is what makes the guidance actually get used instead
of technically existing.

## The vocabulary changes by platform; the framework doesn't

This is the same underlying decision in every AI coding tool that has
this kind of configuration — they just name the three shapes differently,
and some split "invokable procedure" and "reusable capability" into
distinct concepts of their own:

| Concept                        | Claude Code          | Amazon Kiro    | Cursor                                 |
| ------------------------------ | -------------------- | -------------- | -------------------------------------- |
| Passive, always-loaded context | `CLAUDE.md`          | Steering files | Rules (`.cursor/rules/`)               |
| Invokable, on-demand procedure | A skill (`SKILL.md`) | Agent Skills   | A skill (`SKILL.md`, same file format) |
| Event-triggered automation     | A hook               | Agent Hooks    | Hooks                                  |

One more wrinkle worth knowing, and it's a useful exception rather than a
complication: `AGENTS.md` is a separate, cross-tool convention for
repository context — read by Cursor, but also by several other agents —
not any single platform's own vocabulary. It's exactly the kind of thing
this table would misrepresent if it got filed under one platform's
column instead of called out on its own.

This exact confusion is common enough that platforms in this
space have had to explicitly address it — the boundary between "always
loaded" and "invoked on demand" isn't obvious just from looking at two
similarly shaped markdown files. The lesson transfers regardless of which
of these you're actually using: the question is never "what's this
platform's word for it," it's "which of the three underlying properties
does this thing actually have."

## Worked examples

- A rule like "topics must define terms before using them" is true every
  time you write a topic, regardless of which one — passive context.
- A multi-step process for drafting a new piece of content and getting
  it independently reviewed before it's considered finished is a skill,
  because it's only relevant when someone specifically wants that done,
  and it benefits from being triggerable by name rather than requiring
  someone to remember a procedure buried in a markdown file.
- Nobody should have to remember to check whether a bigger review
  process applies the moment they start editing a certain kind of file —
  which makes that a hook: it fires the instant the edit happens,
  without anyone having to ask.

Getting this classification right the first time is genuinely hard, and
getting it wrong isn't usually catastrophic — a procedure left as prose
still works if someone happens to find it and read that far. But the gap
between "technically documented" and "reliably followed" is exactly this
judgment call, as a project's tooling grows.
