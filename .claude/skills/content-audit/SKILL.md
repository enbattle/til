---
name: content-audit
description: Sweep published topic(s) under src/content/**/*.md and System Design case studies under src/system-design/case-studies/*.md for content-quality problems the per-topic review doesn't structurally catch — prose that reads as generically AI-generated, figurative language over-explained instead of trusted to land, and technical claims that were never independently verified. Defaults to every published topic and case study (a corpus-wide sweep) but also scopes to a single already-published file or section when asked to check the content quality of one existing topic or case study. Use when asked for a corpus-wide content-quality sweep, a check of whether existing topics or case studies "sound AI-written," or a quality check or revision of one specific already-published topic or case study (not a brand-new topic being drafted, nor a rewrite of a topic to the catalog standard — both are add-topic's job — not a brand-new case study or a rewrite of one from scratch — both are add-case-study's job — and not meta-documentation staleness like CLAUDE.md/docs/SKILL.md files — that's docs-audit's job).
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
topics themselves under `src/content/**` and the System Design case
studies under `src/system-design/case-studies/`, against
the [Writing Standard](../../../docs/writing-standard.md). Neither one's scope
includes the other's.

## Stage 0 — Scope the run

Default: every file under `src/content/**/*.md` and
`src/system-design/case-studies/*.md` (glob at run time — don't trust a cached
file list, the corpus grows). If invoked with
specific file or section names as arguments, scope to those instead and
say so before starting.

## Stage 1 — Enumerate and batch

List every in-scope file yourself (mechanical, no bias risk). Split the
list into roughly-even parallel batches rather than one massive agent
call — by section is the natural split. A batch of
roughly 10-15 files per agent is a reasonable target; adjust down if a
section is unusually large. The case studies get batches of their
own, split so each agent can read its share in full (about five per agent,
with their `.d2` sources).

## Stage 2 — Independent audit, per batch

Spawn a **fresh** `general-purpose` agent per batch (never `fork`;
[why](../../../docs/SDLC.md#why-a-fresh-agent-never-a-fork)). Give each agent its
batch's file list, the [Writing Standard](../../../docs/writing-standard.md), the path of
`docs/NON_NEGOTIABLES.md` (a violation there is always a real finding),
and this instruction, close to verbatim, with each owning skill's Stage 3
`<checklist>` copied from its `SKILL.md`:

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
> **4. The checklist for the file's kind.** Apply the Stage 3 checklist
> below from the skill that owns the file's kind: `add-topic` for a catalog
> topic and `add-case-study` for a case study, and hold the file to every
> bullet of docs/writing-standard.md, including its "Teaching progression",
> "Catalog topics" and "Case studies" sections.
> Skip an item that only fits a new draft (a link-only diff, rewrite mode);
> add-topic's "Where you'll meet this" item applies only to
> `systems-and-infrastructure` topics, whose closing section names kinds of
> systems from the reference set in docs/content.md. Read what an item needs: a case
> study's `.d2` sources under `src/system-design/diagrams/` and the topics it
> links.
>
> <the Stage 3 `<checklist>` of each skill that owns a kind in this batch>
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
agents again rather than applying dozens of edits serially yourself.
For a finding you disagree with, or a
correctness claim that needs a judgment call the audit agent couldn't
make on its own, resolve it yourself or ask the user rather than
applying it blindly.

## Stage 4 — Final gate

```bash
npm run verify
```

Summarize for the
user: what was audited, what was found (grouped by
criterion), what was fixed, and anything left open for their judgment.
Ask before committing or pushing, same as always — this skill leaves the
working tree ready, it doesn't ship it.
