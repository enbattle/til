---
title: RAG Evaluation
summary: Score the search and the answer separately, or a bad reply won't tell you which half of the pipeline to fix.
date: 2026-10-07
---

Say you run the support chatbot for a project-management app. It works by
[retrieval-augmented generation (RAG)](/ai-and-ml/what-is-rag): it searches
your help docs for passages, called chunks, that match the question, and hands
the best few to a language model to answer from. A customer asks: "Why does my
export fail with error 4012, and how do I fix it?" The bot's reply is wrong.
Was the search wrong, or the model?

You can't tell from the reply. The pipeline has two halves:

```
question -> retrieved chunks -> model's answer
```

and either can fail. So you measure each half on its own, with the same kind
of fixed test set any [eval](/ai-and-ml/what-are-evals) uses: real questions,
scored the same way before and after every change.

## Scoring the search

To score retrieval, someone first marks, for each test question, which chunks
actually answer it. For the 4012 question, say two chunks do: "Error 4012:
export permission denied" and "Resolving permission problems when downloading
a report". These labels are the slow part, and the part everything else rests
on.

Now run the search. Say it returns its best 50 candidates and you pass the top
5 to the model, so k is 5. The error-code chunk comes back third, and the
permissions article doesn't make the top 5.

- **Recall@k** is the share of the relevant chunks that made it into the top
  k: one of two, so 0.5. Half the information the answer needs never reached
  the model.
- **Precision@k** is the share of the top k that is relevant: one of five, so
  0.2. Four of the five chunks were noise.

For RAG, recall usually matters more. The model can't use a chunk it was never
given, while an irrelevant one mostly costs prompt space, though enough of them
can distract it.

Neither number cares about order: a relevant chunk at rank 1 and at rank 5
count the same. But order decides which 5 of the 50 survive the cut, and it's
what a **reranker**, a slower model that re-sorts the candidates, exists to
improve. A simple order-aware score is the **reciprocal rank**: 1 divided by
the position of the first relevant chunk, here 1/3. Averaged over all
questions it's the **mean reciprocal rank (MRR)**. A finer one, **normalized
discounted cumulative gain (nDCG)**, gives credit for every relevant chunk and
less for each lower position.

You average every score over the whole test set, since one question tells you
little.

## Scoring the answer

Suppose the bot replies: "Error 4012 means your role isn't allowed to export
this project [1]. It also appears when your free trial has ended [2]." Four
checks apply to every reply:

- **Faithfulness.** Is every claim supported by the retrieved chunks? None of
  the five mentions trials, so the second sentence fails, however plausible it
  sounds.
- **Completeness.** Did it answer every part of the question? The customer
  asked why and how to fix it. The reply explains why but never says how,
  because the fix was in the permissions article, which the model never saw.
- **Citations.** Does each cited chunk say what its sentence claims? [1] is
  the error-code chunk and holds up. [2] points at a chunk that says nothing
  about trials, so the invented sentence also carries a false citation.
- **Saying "not covered".** Include questions your docs can't answer, such as
  one about a file format you don't support. The right reply says the docs
  don't cover it, rather than inventing an answer.

Code can check some of this, such as whether every cited chunk was actually
retrieved. The rest is usually graded by a second model given a rubric, which
must be checked against a batch of human grades before you trust it.

## Reading the two halves together

Now the scores point at a fix, one claim at a time. Something the answer
needed but lacks, when its chunk wasn't retrieved, is retrieval's fault:
improve the chunking or the search, perhaps with
[hybrid search and reranking](/ai-and-ml/hybrid-search-and-reranking). A
claim that none of the retrieved chunks supports is the model's fault, however
good or bad the recall: change the prompt or the model. The 4012 reply has one
of each. The missing fix needs better retrieval, since no prompt can make the
model state a fix it was never shown. The invented trial claim needs a
stricter prompt or model.

Record each question's response time and cost beside its quality, and watch
the slowest few percent of response times, not just the average. If the
permissions article was 12th of the 50 candidates, a reranker that moves it
into the top 5 raises recall@5 from 0.5 to 1.0, and might add a tenth of a
second. Whether that's worth it is a decision you can only make with both
numbers.

## Keeping the test set honest

Run every change, whether a new chunk size, a cheaper model or a cache,
against the same set before it ships. Once the 4012 question passes, keep it
in the set so a later change can't quietly break it again. And relabel its
chunks when the help pages behind them change, or the set will grade against
docs that no longer exist. The general habits of a good test set are in
[LLM evals](/ai-and-ml/what-are-evals).

**Rule of thumb.** Score retrieval and answers separately on the same fixed
set of real questions, and when a reply is wrong, check whether the right
chunk was retrieved before you change the model.
