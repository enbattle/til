---
title: 'Interactive Rebase: Cleaning Up Commits Before Sharing Them'
summary: Reorder, combine, reword, or drop your local commits before anyone else has to read them.
date: 2026-09-13
---

Real work rarely produces clean commit history on the first try. You
commit something, realize you made a typo, commit "fix typo," try an
approach, undo it, try again — and now the commit log tells the messy
story of how you got somewhere, not the clear story of what changed and
why. **Interactive rebase** is the tool for turning the messy version
into the clean one, before anyone else ever has to read it.

## What "rebase" means, briefly

Rebasing takes a sequence of commits and replays them onto a different
starting point, one at a time, as if you'd written them there originally.
This is different from merging, which combines two histories together
with a merge commit that records both parent branches. A rebase rewrites
history to look linear; a merge preserves history exactly as it happened,
including the branching. Interactive rebase uses that same
replaying mechanism, but instead of just moving commits, it lets you edit
the sequence as it replays.

## Running it

```sh
# Rebase the last 4 commits on the current branch, interactively.
git rebase -i HEAD~4
```

This opens an editor with a list like:

```
pick a1b2c3d Add login form
pick e4f5g6h Fix typo in login form
pick h7i8j9k WIP: start password validation
pick k1l2m3n Actually finish password validation
```

Each line is a commit and a command. Changing the command (or the order
of the lines) changes what happens when the rebase replays them:

- **`pick`** — keep the commit as-is.
- **`reword`** — keep the commit's changes, but stop to edit its message.
- **`squash`** — combine this commit into the one above it, and let you
  edit the combined commit message.
- **`fixup`** — like `squash`, but silently discards this commit's
  message and keeps the one above it — useful for a commit that only
  exists to fix the one before it.
- **`drop`** — discard the commit entirely.

Reordering the lines reorders the commits (as long as no later commit
depends on something an earlier one no longer has). Editing this file
before saving is what actually rewrites history.

## Cleaning up the example

Given the list above, changing it to:

```
pick a1b2c3d Add login form
fixup e4f5g6h Fix typo in login form
pick h7i8j9k WIP: start password validation
squash k1l2m3n Actually finish password validation
```

...and saving produces two clean commits instead of four: `Add login
form` (the typo fix silently folded in) and one combined password
validation commit, where you'll be prompted to write a single message
covering both. The history now describes two real, complete pieces of
work — not the sequence of false starts it took to get there.

## The one rule that actually matters

Interactive rebase rewrites commits — it doesn't edit the old ones in
place, it creates new commits with new identities and abandons the
originals. That's harmless for commits that only exist on your own
machine. It causes real problems for commits that **other people have
already pulled**: rewriting history that others have built on top of
means their copy and the rewritten copy no longer agree on what happened,
which typically has to be resolved by force-pushing and everyone else
resetting their local branch to match — disruptive, and easy to lose work
in.

The practical rule: freely rebase commits that are still only on your own
branch, before you've opened a pull request or pushed somewhere shared.
Once other people are working from those commits, prefer adding new
commits (or a regular merge) over rewriting history they already depend
on.

## Why bother

A pull request reviewer — including a future version of you, reading the
log months later — benefits enormously from commits that each represent
one coherent, complete change with a message that explains it. Interactive
rebase is what turns "the actual, messy sequence of edits it took to get
here" into that cleaner story, without changing a single line of the
final code.
