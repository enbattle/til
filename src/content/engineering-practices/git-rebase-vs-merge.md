---
title: Git Rebase vs. Merge
summary: Merge, rebase and squash merge each bring a branch's work into another with a different shape of history, and the choice turns on whether anyone else has the branch.
date: 2026-09-14
---

You are adding a login form on a branch called `feature`. While you work, a teammate lands a change on `main`. Now your branch is behind, and you have to combine the two lines of work. Git offers three ways to do it, and they leave different histories behind.

First, a picture of where you start. Each letter is a commit, and `feature` split off `main` after `B`:

```
A --- B --- D        main
       \
        C            feature
```

## What does merge do?

**Merge** ties the two lines together with a new commit that has two parents. Run `git switch main` and then `git merge feature`, and you get:

```
A --- B --- D --- M    main
       \         /
        C ------       feature
```

`M` is the **merge commit**. Every existing commit keeps its hash (the unique ID git computes from a commit's contents and its parent), so the history records exactly what happened, including the fact that two people worked at once. The cost is that a busy repository fills with merge commits, and the log becomes a braid.

## What does rebase do?

**Rebase** takes your commits and replays them on top of another branch. From `feature`, run `git rebase main`:

```
A --- B --- D        main
             \
              C'     feature
```

`C'` has the same changes as `C` but a different parent, so it gets a new hash. The old `C` is not edited; git makes a copy and abandons the original. The result is a straight line, as if you had started after `D`. If you then run `git switch main` and `git merge feature`, git has nothing to join, so it simply moves `main` forward to `C'` (a fast-forward).

## Why can't I rebase a branch other people use?

Because rebasing creates new commits, and anyone who already has the old ones now disagrees with you. Say a teammate pulled `feature` from the **remote** (the shared copy of the repository, such as one on GitHub) and added a commit on top of `C`. You rebase, and a plain `git push` is now rejected, because your branch no longer contains the remote's `C`. So you **force-push** (`git push --force`), telling the remote to replace its branch with yours, and its `feature` now ends in `C'`. Their copy still contains `C`, and git sees two histories that share only the part before `C`. If they pull with a merge, git joins them and brings back the abandoned `C` next to `C'`, so the same change appears twice.

That is the golden rule: **don't rebase commits that other people may have based work on.** Your own unpushed branch is safe, and so is a pushed branch nobody else uses, as long as you push it with `git push --force-with-lease`. That variant refuses to overwrite the remote if it holds commits you haven't fetched, which a plain `--force` would destroy. Any fetch counts, even one your editor runs in the background, so it protects only unfetched work.

## How do I tidy a branch before review?

Rebase has a second mode that rewrites your own commits. Run `git rebase -i main` and git opens a list of your branch's commits, each preceded by a verb you can change:

```
pick 1a2b3c4 Add login form
pick 5d6e7f8 Fix typo
pick 9a8b7c6 Fix the fix
```

Change a line to `squash` to fold it into the commit above and combine their messages, `fixup` to fold it in and keep only the message above, `reword` to edit its message, or `drop` to delete it. Here you would mark the last two as `fixup` and finish with one clean "Add login form" commit. Reviewers then read a story instead of your trial and error. This is safe only before others build on the branch, for the same reason as above.

## What is a squash merge?

A third option collapses the whole branch into one commit on `main`. Run `git merge --squash feature` and then `git commit`. History stays linear, and `main` gets one commit per pull request, so reverting a feature means reverting one commit.

The trade-off is that `feature`'s own commits never join `main`'s history, and git doesn't record that the branch was merged. That is fine once you delete the branch, and a source of confusing conflicts if you keep working on it. GitHub offers it as a pull-request button.

## How do conflicts differ?

A **conflict** happens when both sides changed the same lines and git can't choose. With merge, you resolve everything once, in a single merge commit. With rebase, git replays your commits one at a time, so a conflict can appear at each step. After fixing a file you run `git add <file>` and then `git rebase --continue`, and if it goes badly, `git rebase --abort` puts the branch back as it was. A branch with ten commits can mean resolving the same clash several times. A squash merge, like a plain merge, resolves once.

Rebase also swaps the labels git uses in conflict markers. During a rebase, "ours" (and `--ours`) is the branch you are rebasing onto, `main`, and "theirs" (`--theirs`) is your own commit being replayed. That is the reverse of running `git merge main` from `feature`, where "ours" is your branch.

## Which should a team pick?

Teams settle this with a policy more than a case-by-case choice. One common setup combines the tools: developers rebase their private branches onto `main` and clean them up with `git rebase -i`, then the pull request lands through a squash merge. Another team values keeping every commit and uses plain merges. Both work. What fails is mixing styles on one shared branch without anyone knowing the rule.

The everyday command that matters is `git pull`. A plain `git pull` fetches, then merges or rebases as configured: `git config pull.rebase false` merges, which can add a merge commit each time, and `true` rebases. With neither set, current git stops when your branch and the remote's have diverged and asks you to choose. `git pull --rebase` fetches and then replays your unpushed commits on top, keeping the line straight, and it is safe because those commits are yours alone.

**Rule of thumb.** Rebase what is still only yours, merge or squash what is shared, and never rewrite a commit someone else may have pulled.
