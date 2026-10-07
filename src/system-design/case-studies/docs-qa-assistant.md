---
title: Design a Docs Q&A Assistant (like a help-center chatbot)
summary: Hybrid search and a reranker to find the passage, a fixed test set that scores search and answer separately, and model routing that roughly halves the bill, for 5 million questions a day.
date: 2026-10-07
order: 17
---

You're asked to design the assistant on a software company's help center: a
customer types "Why does my export fail with error 4012?" and gets an answer
written from the help pages, with links to its sources. It works by
[retrieval-augmented generation (RAG)](/ai-and-ml/what-is-rag): search the
docs, paste the best passages into a language model's prompt, let it answer.
The design turns on what production adds: finding
the right passage when questions mix error codes and plain words, knowing
whether a change made answers better or worse, and paying for millions of
model calls.

## Requirements

- Answer from 10,000 help pages, citing the passages used, and say so when the
  docs don't cover the question.
- An edited page is reflected in answers within 10 minutes.
- 5 million questions a day; the answer starts streaming within 1.5 seconds at
  p95 (95% of questions are faster).
- No change to search, prompt or model ships if it falls below a quality bar
  on a fixed test set of labeled questions.
- Keep the model bill as low as that bar allows.

Out of scope: sign-in, ticket filing and languages other than English.

## Key numbers

These size the servers, the indexes, the reranker and the model bill. Rounded, with peak at ten times
average:

- **Questions:** about 600 a second at peak. 5 million a day ÷ 86,400 seconds
  ≈ 58 a second on average.
- **Indexes:** about 300 MB, small enough to keep in memory. 10,000 pages × 5 chunks of about 300 words = 50,000 chunks, each
  with 2 KB of text and an **embedding**, 1,024 numbers placing similar text
  close together, at 4 bytes per number (4 KB).
- **Reranker:** 30,000 question-passage pairs a second at peak. A
  **reranker** is a model that scores each candidate passage against the
  question; at 50 candidates per question, assume one GPU scores 2,000 pairs
  a second: 15 GPUs, 20 with headroom.
- **Model tokens:** about 2,400 in and 200 out per question: a 300-token
  instruction, 5 chunks of about 400 tokens, and about 100 on average for
  the question. That is 12 billion tokens in and 1 billion out a day.
- **Model bill:** about $51,000 a day, or a cent per question. Assume the large
  model costs $3 per million tokens in and $15 per million out: 12,000 × $3 +
  1,000 × $15.

## High-level architecture

![Architecture of the docs Q&A assistant. A chat widget sends POST /ask to answer service instances and receives the streamed answer. The answer service checks an answer cache first, then takes the top 25 from each of two search indexes, a keyword index and a vector index. It sends the 50 candidates to a reranker, then sends a prompt with the top 5 chunks to one of two models, a small model or a large model. On the indexing path, the help center tells an indexer when a page changes; the indexer re-indexes the page in search and deletes answer-cache entries citing it.](/diagrams/docs-qa-assistant/architecture.svg)

Follow the 4012 question. A follow-up like "and on mobile?" would first be
rewritten by the small model into a standalone question; this one skips that
call. The answer service normalizes it and checks the answer cache. On a miss it embeds the question and queries the keyword index
and the vector index in parallel for 25 chunks each, sends those candidates to
the reranker, and puts the top 5 into the prompt. A small classifier in the
answer service picks the small or the large model, and the answer streams back
with its citations. When an editor saves a help page, the indexer
re-chunks and re-embeds that page and deletes cached answers that cited it.

## API and data model

```http
POST /ask
{ "question": "Why does my export fail with error 4012?", "conversation_id": "cv_123" }
-> 200, streamed: answer text, then
   { "citations": [{ "chunk_id": "c_81723", "page_url": "/help/exports#errors" }] }

POST /internal/pages/{page_id}/changed      (called by the help center on save)
-> 202
```

```text
chunks          kept in both search indexes
  chunk_id      string, primary key
  page_id       string, indexed      every chunk of a page is replaced together
  page_version  integer
  text          string               about 300 words
  embedding     1,024 floats

answer_cache    key: normalized standalone question, expires after 10 minutes
  answer, citations, cited page_ids
```

`page_id` on every chunk and cached answer makes an edit cheap: replace that
page's 5 chunks, and delete only the answers citing it.

## Decision: hybrid search, then rerank 50

Support questions mix exact strings with plain wording. "4012" needs keyword
search, which finds rare words exactly; "export fails" matching "problems when
downloading a report" needs [vector search](/ai-and-ml/vector-search), which
compares embeddings. Each returns its top 25, and the reranker reads the
question with each candidate, up to 50, and picks the 5 that go into the prompt
([hybrid search and reranking](/ai-and-ml/hybrid-search-and-reranking)).

Why not vector search alone? Here the keyword
index is about 100 MB of text in memory and answers in milliseconds, so
dropping it saves almost nothing. What it would cost is the questions where
customers are most specific: error codes, plan names and setting names, which
embeddings treat loosely.

**Rule of thumb.** Keep a cheap exact-match search beside meaning search, and
spend the expensive model only on the shortlist.

## Decision: a fixed test set that scores search and answer separately

Two thousand real questions, each labeled with the page sections that answer
it (chunk IDs change when a page is re-chunked), plus
questions the docs can't answer. Every change runs against it before release
([RAG evaluation](/ai-and-ml/rag-evaluation)). Retrieval gets **recall@5**,
the share of each question's relevant sections that reach the top 5. Each answer
is graded by a second model, checked against human grades, for faithfulness
(every claim supported by a retrieved chunk), completeness and correct
citations.

Why not just A/B test on live traffic? A live test finds a regression only
after customers have acted on the wrong answers, and a thumbs-down can't show
that an answer invented a fact the customer believed. A live test still
follows, since real questions drift, and its wrong answers join the set.

**Rule of thumb.** Gate every change on the same labeled questions, and score
the search and the answer apart, or you can't tell which one broke.

## Decision: route easy questions to a small model

Measure each stage first. Searching both indexes takes tens of milliseconds
and reranking about a tenth of a second; the model takes most of the time to
the first word and nearly all of the $51,000. "How do I export to CSV?" answered from one chunk doesn't need the large
model. Assume a small model costs a tenth as much, and the classifier sends 60%
of questions to it: 0.4 × $51,000 + 0.6 × $5,100 ≈ $23,500 a day, less than
half.

Why not the small model for everything? It falls below the bar on questions
that combine several chunks or need judgment, so each route is scored on the
test set separately.

**Rule of thumb.** Find where the time and money go before optimizing, and
give each question the cheapest model that meets your bar.

## Likely follow-ups

- **Why not cache answers to similar questions, too?** "Cancel my annual plan"
  and "cancel my monthly plan" embed close together and have different
  answers. Only exact repeats of standalone questions are cached, never
  follow-ups, and every entry expires after 10 minutes
  ([cache invalidation](/systems-and-infrastructure/cache-invalidation)).
- **How does it know the docs don't cover it?** If the reranker's best score
  falls below a threshold tuned on the test set's unanswerable questions, the
  model is told to say the docs don't cover it.
- **What if a help page says "ignore your instructions"?** It's
  [prompt injection](/ai-and-ml/prompt-injection). Treat retrieved text as
  data, index only pages your own editors publish, and give the model nothing
  to do but answer.
- **How does an edit appear within 10 minutes?** On save, the indexer
  re-embeds the page's 5 chunks in seconds and deletes cached answers citing
  it; the 10-minute expiry catches answers that should change but never cited
  the page.
- **Why not skip search and put every page in the prompt?** 50,000 chunks run
  to about 20 million tokens, past any model's
  [context window](/ai-and-ml/context-window), and each question would cost
  thousands of times more.
