---
title: Design a Docs Q&A Assistant (like a help-center chatbot)
summary: Hybrid search and a reranker to find the passage, a fixed test set that scores search and answer separately, and model routing that roughly halves the bill, for 5 million questions a day.
date: 2026-10-07
order: 17
---

You're asked to design the assistant on a software company's help center. A customer types "Why does my export fail with error 4012?" and gets an answer written from the help pages, with links to the pages it used.

The assistant is a **language model**, a program that writes text, given the right help pages along with the question. Giving it the pages is [retrieval-augmented generation (RAG)](/ai-and-ml/what-is-rag): search the docs first, then put the best passages in front of the model with the question.

Searching is the easy part to describe. Production adds three harder ones: finding the right passage when questions mix error codes and plain words, knowing whether a change made answers better or worse, and paying for millions of model calls. This page starts with the obvious design, one search and one model, and shows where it breaks. Then it follows a question through the design that replaces it, sizes its parts, and makes three decisions: how to search, how to test changes, and which model answers.

## Requirements

- Answer from 10,000 help pages, citing the passages used, and say so when the docs don't cover the question.
- An edited page is reflected in answers within 10 minutes.
- 5 million questions a day, with the peak ten times the average.
- The first words of an answer appear within 1.5 seconds at p95 (95% of questions are faster), and the rest streams in word by word.
- No change to search, prompt or model ships if it falls below a quality bar on a fixed test set of labeled questions.
- Keep the model bill as low as that bar allows.

Out of scope: sign-in, ticket filing and languages other than English.

## Start simple

The obvious design searches by meaning. Before any customer asks, split each of the 10,000 pages into **chunks**, passages of about 300 words. Then turn each chunk into an **embedding**, a list of 1,024 numbers that places similar text close together.

Keep the embeddings in a **vector index**, a store that returns the chunks closest to a given embedding ([vector search](/ai-and-ml/vector-search)). The **answer service**, the server that handles each question, embeds the question and asks the index for the 5 closest chunks.

It puts those chunks and the question into a **prompt**, the text a model reads, and sends it to a **large model**, the most capable and costliest kind of language model. The answer streams back with links to the chunks' pages.

Models bill by the **token**, a piece of text about three-quarters of a word long ([tokenization](/ai-and-ml/tokenization)). Say a prompt is 2,400 tokens: 300 of instructions, 5 chunks of about 400, and about 100 for the question. The answer is 200 tokens. Assume the large model costs $3 per million tokens in and $15 per million out.

```text
one question:
  in:    2,400 tokens × $3 ÷ 1,000,000 = $0.0072
  out:   200 tokens × $15 ÷ 1,000,000 = $0.0030
  total: $0.0072 + $0.0030 = $0.0102, about a cent
a small help center, 1,000 questions a day:
  1,000 × $0.0102 = $10 a day
this one, 5,000,000 questions a day:
  5,000,000 × $0.0102 = $51,000 a day
a year:
  $51,000 × 365 ≈ $18.6 million
```

At 1,000 questions a day, that is a fine design. At 5 million, the bill is $51,000 a day, and two more gaps show up.

The first is finding the chunk. Embeddings treat an error code like "4012" loosely, so the right chunk can rank low. A **keyword index**, which finds chunks by their exact words, answers "4012" directly. Together the two indexes return up to 50 candidates, which a **reranker**, a model that scores each one against the question, narrows to 5 ([hybrid search and reranking](/ai-and-ml/hybrid-search-and-reranking)).

The second is the bill. A **small model**, a cheaper language model, can take the easy questions. An **answer cache**, which stores recent answers, spares the model repeated questions.

One more part keeps the docs fresh. An **indexer** re-processes a page when an editor saves a change in the help center. Here is how a question moves through all of these.

## High-level architecture

![Architecture of the docs Q&A assistant. A chat widget sends POST /ask to answer service instances and receives the streamed answer. The answer service checks an answer cache first, then takes the top 25 from each of two search indexes, a keyword index and a vector index. It sends the 50 candidates to a reranker, then sends a prompt with the top 5 chunks to one of two models, a small model or a large model. On the indexing path, the help center tells an indexer when a page changes; the indexer re-indexes the page in both search indexes and deletes the answer-cache entries citing it.](/diagrams/docs-qa-assistant/architecture.svg)

Follow the 4012 question. The answer service normalizes it (lowercases it and trims spaces) and checks the answer cache. On a miss it embeds the question and queries the keyword index and the vector index at the same time, for 25 chunks each. The reranker scores those 50 candidates, and the top 5 go into the prompt. A follow-up like "and on mobile?" would first be rewritten by the small model into a standalone question; this one skips that call.

A **classifier**, a small program inside the answer service, sorts the question by difficulty and picks the small or the large model. The answer streams back with its citations.

When an editor saves a page, the indexer re-chunks and re-embeds it, replaces its chunks in both indexes, and then deletes the cached answers that cited it. That touches three stores, so a crash midway could leave them out of step. The indexer repeats the whole job on restart, which is safe because replacing a page's chunks twice leaves the same result ([idempotency](/systems-and-infrastructure/idempotency)). A question answered during the update can still cache an old answer, and the 10-minute expiry removes it. How big do these parts need to be?

## Key numbers

These size the answer service, the indexes, the reranker and the model bill. A day is 86,400 seconds, and figures are rounded.

- **Questions:** about 600 a second at peak. 5,000,000 ÷ 86,400 ≈ 58 a second on average, and 58 × 10 ≈ 600.
- **Indexes:** about 300 MB, small enough to keep in memory. 10,000 pages × 5 chunks = 50,000 chunks. Their text is 50,000 × 2 KB = 100 MB, and their embeddings are 50,000 × 4 KB = 200 MB (1,024 numbers × 4 bytes ≈ 4 KB each).
- **Reranker:** 20 GPUs. At peak, 600 questions × 50 candidates = 30,000 question-passage pairs a second. Assume one GPU scores 2,000 pairs a second: 30,000 ÷ 2,000 = 15, plus a third for headroom is 20.
- **Model tokens:** 12 billion in and 1 billion out a day. 5,000,000 questions × 2,400 tokens in = 12 billion, and 5,000,000 × 200 out = 1 billion.
- **Model bill:** $51,000 a day with the large model alone. 12,000 million tokens in × $3 per million = $36,000, plus 1,000 million out × $15 per million = $15,000.

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

The `202` means the change is accepted, not yet applied. `page_id` on every chunk and cached answer makes an edit cheap: replace that page's 5 chunks, and delete only the answers citing it.

That's the shape. Now the three choices that matter, starting with how it searches.

## Decision: hybrid search, then rerank 50

The simpler search is the vector index alone, as in "Start simple". It holds 200 MB of embeddings. The keyword index adds 100 MB of text and answers in milliseconds, so dropping it would save a third of the memory (100 ÷ 300) and almost no time. What it would cost is the questions where customers are most specific: error codes, plan names and setting names, which embeddings treat loosely.

So both searches run, because support questions mix exact strings with plain wording. "4012" needs the keyword index, and "export fails" matching "problems when downloading a report" needs meaning. Each returns its top 25. The reranker reads the question together with each of the up to 50 candidates and picks the 5 that go into the prompt. It is slower and sharper than either search, which is why it sees only the shortlist, not all 50,000 chunks.

The price is 20 GPUs for the reranker, about a tenth of a second of the 1.5-second budget, and two indexes to update on every edit.

**Rule of thumb.** Keep a cheap exact-match search beside meaning search, and spend the expensive model only on the shortlist.

## Decision: a fixed test set that scores search and answer separately

The simpler way to check a change is to ship it to a slice of live traffic and watch the thumbs-down. Say a bad prompt gets 1 question in 20 wrong, and the test sends it 5% of traffic:

```text
questions in the test:
  5,000,000 × 0.05 = 250,000 a day
wrong answers:
  250,000 ÷ 20 = 12,500 a day
```

That is 12,500 customers a day acting on a wrong answer before anyone reads a thumbs-down, and a thumbs-down can't show that an answer invented a fact the customer believed.

So every change runs against a fixed test set before release ([RAG evaluation](/ai-and-ml/rag-evaluation)): 2,000 real questions, each labeled with the page sections that answer it (chunk IDs change when a page is re-chunked), plus questions the docs can't answer. Search gets **recall@5**, the share of each question's relevant sections that reach the top 5. Each answer is graded by a second model, checked against human grades, for faithfulness (every claim supported by a retrieved chunk), completeness and correct citations.

The cost is labeling the 2,000 questions, keeping them current, and about 2,000 × $0.0102 ≈ $20 per run, plus the grading. A live test still follows, since real questions drift, and its wrong answers join the set.

**Rule of thumb.** Gate every change on the same labeled questions, and score the search and the answer apart, or you can't tell which one broke.

## Decision: route easy questions to a small model

The simpler design sends every question to the large model, at $51,000 a day. Measure each stage first. Searching both indexes takes tens of milliseconds and reranking about a tenth of a second. The model takes most of the time to the first word and nearly all of the $51,000, so that is where to cut.

"How do I export to CSV?" answered from one chunk doesn't need the large model. Assume a small model costs a tenth as much, so the whole day on it would be $51,000 ÷ 10 = $5,100, and the classifier sends 60% of questions to it:

```text
large model, 40% of questions:
  0.4 × $51,000 = $20,400
small model, 60% of questions:
  0.6 × $5,100 = $3,060
total:
  $20,400 + $3,060 = $23,460, about $23,500 a day
```

That is less than half. Why not send everything to the small model for $5,100? It falls below the bar on questions that combine several chunks or need judgment. So the cost of routing is the classifier, one more thing to tune, and each route is scored on the test set separately.

**Rule of thumb.** Find where the time and money go before optimizing, and give each question the cheapest model that meets your bar.

## Likely follow-ups

- **Why not cache answers to similar questions, too?** "Cancel my annual plan" and "cancel my monthly plan" embed close together and have different answers. Only exact repeats of a standalone question are cached (a follow-up is rewritten first), and every entry expires after 10 minutes ([cache invalidation](/systems-and-infrastructure/cache-invalidation)).
- **How does it know the docs don't cover it?** If the reranker's best score falls below a threshold tuned on the test set's unanswerable questions, the model is told to say the docs don't cover it.
- **What if a help page says "ignore your instructions"?** It's [prompt injection](/ai-and-ml/prompt-injection). Treat retrieved text as data, index only pages your own editors publish, and give the model nothing to do but answer.
- **How does an edit appear within 10 minutes?** On save, the indexer re-embeds the page's 5 chunks in seconds and deletes cached answers citing it; the 10-minute expiry catches answers that should change but never cited the page.
- **Why not skip search and put every page in the prompt?** 50,000 chunks × 400 tokens = 20 million tokens, past any model's [context window](/ai-and-ml/context-window), and each question's input would grow from 2,400 tokens to 20 million, 20,000,000 ÷ 2,400 ≈ 8,300 times more.
- **Can the shared instructions be cached?** The 300 instruction tokens open every prompt, so a self-hosted model server can reuse the work it did on them ([KV cache](/ai-and-ml/kv-cache)). Hosted APIs sell this as prompt caching, but only for a shared opening of about 1,000 tokens or more, which 300 falls short of. Even self-hosted, it covers only 300 ÷ 2,400 = 12.5% of the input, because the 5 chunks differ for each question.
