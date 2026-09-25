# Pipeline log

One row per `/feature` or `add-topic` run, appended by the run itself
(`/feature` Stage 6, `add-topic` Stage 4). Each retrospective only sees its
own run; this table is what lets a pattern across runs show up, and what
makes a retro checkable: a run with failed gates or real findings whose retro
says "nothing to change" stands out here.

It is a record, not a rule: rows are never rewritten, except to fill in the
**Escaped defect** cell of an earlier row. When a later fix addresses a bug
that an approved run introduced, add the fixing commit or spec there. An
escaped defect is the most important signal in this file. It gets a
retrospective immediately rather than waiting for a pattern.

Logging started on 2026-09-23. Earlier runs are in `docs/specs/` and git
history; they were not backfilled, since that would mean reconstructing
numbers nobody recorded.

Columns (`npm run check:pipeline-log`, part of `verify`, checks the format):

- **Run** — `/feature <spec path>` or `add-topic <topic path>`.
- **Gate failures** — a count, then a few words of reason: every time a gate
  the orchestrator runs failed (Stage 2's, the test-lock check, `verify`),
  plus every Stage 2 re-run after an implementer reported a wrong test; `0`
  if none. Name each re-run's cause: `spec ambiguity` or `test bug`. For
  `add-topic`, count failed `verify` runs.
- **Findings** — the first review round's findings that the diff introduced,
  as high/medium/low counts (CONFIRMED and credible PLAUSIBLE; cosmetic ones
  the user would wave through don't count), plus `, pre:N` for findings that
  were already there. `add-topic` counts its first Stage 3 round the same
  way. Example: `0/2/1, pre:1`.
- **Fix rounds** — rounds of the capped fix loop used: `0`, `1` or `2`.
- **Retro** — what was actually applied after the user's decision, in a few
  words, or `nothing to change` (which the check rejects on a row with gate
  failures or findings: say why none called for a change). `n/a` for
  `add-topic`, which has no retrospective.
- **Escaped defect** — empty until a later fix traces a bug to this run.

| Date | Run | Gate failures | Findings (H/M/L, pre) | Fix rounds | Retro | Escaped defect |
| ---- | --- | ------------- | --------------------- | ---------- | ----- | -------------- |
