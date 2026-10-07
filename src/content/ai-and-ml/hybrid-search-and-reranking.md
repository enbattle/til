---
title: Hybrid Search and Reranking
summary: Keyword search catches exact strings, vector search catches meaning; run both, merge the lists, then let a slower, sharper model put the best passages on top.
date: 2026-10-07
---

Say you run support for a project-management app, and your help center is split
into about 2,000 chunks of a few hundred words each, ready for a
[RAG](/ai-and-ml/what-is-rag) chatbot: one that searches the chunks for each
question and pastes the best few into a language model's prompt, so it
answers from your docs. A customer asks: "Why does my export
fail with error 4012?" Two chunks would answer it. One is titled "Error 4012:
export permission denied". The other is "Resolving permission problems when
downloading a report", which never mentions the code. Which search finds them?

## Two searches that fail differently

**Keyword search** scores each chunk by the words it shares with the question.
The standard formula, **BM25**, weights each shared word by how rare it is
across all chunks, so a word that appears almost everywhere ("the", "does")
counts for little and a word that appears in only one or two chunks ("4012")
counts for a lot. Each repeat of a word adds less than the one before, and a
long chunk doesn't win just by containing more words. For your question, BM25 puts "Error
4012: export permission denied" first. It doesn't put the downloading article
in its top 50 at all, because that article shares almost no words with the
question.

**[Vector search](/ai-and-ml/vector-search)** turns the question and every
chunk into embeddings, lists of numbers placed so that similar meanings sit
close together, and returns the nearest chunks. It ranks the downloading
article near the top, since "export fails" and "problems when downloading"
mean nearly the same thing. But "4012" is a few characters with no particular
meaning to an embedding model, so the chunk that names the code exactly may
land several places down.

Each one misses what the other finds. Error codes, product names, function
names and IDs are where keyword search wins. Paraphrases, like "too many
requests" for "rate limit exceeded", are where vector search wins. Support
questions mix both, so you run both.

## Merging two ranked lists

Now you have two top-50 lists. Why not add up their scores? Because the
scores aren't on the same scale: a BM25 score might be 14.2 and a vector
similarity 0.83, and neither number means anything next to the other.

So the usual merge ignores scores and uses only positions. **Reciprocal rank
fusion (RRF)** gives each chunk 1 / (60 + rank) from each list it appears in,
and adds them up. The 60 is a conventional constant that keeps the top few
ranks from dominating.

One more chunk matters here. "Export size limits" lists, format by format,
when an export will fail, so it repeats "export" and "fail" many times. BM25
ranks it second, though it says nothing about error 4012. Suppose the three
chunks place like this:

| Chunk                                | Keyword rank  | Vector rank | Fused score          |
| ------------------------------------ | ------------- | ----------- | -------------------- |
| Error 4012: export permission denied | 1             | 6           | 1/61 + 1/66 = 0.0315 |
| Export size limits                   | 2             | 15          | 1/62 + 1/75 = 0.0295 |
| Resolving permission problems…       | not in top 50 | 1           | 1/61 = 0.0164        |

The chunk both searches liked comes first. Both answers are now in the merged
list, though the permissions article got there on one list's vote alone. And
the size-limits chunk, which doesn't explain the error, sits above it. Running both searches gets the right chunks into the
candidates, and fusion lifts the ones both lists agree on. Neither is good at
fine ordering.

## Reranking the shortlist

A **reranker** fixes the order. It is a model that reads the question and one
passage together and returns a single relevance score. Score every candidate
that way and sort by the scores. Reading both together is what makes it sharp: it can
see that the size-limits chunk is about file sizes and says nothing about
permissions, which a word count or an embedding distance can't.

Why not use the reranker as the search itself? Embeddings are computed for
each chunk once, ahead of time, and a question only has to be compared against
them. A reranker can't work ahead, because its score depends on the question:
every question needs one full model pass per passage. For a hundred candidates
that is tens to hundreds of milliseconds, depending on the model and the
hardware. For all 2,000 chunks it would be 20 times that, on every question,
and the cost grows with every page you add.

So the work is split by cost. The two cheap searches pull a wide net of 50 to
100 candidates, the reranker orders that shortlist, and only the top few,
perhaps five, go into the model's prompt. Fewer, better passages also mean a
shorter prompt, which is cheaper and gives the model less irrelevant text to
be misled by.

## Do you always need all three?

No. If your questions are plain-language and your docs have no codes or
product names, vector search alone may be fine. If users search by exact IDs,
keyword search may be most of what you need. A reranker adds latency and
another model to run, so add it when the right chunk is usually in the top 50
but often not in the top five. You can only know that by measuring, which is
what [RAG evaluation](/ai-and-ml/rag-evaluation) is for.

**Rule of thumb.** Use keyword search for exact strings and vector search for
meaning, merge them by rank when your questions contain both, and rerank only
the shortlist when the right passage is found but not placed near the top.
