# How to run the system-design-navigation eval

Use the `system-design-navigation-eval` skill to actually run this. It
wraps the procedure below as an invokable skill for the same
discoverability reason `skill-routing-eval` is a skill rather than passive
documentation. What follows is the underlying procedure, useful if you're
running a single scenario by hand.

This eval answers a different question than the other two: not "does a
fresh session pick the right skill" (`skill-routing`) or "does a review
catch a planted violation" (`content-review`), but **"starting from a
symptom, does the System Design section actually get a reader to the right
question and the right catalog topics?"** It tests the content of
`src/system-design/questions/` (the titles and summaries a reader chooses
from, and the topic links inside each page), not any code. The automated
tests already guarantee no dead links and full coverage of
`systems-and-infrastructure`; they can't tell you whether a person with a
problem would find the right page.

## What the fresh agent sees

The agent plays a reader using the System Design tab, so it is given the
same information in the same order:

1. **The landing page's view:** the list of questions, in `order`, each
   with its `title` and `summary`. Build it fresh at run time from
   `src/system-design/questions/*.md` (the frontmatter of each file), never
   from a copy saved here, because titles and summaries change.
2. **The question it picks:** the agent may then read that one question
   file in full, and any of the catalog topic files that question links to
   (`src/content/**`), exactly as a reader would follow links. It must not
   read the other question files before choosing, must not read anything
   under `evals/`, and must not read `src/system-design/` beyond what it
   opened by choosing.

If the agent decides mid-read that it picked the wrong question, it may
follow the question's own "When it isn't this problem" pointer to another
one; record that as a second hop rather than a fresh choice.

## Procedure

For each scenario in `scenarios.md`:

1. **Start genuinely fresh.** A new `general-purpose` agent (never `fork`,
   so it doesn't inherit this session's knowledge of the expected answer)
   with no context beyond the prompt below.
2. **Build the landing-page view** (step 1 above) from the current files and
   give it, plus the scenario's symptom verbatim, with this instruction:

   > You are a reader of a System Design reference site. Below are the
   > site's questions, each with a summary. A person has just described a
   > problem to you. Pick the single question you'd open first, then read
   > that question's page (`src/system-design/questions/<slug>.md`) and, if
   > useful, the catalog topics it links to. Do not read other question
   > pages before choosing, and do not read anything under `evals/`. If the
   > page tells you it isn't the right one, follow its pointer once and say
   > so. If NO question covers the problem, say that plainly instead of
   > picking the nearest one. Report: (1) the question you opened first
   > (slug), (2) any second question you followed, (3) the catalog topic
   > slugs you would send the person to, and (4) one sentence of reasoning.
   > Keep it under 120 words.
   >
   > Questions: <landing-page view>
   > Problem: "<scenario symptom>"

3. **Record** the agent's report as written.
4. **Compare to `scenarios.md`'s Expected.** Mark:
   - **PASS** - the first question (or an explicitly accepted alternative
     for an ambiguous scenario) matches, the topics it names are among the
     listed ones, and the reasoning is sound. For the control, PASS means
     it said no question covers the problem.
   - **FAIL** - the wrong first question with no path back to the right
     one, a topic that question doesn't link, a forced answer to the
     control, or the right answer for a reason that shows it didn't read
     the page (note that as a near-miss even if it technically matched).
   - **AMBIGUOUS/UNCLEAR** - can't tell from the report; note why, don't
     force a grade.
5. **Log the run** to `results/<YYYY-MM-DD>.md` (template below). Keep every
   past run so drift shows over time.

## Result log template

```markdown
# System-design-navigation eval — <YYYY-MM-DD>

Run by: <human name, or "self" if an agent ran this on request>
Trigger: <what prompted this run — e.g. "new question added", "routine check">
Question set: <the slugs in order at the time of the run>

| ID     | First question | Second hop | Topics | Reasoning (1 line) | Grade               |
| ------ | -------------- | ---------- | ------ | ------------------ | ------------------- |
| SDN-01 | ...            | ...        | ...    | ...                | PASS/FAIL/AMBIGUOUS |
| SDN-02 | ...            | ...        | ...    | ...                | ...                 |
| ...    |                |            |        |                    |                     |

## Notes

A near-miss, a scenario whose Expected needs revisiting, a question
title or summary that pulled readers the wrong way (the usual fix is the
summary, not the scenario), or a new symptom worth turning into a scenario.
```

## When to run this

- After adding, renaming or reordering a question, or editing a question's
  `title` or `summary` (that is what a reader chooses from), or after
  substantially editing a question body's topic links.
- After adding a `systems-and-infrastructure` topic and placing it under a
  question (the coverage test only checks the link exists, not that a reader
  would land there).
- Whenever a real reader takes a wrong turn in actual use: turn it into a
  scenario before changing the content, so this catches it if it returns.

## When the question set changes

The Expected answers are tied to the current questions. When the set
changes:

1. **Re-derive, don't patch.** For each scenario, re-read the current
   question pages and decide which question a reader should now land on.
   A scenario whose Expected question was renamed or split needs its
   **Expected**, **Topics** and **Why** rewritten from the new pages, not
   just the slug swapped.
2. **Check every listed topic is still linked** from its expected question
   (its "Go deeper" list on the site). A topic moved to a different question
   makes the scenario stale.
3. **Add a scenario for each new question**, phrased as a symptom that
   should land there and, where a neighbor could plausibly claim it, one
   that shouldn't. New topics placed under a question get a scenario
   when they are the natural answer to a symptom no existing scenario covers.
4. **Keep the control permanent.** `SDN-15` stays out of scope for good; if
   a future question ever does cover it, replace it with a different
   permanently out-of-scope prompt (not another one a question will
   eventually cover).
5. **Update the slug table** at the top of `scenarios.md`.

## Adding a new scenario

Same format as the rest: the exact symptom, **Expected question**,
**Topics**, **Why** and **Fails if**. Prefer a real misroute you saw over a
speculative one, the principle `skill-routing`'s `HOW_TO_RUN.md` also states.
