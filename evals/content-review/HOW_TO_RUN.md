# How to run the content-review eval

Use the `content-review-eval` skill to actually run this — it wraps the
procedure below as an invokable skill for the same discoverability reason
`skill-routing-eval` is a skill rather than passive documentation. What
follows is the underlying procedure the skill automates, useful if you're
running a single scenario by hand or checking exactly what the skill
does.

This eval answers a different question than `skill-routing`: not "does a
fresh session pick the right skill," but **"once `add-topic`'s Stage 3
review actually runs, does it catch what it's supposed to catch?"** —
review-efficacy, not routing-correctness.

## Why the reviewer instruction is never copied into this file

Each scenario has to be reviewed with `add-topic`'s **real** Stage 3
instruction, not a paraphrase of it — otherwise this eval silently tests
a review process that doesn't actually exist in the repo, and drifts the
moment the real prompt changes. So every run reads
`.claude/skills/add-topic/SKILL.md` fresh and copies its current Stage 3
reviewer instruction (the "Review this new til topic adversarially..."
block) verbatim into the agent prompt below, rather than storing a
snapshot of it here.

## Procedure

For each scenario in `scenarios.md`:

1. **Read fresh inputs, don't reuse a cached copy:**
   - `add-topic/SKILL.md`'s current Stage 3 reviewer instruction, copied
     verbatim.
   - `CLAUDE.md`'s current "Writing standard" section, copied verbatim.
   - The scenario's declared **Section**'s current topic titles/slugs
     (e.g. `ls src/content/systems-and-infrastructure/`), globbed at run
     time — not a hardcoded list, the corpus grows.
2. **Spawn a genuinely fresh `general-purpose` agent** (never `fork` — it
   must not inherit any prior read of the draft or knowledge of what
   problem was planted). Give it, in this order:
   - The scenario's fabricated draft file content, verbatim, exactly as
     `add-topic` Stage 3 would receive a real draft.
   - The Writing Standard text from step 1.
   - The path of `docs/NON_NEGOTIABLES.md`, exactly as `add-topic` Stage 3
     gives it.
   - The sibling topic titles/slugs from step 1.
   - The Stage 3 reviewer instruction from step 1, verbatim, with its
     final "review this new til topic" framing intact — the agent should
     believe it's doing a real `add-topic` review, not grading an eval.
3. **Record** the review's actual finding text (not a paraphrase).
4. **Compare to the scenario's Expected finding.** Grade:
   - **PASS** — the review's findings substantively name the planted
     violation (or, for `CR-05`, either say there's nothing worth flagging
     or raise only findings that are true of the text: a real polish gap,
     a real scope or placement observation).
   - **FAIL** — the review says nothing worth flagging when a violation
     was planted, flags something unrelated instead of the planted issue,
     or (for `CR-05`) reports a defect that isn't true of the draft: a
     fabricated claim, a misreading of what the text says, or a correct
     technical statement called wrong.
   - **AMBIGUOUS** — the finding brushes near the planted issue without
     clearly naming it; note why, don't force a grade.
5. **Log the run** to `results/<YYYY-MM-DD>.md` (copy the template
   below). Keep every past run — the point is seeing drift over time as
   `add-topic`'s Stage 3 prompt or the Writing Standard evolve, not just
   the latest snapshot.

## Result log template

```markdown
# Content-review eval — <YYYY-MM-DD>

Run by: <human name, or "self" if an agent ran this on request>
Trigger: <what prompted this run>

| ID    | Planted violation | Review caught it? | Grade               |
| ----- | ----------------- | ----------------- | ------------------- |
| CR-01 | ...               | ...               | PASS/FAIL/AMBIGUOUS |
| CR-02 | ...               | ...               | ...                 |
| ...   |                   |                   |                     |

## Notes

Anything that stood out — a near-miss, a planted violation the review
caught for the wrong reason, a new violation type worth turning into a
scenario.
```

## When to run this

- After editing `add-topic/SKILL.md`'s Stage 3 prompt, or `CLAUDE.md`'s
  Writing Standard section — exactly the two inputs this eval depends on.
- Whenever a real `add-topic` review misses something in actual use —
  that's a live failure; turn it into a new scenario before fixing the
  root cause, so this eval catches it if it comes back.

## Adding a new scenario

Found a real case where `add-topic`'s review missed something, or a new
violation category worth covering? Add it to `scenarios.md` in the same
format: **Section**, **Planted violation**, the fabricated draft itself,
**Expected finding**, and **Fails if**. Prefer a scenario sourced from a
real miss over a speculative one, same principle `skill-routing`'s
`HOW_TO_RUN.md` already states.
