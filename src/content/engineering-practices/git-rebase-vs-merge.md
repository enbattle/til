---
title: Git Rebase vs. Merge
summary: What each actually does to history, which to use on a private branch vs. a shared one, and the rule of thumb for choosing between them.
date: 2026-09-14
---

Two different ways to bring one branch's changes into another. **Merge**
creates a new commit that ties the two histories together, preserving both
exactly as they happened. **Rebase** replays one branch's commits on top
of the other, rewriting them with new commit hashes, producing a linear
history, as if they'd been written on top of the latest code all along.

## Same change, two different shapes of history

Concretely: `main` has commits `A` and `B`; a `feature` branch splits off
after `B` and adds commit `C`, while `main` moves on with commit `D`. A
**merge** of `main` into `feature` produces both histories intact, tied
together by a new merge commit — every commit stays exactly as it was. A
**rebase** of `feature` onto `main` instead replays `C` after `D`,
producing a straight line — `A → B → D → C′` — where `C′` carries the
same changes as `C` but under a brand-new hash, as if it had been written
after `D` from the start.

The choice affects both what your history looks like and how conflicts
get resolved. Merge preserves exactly what happened, including merge
commits that can clutter a log with noise. Rebase produces a clean,
linear, easy-to-read history. But it rewrites commit hashes, which is
dangerous on any branch other people have already pulled: their local
history now diverges from the rewritten one, and reconciling the two is
painful.

## The rule of thumb: rebase what's private, merge what's shared

- **Rebase** your own local, not-yet-shared feature branch onto the latest
  `main` before opening or updating a pull request: clean, linear
  history, no noise merge commits.
- **Merge** (never rebase) once a branch is shared or public, or when
  merging a completed feature branch into `main`: don't rewrite history
  other people depend on.

This is the reasoning behind the rule "never rebase a branch others have
already based work on," and it's also the source of the difference
between `git pull` (a merge by default) and `git pull --rebase` — a
choice most people using git on a team make, knowingly or not, every day.
The risk of rebase is entirely about rewriting commits other people have
already built on top of: on your own unshared branch, there's nothing to
break.
