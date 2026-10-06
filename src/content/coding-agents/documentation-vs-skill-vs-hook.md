---
title: Documentation vs. Skill vs. Hook
summary: Guidance for an AI coding agent belongs in an always-loaded file, an on-demand skill, or a hook, depending on whether it is a standing fact, a situational procedure, or something that must happen without anyone remembering.
date: 2026-09-14
---

Suppose you maintain a web shop's codebase and work with an AI coding agent. Within a week you have three pieces of guidance to hand it. First, "we use pnpm, not npm." Second, an eight-step procedure for shipping a release. Third, "never edit a file in the `migrations/` folder once it has been merged." You could paste all three into one document. Should you?

Each one has a different shape, and the shape decides where it lives. Put it in the wrong place and nothing breaks loudly. The guidance just gets followed less often than you assumed.

## Three places guidance can live

- **Always-loaded context.** A plain file the agent reads at the start of every session, with nobody asking. It holds standing facts: conventions, architecture, house style. It is present whether or not the current task needs it.
- **An on-demand skill.** A named, self-contained procedure with a short description. The agent sees the name and description, and it loads the full text only when you invoke it by name or the agent decides the situation fits.
- **A hook.** A small program the tool runs automatically when a specific event happens, such as a file being edited or a command about to run. Its behavior doesn't depend on the model remembering or choosing anything, because ordinary code fires it.

What separates them is who has to do something for the guidance to take effect. Always-loaded context needs nothing from anyone. A skill needs someone, you or the agent, to recognize the moment. A hook needs no recognition, because the event itself triggers it.

## Sorting the shop's three rules

Ask three questions in order.

**Is it true no matter what the agent is doing?** "We use pnpm, not npm" holds for every task in the repo. That is a standing fact, so it goes in the always-loaded file. Making it a skill would be backwards: the agent would have to know the rule applied before it knew to load it. The cost of the always-loaded file is that every line is paid for on every task, which is why it should stay short ([Context Budget for an AI Coding Harness](/coding-agents/context-is-a-budget) covers that cost).

**Does it only matter in one recognizable situation?** The eight-step release procedure is irrelevant to nearly every task and essential to one. Left as a paragraph in the always-loaded file, it costs tokens (the units a model reads text in) on every task and is easy to skim past when the release finally happens. As a skill named `release`, it costs a one-line description until needed, then loads in full and is easy to find. A procedure is a skill.

**Must it happen even if nobody remembers?** "Never edit a merged migration" is a rule where one lapse does damage. A sentence in the always-loaded file is only a request, and a model can overlook a request, especially deep into a long session. A hook can check, before each edit, whether the target is a migration already on the main branch, and refuse the edit. The rule now holds without anyone, human or model, recalling it, as long as the hook covers every way the agent can write a file, its edit tool and the shell alike. Use hooks for what must always happen or never happen.

## Where each choice goes wrong

Turning a fact into a skill adds friction. Someone now has to remember to ask for something that was always true.

Turning a procedure into always-loaded prose costs twice. It bloats every session, and it helps only a reader who already knows it is there.

Treating a hard rule as a document line leaves the "did anyone remember?" gap open. A hook closes it, but a hook is also the most rigid of the three. It runs on every matching event whether or not the situation is an exception, so the rule you wire into one should be one you almost never want to break. A rule with judgment calls belongs in the document, where a model can weigh it.

You can also combine them. The always-loaded file might say "releases go through the `release` skill," a one-line pointer that makes the skill discoverable, while a hook blocks direct pushes to the main branch.

## The names change; the test doesn't

Tools label these differently, and some let one kind of file work in more than one of these roles, loaded always or only when a task calls for it. A separate convention, a file named `AGENTS.md`, exists so that several different agents can read the same repository context, and it fills the always-loaded slot rather than adding a fourth kind.

None of that changes the questions. When you meet a new tool, skip its vocabulary and ask which of the three properties your guidance has: always true, situationally needed, or must-fire.

**Rule of thumb.** If it is always true, put it in the always-loaded file. If it is a procedure for one kind of situation, make it a skill. If it must happen or be blocked every time, make it a hook.
