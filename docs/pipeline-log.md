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

Columns:

- **Gate failures** — times a stage's gate failed (Stage 2 re-runs, a
  test-lock or `verify` failure), with a two-word reason; `0` if none.
- **Findings** — review findings the diff introduced, as
  high/medium/low counts, plus `pre:N` for findings that were already there.
  `add-topic` counts its Stage 3 findings the same way.
- **Fix rounds** — rounds of the capped fix loop used (0–2).
- **Retro** — `nothing to change`, or the edits made, in a few words.

| Date | Run | Gate failures | Findings (H/M/L, pre) | Fix rounds | Retro | Escaped defect |
| ---- | --- | ------------- | --------------------- | ---------- | ----- | -------------- |
