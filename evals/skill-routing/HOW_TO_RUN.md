# How to run the skill-routing eval

Use the `skill-routing-eval` skill to actually run this — it wraps the
procedure below as an invokable skill for the same discoverability reason
`docs-audit` is a skill rather than passive documentation. What follows
is the underlying procedure the skill automates, useful if you're running
a single scenario by hand or checking exactly what the skill does.

## Procedure

For each scenario in `scenarios.md`:

1. **Start genuinely fresh.** A new Claude Code session in this repo
   with no prior conversation, or — as a practical stand-in when a
   session is running this itself — a fresh subagent given no context
   beyond the scenario prompt. It must not have seen this eval file or
   any other scenario; it should react the way a session encountering
   this request cold actually would.
2. **Give it the scenario prompt verbatim.** Add the instruction from
   `skill-routing-eval/SKILL.md`'s Stage 1 on top, exactly as written
   there — that file is the single source of truth for the current list
   of valid routing options, so copy it fresh rather than retyping the
   list here (it's drifted from being duplicated in the past). This
   keeps a routing check cheap — the thing being measured is the
   decision, not the build.
3. **Record**: the routing decision, and its stated reasoning in one
   sentence.
4. **Compare to `scenarios.md`'s Expected.** Mark:
   - **PASS** — matches Expected, or is one of an explicitly-listed
     acceptable answers for an ambiguous scenario, with defensible
     reasoning.
   - **FAIL** — doesn't match, or matches by coincidence with reasoning
     that reveals it didn't actually apply the right rule (e.g., picked
     the right answer for the wrong reason — note this, since it's a
     near-miss worth tracking even though it technically passed).
   - **AMBIGUOUS/UNCLEAR** — genuinely can't tell from the response;
     note why, don't force a grade.
5. **Log the run** to `results/<YYYY-MM-DD>.md` (copy the template
   below). Keep every past run — the point is seeing drift over time,
   not just the latest snapshot.

## Result log template

```markdown
# Skill-routing eval — <YYYY-MM-DD>

Run by: <human name, or "self" if an agent ran this on request>
Trigger: <what prompted this run — e.g., "CLAUDE.md edited", "routine check">

| ID    | Routing decision | Reasoning (1 line) | Grade               |
| ----- | ---------------- | ------------------ | ------------------- |
| SR-01 | ...              | ...                | PASS/FAIL/AMBIGUOUS |
| SR-02 | ...              | ...                | ...                 |
| ...   |                  |                    |                     |

## Notes

Anything that stood out — a near-miss, a scenario whose Expected answer
might need revisiting, a new failure mode worth turning into a scenario.
```

## When to run this

- After any change the table in `evals/README.md` maps to
  `skill-routing-eval` (that table is the canonical list;
  `.claude/hooks/nudge-sdlc.js` reminds a session about most of those files
  when it edits them).
- Whenever a session's routing choice surprises you in real use — that's
  a live failure mode; turn it into a new scenario (see below) before
  fixing the root cause, so the eval catches it if it comes back.

## Adding a new scenario

Found a real case where routing went wrong (or a new edge case worth
covering)? Add it to `scenarios.md` in the same format: the exact prompt,
**Expected**, **Why**, and **Fails if**. Prefer adding a real scenario
from something that actually happened over a hypothetical — a scenario
sourced from a genuine miss is worth more than several speculative ones.
