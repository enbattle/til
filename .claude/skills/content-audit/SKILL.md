---
name: content-audit
description: Sweep published topic(s) under src/content/**/*.md, System Design case studies under src/system-design/case-studies/*.md, and DSA entries under src/dsa/entries/*.md, for content-quality problems the per-topic review doesn't structurally catch — prose that reads as generically AI-generated, figurative language over-explained instead of trusted to land, and technical claims that were never independently verified. Defaults to every published topic, case study and DSA entry (a corpus-wide sweep) but also scopes to a single already-published file or section when asked to check the content quality of one existing topic, case study or DSA entry. Use when asked for a corpus-wide content-quality sweep, a check of whether existing topics, case studies or DSA entries "sound AI-written," or a quality check or revision of one specific already-published topic, case study or DSA entry (not a brand-new topic being drafted, nor a rewrite of a topic to the catalog standard — both are add-topic's job — not a brand-new case study — that's add-case-study's job — not a brand-new DSA entry — that's add-dsa-entry's job — not a merge of DSA entries, which add-dsa-entry owns — and not meta-documentation staleness like CLAUDE.md/docs/SKILL.md files — that's docs-audit's job).
---

# Content audit

Manual/periodic, same cadence philosophy as `docs-audit` and the `evals/`
suite — not run on every commit, and not folded into `add-topic`'s
per-topic review. `add-topic` reviews exactly one new file as it's
written; this skill exists because some problems (a corpus-wide tic, a
bullet-list rhythm repeated identically across many files) are only
visible when multiple files are read together, which a single-topic
reviewer structurally cannot do. See
[docs/SDLC.md](../../../docs/SDLC.md) for the general reasoning behind
where this repo does and doesn't spend a separate agent, and
[`docs-audit/SKILL.md`](../docs-audit/SKILL.md) for the sibling skill
this one is structurally parallel to — that one covers meta-documentation
staleness (`CLAUDE.md`, `docs/`, `evals/`, every `SKILL.md`) against
current repo state; this one covers the prose _quality_ of the published
topics themselves under `src/content/**`, the System Design case
studies under `src/system-design/case-studies/` and the DSA entries under
`src/dsa/entries/`, against
the [Writing Standard](../../../docs/writing-standard.md). Neither one's scope
includes the other's.

## Why an independent read, not a self-check

The same reasoning `docs-audit` gives applies here, doubled: whoever
wrote or last edited a topic is the worst-positioned person to notice it
reads as AI-patterned, because the phrasing already sounds normal to the
mind that produced it. A fresh `general-purpose` agent (never `fork`)
that never held the draft in mind reads the tic on sight instead of
"obviously fine, I just wrote that."

## Stage 0 — Scope the run

Default: every file under `src/content/**/*.md`,
`src/system-design/case-studies/*.md` and `src/dsa/entries/*.md` (glob at run time — don't trust a cached
file list, the corpus grows). If invoked with
specific file or section names as arguments, scope to those instead and
say so before starting.

## Stage 1 — Enumerate and batch

List every in-scope file yourself (mechanical, no bias risk). Split the
list into roughly-even parallel batches rather than one massive agent
call — by section is the natural split (mirrors how this repo's own
first full sweep split 52 files across 4 agents by section). A batch of
roughly 10-15 files per agent is a reasonable target; adjust down if a
section is unusually large. The case studies get batches of their
own, split so each agent can read its share in full (about five per agent,
with their `.d2` sources); check 4 below applies to them. The DSA
entries get batches of their own too, about five entries per agent, since each
comes with four code and test files under `src/dsa/code/<slug>/`; check 6
below applies to them.

## Stage 2 — Independent audit, per batch

Spawn a **fresh** `general-purpose` agent per batch (never `fork` — it
must not inherit any prior read of these files). Give each agent its
batch's file list, the [Writing Standard](../../../docs/writing-standard.md), the path of
`docs/NON_NEGOTIABLES.md` (a violation there is always a real finding),
and this instruction, close to verbatim:

> Read every file in your batch in full. Audit each one against these
> criteria. Report findings grouped by file, each with a quote, which
> criterion it violates, and a suggested fix. Do not edit anything —
> audit only. If a file has nothing worth flagging, say so explicitly
> rather than inventing a minor nitpick.
>
> **1. Tone — does this read like something a knowledgeable person
> actually wrote, or a generically AI-patterned draft?** Read
> docs/writing-standard.md and flag each pattern its tone bullet lists. A
> bolded-lead-in bullet format is house style: flag it only when EVERY item
> in a list follows the identical rhythm with zero variation.
>
> Explicitly do **NOT** flag: em-dashes in general (established house
> style), technical precision, or headers that are simply clear and
> descriptive.
>
> **2. Figurative/analogical language — is a casual phrase trusted to
> land, or over-explained?** Check whether any term, phrase, or analogy
> that's meant casually or figuratively gets belabored as if it needs to
> be justified or explained literally — for example, a topic that uses a
> casual, widely-understood figurative phrase but then spends a passage
> defending or literally justifying the term, as if a reader might
> mistake it for a literal claim, when it should just be used naturally
> and trusted to land. Flag any instance of this pattern.
>
> **3. Correctness — is every substantive technical claim actually
> true?** Don't assume the existing draft is right. Independently verify
> each substantive technical claim against real subject-matter knowledge.
> Flag anything inaccurate, misleadingly oversimplified to the point of
> being wrong, or internally inconsistent — quote the claim, say what's
> wrong, and say what's actually true.
>
> **4. Case studies only (skip for a catalog topic) — does it apply
> topics, or re-teach them, and do its numbers hold?** A System Design case
> study under `src/system-design/case-studies/` applies catalog topics to
> one design and links to them; it doesn't carry a topic's mechanism. Flag a
> passage that walks through how a topic works instead of saying what the
> choice buys and costs in this design, then linking. Recompute every
> estimate line by line and flag arithmetic that's wrong or doesn't follow
> from the stated requirements; flag a decision that picks an option without
> saying why the alternative a reader would suggest loses here; flag a diagram
> (read the `.d2` source under `src/system-design/diagrams/`) that disagrees
> with the prose; and flag any claim about how a specific named company builds
> its system. Check each follow-up answer against the decisions and numbers
> above it. Read the linked topic when deciding.
>
> **4b. Case studies and DSA entries — are they digestible?** Hold each to
> docs/writing-standard.md's "Case studies and DSA entries" section. Flag a
> passage that reads as a lecture to sit through rather than someone talking
> to the reader, an edge case or exception that spends words without changing
> a decision, a claim compression made false (an absolute "never" or "always"
> the design doesn't deliver), and a page a reader would finish unable to
> defend its main choice.
>
> **5. Systems topics only (skip for other sections and case studies) —
> is the closing `## Where you'll meet this` section general and true?**
> It should name kinds of systems (the reference set in docs/content.md) and say what the
> topic does
> there, without re-teaching the mechanism. Flag any claim about how a
> specific named company builds something (it can't be verified), any
> sentence that isn't true of the generic system described, and any
> section that just restates the topic's own definition.
>
> **6. DSA entries only (skip for topics and case studies) — do the code
> claims hold?** An entry under `src/dsa/entries/` shows code from
> `src/dsa/code/<slug>/` (Python and TypeScript, each with its tests). Check
> every claim the prose makes about that code (what it returns, its edge
> cases, its complexity) against the code files and their tests, not only
> the chunk quoted in the markdown, and recompute every worked example.
> Flag a walkthrough or code comment that narrates what a line does without
> saying why, and a tricky line (a boundary, a loop direction) with no
> comment giving its reason.
>
> Your batch: <Stage 1's file list for this batch>

Run all batches in parallel (one message, multiple `Agent` calls), not
sequentially.

## Stage 3 — Apply fixes

Confirmed findings are low-risk text edits (not behavioral code), so
apply them directly — no separate fix agent needed for a small finding
count, the same reasoning `docs-audit` Stage 3 gives (the independent
audit in Stage 2 already was the check). If the finding count is large
(many files, many findings per file), batch the fixes across fresh
agents again rather than applying dozens of edits serially yourself,
mirroring how the first full sweep (2026-09-15) applied its fixes in
batches rather than one at a time. For a finding you disagree with, or a
correctness claim that needs a judgment call the audit agent couldn't
make on its own, resolve it yourself or ask the user rather than
applying it blindly. A fix to a DSA entry's code changes the code file, the
chunk quoted in the entry and a test that would have caught it together, as
`add-dsa-entry`'s fix step does.

## Stage 4 — Final gate

```bash
npm run verify
```

Summarize for the
user: what was audited, what was found (grouped by
criterion), what was fixed, and anything left open for their judgment.
Ask before committing or pushing, same as always — this skill leaves the
working tree ready, it doesn't ship it.
