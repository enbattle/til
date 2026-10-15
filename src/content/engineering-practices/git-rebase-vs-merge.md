---
title: Git Rebase vs. Merge
summary: Merge, rebase and squash merge each bring a branch's work into another with a different shape of history, and the choice turns on whether anyone else has the branch.
date: 2026-09-14
---

Git keeps your work as **commits**, saved snapshots each with a message, and a **branch** is a named line of commits.

You are adding a login form on a branch called `feature`, and you make three commits: "Add login form", "Fix typo" and "Fix the fix". Meanwhile a teammate lands one commit on `main`, the team's branch of finished work. Git offers three ways to combine the two lines, and they leave different histories behind. Which should you use, and when?

This page covers merge, rebase and its one rule, tidying commits, squash merge, conflicts, and team policy.

## Two lines of work

Each letter is a commit. Your three are `C1`, `C2` and `C3`, and the teammate's is `D`:

```
A --- B --- D                main
       \
        C1 --- C2 --- C3     feature
```

Something has to join the two lines.

## What does merge do?

**Merge** ties the lines together with a new commit that has two parents. Run `git switch main` and then `git merge feature`, and you get:

```
A --- B --- D ---------- M    main
       \               /
        C1 --- C2 --- C3      feature
```

`M` is the **merge commit**. Every existing commit keeps its **hash**, the unique ID git computes from a commit's contents and its parent, so the history records exactly what happened. The cost: a busy repository fills with merge commits and the log becomes a braid. Can you get a straight line instead?

## What does rebase do?

**Rebase** takes your commits and replays them on top of another branch. From `feature`, run `git rebase main`:

```
A --- B --- D                       main
             \
              C1' --- C2' --- C3'   feature
```

Each `C1'` has the same changes as `C1` but a different parent, so it gets a new hash. The old commits are not edited; git copies them and abandons the originals. The result is a straight line, as if you had started after `D`. Merging it into `main` then just moves `main` forward to `C3'`, a **fast-forward**. New hashes are harmless while only you have the old ones.

## Why can't I rebase a branch other people use?

Anyone who already has the old commits now disagrees with you. Say you pushed `feature` to the **remote**, the shared copy of the repository (on GitHub, say), and a teammate **pulled** it, downloading it with `git pull`, and added a commit on top of `C3`. You rebase, and a plain `git push` is rejected, because your branch no longer contains the remote's `C3`.

So you **force-push** (`git push --force`), telling the remote to replace its branch with yours. Your teammate's copy still contains `C3`, so git sees two histories that share only the part before `C1`. If they pull with a merge, the abandoned commits come back next to the new ones, and every change appears twice.

That is the golden rule: **don't rebase commits that other people may have based work on.** Your own unpushed branch is safe, and so is a pushed branch nobody else uses, as long as you push it with `git push --force-with-lease`. That variant refuses to overwrite commits on the remote that you haven't **fetched** (downloaded), which a plain `--force` would destroy. Any fetch counts, even one your editor runs in the background.

Rewriting your own commits is still useful, though.

## How do I tidy a branch before review?

Rebase has a second mode. Run `git rebase -i main` and git opens a list of your branch's commits, each preceded by a verb you can change:

```
pick 1a2b3c4 Add login form
pick 5d6e7f8 Fix typo
pick 9a8b7c6 Fix the fix
```

Change a line to `squash` to fold it into the commit above and combine their messages, `fixup` to fold it in and keep only the message above, `reword` to edit its message, or `drop` to delete it. Here you mark the last two `fixup` and end with one clean commit. This is safe only before others build on the branch.

A third way folds the commits together for you.

## What is a squash merge?

A **squash merge** collapses the whole branch into one commit on `main`: `git merge --squash feature`, then `git commit`. History stays linear and `main` gets one commit per pull request, so reverting a feature means reverting one commit.

The trade-off is that git doesn't record the branch as merged, a source of confusing conflicts if you keep working on it.

All three ways hit the same snag when your login form and `D` touch the same lines.

## How do conflicts differ?

A **conflict** happens when both sides changed the same lines and git can't choose. Suppose `D` edited a line in the login file that all three of your commits also edit. With merge, you resolve it once, in the merge commit. With rebase, git replays your commits one at a time, so it can stop at each:

```
merge:   1 clash, resolved once
rebase:  C1', C2', C3' replayed one by one = up to 3 stops
```

After fixing a file you run `git add <file>` and then `git rebase --continue`, and `git rebase --abort` puts the branch back as it was. A squash merge, like a plain merge, resolves once.

Rebase also swaps the meaning of the `--ours` and `--theirs` flags, as in `git checkout --ours <file>`. During a rebase, ours is `main`, the branch you are rebasing onto, and theirs is your own commit being replayed. Running `git merge main` from `feature` is the reverse.

With the costs known, which does a team use?

## Which should a team pick?

Teams settle this with a policy. One common setup: developers rebase private branches onto `main` and tidy them with `git rebase -i`, then the pull request lands through a squash merge. Another team keeps every commit and uses plain merges. Both work; mixing styles on one shared branch fails.

The everyday command is `git pull`, which fetches the remote's new commits and combines them with yours. If the two have diverged and nothing is configured, current git stops and asks you to choose: `git config pull.rebase false` merges and `true` rebases. `git pull --rebase` replays your unpushed commits on top, which is safe because they are yours alone.

**Rule of thumb.** Rebase what is still only yours, merge or squash what is shared, and never rewrite a commit someone else may have pulled.
