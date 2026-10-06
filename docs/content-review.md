# Content review: the shared stages

`add-topic`, `add-case-study` and `add-dsa-entry` draft their content
directly (Stages 0–2 of each skill), then all follow the stages below. Each
skill fills in what is its own: the `<kind>` of content, the files the
reviewer gets, its `<checklist>`, its extra final-gate checks and what goes in
the commit.

Content gets this lighter process because there's no app behavior to spec or
test first, so `/feature`'s spec and TDD stages would be ceremony. Skipping
review entirely would give the repo's most frequent change less scrutiny than
a one-line code fix, so a fresh reviewer still checks every draft.
[docs/SDLC.md](SDLC.md) has the general reasoning behind where this repo does
and doesn't spend a separate agent.

## Stage 3 — Independent review

Spawn a **fresh** `general-purpose` agent (never `fork`: it must not inherit
your own read of the draft). Give it what the skill's **Files** lists,
`docs/writing-standard.md`, the path of `docs/NON_NEGOTIABLES.md`, the titles
and slugs of the skill's **Existing items** (for a near-duplicate check), any
decisions already recorded in an earlier round, and this instruction, close
to verbatim, with the skill's `<kind>` and `<checklist>` filled in (you
replace a checklist item that doesn't apply to this draft with "none"):

> Review this new <kind> adversarially against the Writing Standard and the
> checklist below; assume nothing about it is fine until you've checked it
> yourself. Read docs/NON_NEGOTIABLES.md first; a violation of any line there
> is always a real finding. Writing Standard: hold it to every bullet of
> docs/writing-standard.md, including its "Catalog topics" and "Case studies
> and DSA entries" sections. Checklist: <checklist> Also check it isn't a
> near-duplicate of an existing <kind> (listed below). For each finding, quote
> the text or code, or name a realistic input that breaks it; label anything
> else "theoretical". Re-raise a decision listed below as already made only
> with new evidence. Do not edit any file; review only. Report findings ranked
> by severity, quoting the text and saying what's wrong and what's true, or
> say explicitly that you found nothing worth flagging.

- No findings, or only cosmetic ones → Stage 4.
- Real findings → triage, then fix. Confirm each against the files yourself
  (a finding about app code or a check goes to a fresh agent), and give it one
  of `/feature` Stage 4's outcomes. Record each Reject and Known limitation
  with a one-line reason in the handoff, and give the re-review that list. A
  Reject must quote the text, code or source that disproves the finding. (An
  entry's own code under `src/dsa/code` is content here, not app code.) Fix
  the rest yourself (no separate fix agent for content; the skill names any
  extra fix step), then re-run this stage with a new fresh agent on the
  updated files. **Cap at 2 rounds**, matching `/feature`'s fix loop; if
  findings persist after the second, stop and surface them to the user rather
  than iterating alone.

## Stage 4 — Final gate

Run the skill's own pre-gate steps, if any, then `npm run verify` on the
final version, and confirm it's green. Run the skill's scope check, if it has
one (a `git status --porcelain` over the folders it must not touch; unlike a
diff, this also shows untracked files). Summarize the content and the review
outcome for the user.

Append a row for this run to [docs/pipeline-log.md](pipeline-log.md): its
header defines the columns; Run is `<skill> <path>`, Retro is `n/a` (these
skills have no retrospective) or, when the first round had findings, their
kinds from the header's list (`kinds: tone, wrong-claim`), Gate failures counts failed `verify` runs, and
Agents counts every agent you started, a batch drafter included. Then run
`npx prettier --write docs/pipeline-log.md` and `npm run check:pipeline-log`.
The row goes in the content's commit, with the files the skill lists. Ask
before committing or pushing: these skills leave the working tree ready, they
don't ship it.

## Batch mode

`add-topic`, `add-case-study` and `add-dsa-entry` can add (or, for
`add-topic`, rewrite) several items at once; the skill adds any ordering or
integration step of its own.

1. One drafter agent per item, in parallel, each in its own worktree
   (`isolation: "worktree"`), runs the skill's Stages 0–2 only, with Stage 2
   replaced by the checks the skill's batch-mode bullet lists: several
   `npm run verify` runs at once overload the machine, and step 4 runs it
   once. Drafters run on Sonnet (`model: "sonnet"`) from one brief you write
   out of the skill and its doc; reviewers run on Opus (`model: "opus"`),
   because catching a wrong claim is the step that needs the stronger model.
   Five Sonnet-drafted DSA batches drew review findings comparable to the Opus
   ones before them (the pipeline log has the counts). Each drafter runs
   `npm ci` in its own worktree first (under 30 seconds, even with six
   installing at once), so no worktree shares the main checkout's
   `node_modules`. Worktrees start from `main`, not from your branch, so start
   a batch only after the user has merged the batch it builds on and you have
   pulled `main`. If `npm ci` fails,
   the drafter stops and reports it rather than running checks without it,
   since `npx` would then fetch a different version of the tool.
2. Each item gets one fresh Stage 3 reviewer, whose instruction adds: "Report
   only High and Medium correctness findings." Its existing items include the
   batch-mates' titles and slugs, and it also gets the drafts of any
   batch-mate the item links to.
3. Its findings go through Stage 3's triage. You apply the fixes once, with no
   re-review of that round (Fix rounds `1`); a High found then goes to the
   user.
4. Integrate: copy each item's files from its worktree and run the skill's
   integration step, then run Stage 4 once for the batch (pre-gate steps,
   `npm run verify`, the scope check), with one pipeline-log row per item.
5. After the user's go-ahead, open one pull request for the batch, then remove
   the worktrees and their `worktree-agent-*` branches.
