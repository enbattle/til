---
name: content-audit
description: Sweep published topic(s) under src/content/**/*.md, and System Design question pages under src/system-design/questions/*.md, for content-quality problems the per-topic review doesn't structurally catch — prose that reads as generically AI-generated, figurative language over-explained instead of trusted to land, and technical claims that were never independently verified. Defaults to every published topic (a corpus-wide sweep) but also scopes to a single already-published file or section when asked to check the content quality of one existing topic. Use when asked for a corpus-wide content-quality sweep, a check of whether existing topics "sound AI-written," or a quality check of one specific already-published topic (not a brand-new topic being drafted — that's add-topic's job — and not meta-documentation staleness like CLAUDE.md/docs/SKILL.md files — that's docs-audit's job).
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
topics themselves under `src/content/**` and the System Design question
pages under `src/system-design/questions/`, against
[CLAUDE.md](../../../CLAUDE.md)'s Writing Standard. Neither one's scope
includes the other's.

## Why an independent read, not a self-check

The same reasoning `docs-audit` gives applies here, doubled: whoever
wrote or last edited a topic is the worst-positioned person to notice it
reads as AI-patterned, because the phrasing already sounds normal to the
mind that produced it. A fresh `general-purpose` agent (never `fork`)
that never held the draft in mind reads the tic on sight instead of
"obviously fine, I just wrote that."

## Stage 0 — Scope the run

Default: every file under `src/content/**/*.md` and
`src/system-design/questions/*.md` (glob at run time — don't trust a cached
file list, the corpus grows). If invoked with
specific file or section names as arguments, scope to those instead and
say so before starting.

## Stage 1 — Enumerate and batch

List every in-scope file yourself (mechanical, no bias risk). Split the
list into roughly-even parallel batches rather than one massive agent
call — by section is the natural split (mirrors how this repo's own
first full sweep split 52 files across 4 agents by section). A batch of
roughly 10-15 files per agent is a reasonable target; adjust down if a
section is unusually large. The question pages are one more batch of their
own (they link across each other and into the topics, so read together they
are the natural unit for check 4 below).

## Stage 2 — Independent audit, per batch

Spawn a **fresh** `general-purpose` agent per batch (never `fork` — it
must not inherit any prior read of these files). Give each agent its
batch's file list, [CLAUDE.md](../../../CLAUDE.md)'s Writing Standard,
and this instruction, close to verbatim:

> Read every file in your batch in full. Audit each one against these
> criteria. Report findings grouped by file, each with a quote, which
> criterion it violates, and a suggested fix. Do not edit anything —
> audit only. If a file has nothing worth flagging, say so explicitly
> rather than inventing a minor nitpick.
>
> **1. Tone — does this read like something a knowledgeable person
> actually wrote, or a generically AI-patterned draft?** Flag:
>
> - Triadic or overly symmetric rhetorical constructions ("It's not just
>   X — it's Y").
> - Stock closing/summarizing phrases ("That's the actual X," "the real
>   Y," "at the end of the day").
> - A bolded-lead-in-plus-dash bullet format used with total mechanical
>   uniformity throughout an entire list. A few of these is fine — this
>   repo's house style uses them — flag only when EVERY item in a list
>   follows the identical rhythm with zero variation.
> - Filler intensifiers stacked without adding information
>   ("genuinely," "actually," "real," "worth noting," "in practice,"
>   repeated).
> - Redundant restatement: a header's point immediately re-said almost
>   verbatim in the very next sentence.
> - Meta-commentary about the explanation itself ("here's the
>   interesting part," "the key insight is").
> - Exhaustive, evenly-weighted lists that read as trying to cover every
>   angle rather than a selective, opinionated take.
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
> **4. Question pages only (skip for a catalog topic) — does it route
> and compare, or re-teach?** A System Design question page under
> `src/system-design/questions/` answers its question by comparing options
> and linking to catalog topics; it doesn't carry a topic's mechanism.
> Flag a snippet that walks through how a topic works instead of stating
> what the option buys, what it costs and when to pick it here, then
> linking. Also flag any fact stated in two places: a claim a linked topic
> already makes that the question restates rather than links, and a claim
> repeated across two question pages instead of living in one and being
> linked from the other. Read the linked topic when deciding.
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
mirroring how this session's own first full sweep applied its fixes in
batches rather than one at a time. For a finding you disagree with, or a
correctness claim that needs a judgment call the audit agent couldn't
make on its own, resolve it yourself or ask the user rather than
applying it blindly.

## Stage 4 — Final gate

```bash
npm run typecheck && npm run lint && npm run format:check
npm run test:run
```

Add `npm run build && npm run size` too if the batch of fixes was large
enough that a build-level regression is plausible. Summarize for the
user: what was audited, what was found (grouped by
criterion), what was fixed, and anything left open for their judgment.
Ask before committing or pushing, same as always — this skill leaves the
working tree ready, it doesn't ship it.
