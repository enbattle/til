---
title: 'Git Worktrees: Working on Multiple Branches at Once'
summary: Check out a second branch into its own folder, without stashing or switching away from what you're already doing.
date: 2026-09-13
---

The normal way to switch branches in Git is `git checkout` (or
`git switch`), which changes the files in your working directory to match
a different branch. That works fine — until you're in the middle of
something uncommitted and suddenly need to look at, or work on, a
_different_ branch right now. The usual options are to commit
half-finished work just to switch away, or to `git stash` it, switch,
finish the other thing, switch back, and pop the stash. Both work, but
both are friction for something that should be simple: working on two
things at once.

## What a worktree actually is

A Git repository has two main parts: the `.git` folder (the actual
history — every commit, branch, and object Git knows about) and the
**working directory** (the files you see and edit, checked out from one
particular commit). Normally there's exactly one working directory per
repository.

`git worktree` lets you attach **additional working directories** to the
same repository, each checked out to a different branch, all sharing the
same underlying `.git` history. Nothing is duplicated except the checked-out
files themselves — commits made in one worktree are immediately visible
to the others, because they all share the same object store.

## Using it

```sh
# From inside your existing repo, create a new worktree for `hotfix`
# at ../myproject-hotfix, creating the branch if it doesn't exist yet.
git worktree add ../myproject-hotfix -b hotfix

# See every worktree attached to this repository.
git worktree list

# Done with it — remove the worktree (the folder and its registration).
git worktree remove ../myproject-hotfix
```

After `git worktree add`, `../myproject-hotfix` is a fully independent
folder: its own checked-out files, its own place to run a dev server or
test suite, its own uncommitted changes — completely separate from
whatever's currently checked out in your original folder. You can have
your editor open in both at once.

## Where this actually helps

- **An urgent hotfix mid-feature.** You're deep into a feature branch with
  uncommitted changes, and a production bug needs fixing right now. Add a
  worktree for the hotfix branch, fix it there, and your feature branch's
  working directory is untouched the whole time.
- **Running something slow in the background.** Kick off a full test
  suite or a production build in one worktree while continuing to edit
  code in another, without them fighting over the same files.
- **Comparing two branches side by side** — open both worktrees in
  separate editor windows instead of switching back and forth.

## Cleaning up

Worktrees stick around until you remove them, so it's worth knowing the
two ways that happens:

- `git worktree remove <path>` removes a specific one (it refuses if
  there are uncommitted changes, unless you pass `--force`).
- `git worktree prune` cleans up Git's bookkeeping for worktrees whose
  folders were already deleted manually (e.g. with `rm -rf`) instead of
  through `git worktree remove`.

Worktrees don't replace branching or stashing — they solve a different
problem: needing more than one branch checked out onto disk _at the same
time_, instead of one at a time.
