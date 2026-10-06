---
title: Keeping AI-Native Tooling Docs From Going Stale (And Actually Enforcing It)
summary: Why documentation drifts fastest in AI-agent-driven repos, and the layered set of mechanisms that actually catches it instead of just hoping someone remembers.
date: 2026-09-14
---

Every codebase has the problem of documentation drifting from what the
code actually does. Repos where an AI coding agent is a regular
contributor have a sharper version of it: some of the "documentation" —
the instructions that tell the agent how to work, not just what the code
does — is itself part of the system being described, and it changes
almost every time a new capability gets added. Get this wrong and you
end up with an agent confidently following a rule that stopped being
true weeks ago.

## Why this drifts faster here than in an ordinary codebase

In a typical project, documentation describes code that changes on a
normal, human-paced cadence. In an AI-native one, there's a second layer:
a persistent instructions file the agent reads automatically at the
start of every session, a set of named procedures it can be told to run
for specific situations, and a set of automated triggers wired to fire
on specific actions — none of these are just _about_ the process, they
_are_ the process. When you teach an agent a new procedure to follow,
the instructions describing the old way are now actively wrong, not just
incomplete — and an agent following stale instructions doesn't
necessarily notice, because from the inside, "do what the instructions
say" and "do the right thing" look identical.

## The mechanism that actually fails: self-review

The instinctive fix is "the agent should update the docs when it makes a
change." That's a reasonable first pass, but it has a specific, provable
weakness: whoever just made a change is the worst-positioned party to
notice what it left undocumented. They already hold the new state in
mind, so an omission looks unremarkable to them — the same way a typo you
just typed is invisible to your own proofreading, but obvious to someone
reading it cold five minutes later. A rule that says "update the docs if
this changes a convention" only fires when the same agent that built the
feature remembers to apply it to itself, which is precisely the case it's
least reliable in.

## A layered defense, not one fix

No single mechanism catches everything, because different kinds of
staleness need different kinds of checks:

- **Remove the duplication at the source, where possible.** The most
  reliable fix isn't detection — it's not having the same fact live in
  two places. If a doc lists something that's really owned by a piece of
  config or code (a set of categories, a list of commands), point the doc
  at that source instead of repeating it. A fact that can't drift because
  it's never copied is strictly better than a fact someone has to
  remember to keep in sync.
- **Deterministic checks for anything mechanically checkable.** When a
  correspondence between a doc and the code it describes can be
  expressed as a test — this folder structure matches this list, this
  file exists — write that test. It's the difference between a comment
  that says "keep this in sync" and a check that fails the build if it
  isn't.
- **Independent review for anything that needs judgment.** Prose
  staleness ("this section describes a process that no longer matches
  reality") can't be asserted by a test — it needs a read. The fix for
  self-review's blind spot is exactly what code review already does for
  code: have someone (or something) _other_ than the author check it,
  with fresh eyes and no memory of writing the original.
- **A prompt at the one moment that's universal.** Independent review
  inside a formal pipeline only covers the changes that go through that
  pipeline — it does nothing for the small, direct edits that
  deliberately skip it (which is most changes, by volume, in most
  repos). The one point that's genuinely universal, regardless of how a
  change was made, is right before it ships. A reminder wired to that
  moment — not blocking, just surfacing the question — catches
  everything the narrower checks structurally can't reach.
- **A periodic full sweep, for everything else.** Even with all of the
  above, a full-repo pass — read every doc, cross-check every claim
  against current reality — catches drift that accumulated slowly across
  many small changes, none of which individually triggered anything.
  This one is expensive enough that it shouldn't run on every change; it
  earns its cost by running occasionally and thoroughly instead.

## What this looks like concretely

None of this requires exotic infrastructure. In one real repo, it looks
like: a test that fails the build the moment a folder structure and the
list describing it disagree, instead of a comment promising they'll be
kept in sync by hand; a review step that explicitly re-checks
documentation impact on every change that goes through a formal review
process, instead of trusting whoever wrote the change to have caught it
themselves; a small reminder that fires automatically the moment someone
runs the command to ship a change, regardless of how big or small that
change was; and a named, on-demand procedure that occasionally does a
slow, thorough, independent read of every doc in the repo, looking
specifically for claims that used to be true and no longer are.

## What these mechanisms actually buy you

None of these mechanisms make documentation perfect forever. What they
change is how long a piece of drift survives before something catches
it — from "until someone happens to notice by accident, maybe never" to
"the next time a related change ships, or the next scheduled sweep." The
goal is to keep that gap, between a doc going stale and someone finding
out, short enough that it stops mattering.
