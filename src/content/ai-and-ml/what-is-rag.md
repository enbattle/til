---
title: What is RAG?
summary: Why grounding an LLM's answer in retrieved documents beats relying on its memorized training data, and when that trade wins over fine-tuning or a huge context.
date: 2026-09-14
---

**Retrieval-augmented generation (RAG)** answers a question by first
fetching relevant external information and handing it to the model
alongside the question, instead of just asking the model to answer from
whatever it happened to absorb during training. The model's response is
then grounded in text that was actually retrieved for this specific
question, not reconstructed purely from memory.

```
question → search for relevant documents → hand model (question + documents) → grounded answer
```

## Why grounding the answer in retrieved text matters

A model answering purely from memory is reconstructing an answer from
statistical patterns learned during training — which means it can produce
something fluent and specific-sounding that's simply wrong, a failure
mode usually called **hallucination**. Handing the model real, retrieved
text to answer from doesn't make that impossible, but it gives the model
something concrete to work from instead of purely reconstructing from
memory, and it gives you something to check the answer against
afterward — you can point at exactly which document a claim came from.
It also sidesteps a structural limit of training itself: a model's
training data has a cutoff date and doesn't include anything private to
you, so anything that changed since then, or anything that was never
public in the first place, simply isn't in its memory to draw on at all.
Retrieval can pull in whatever's current and relevant at the moment the
question is asked, without needing to retrain anything.

## Turning "find related text" into a search you can run

The retrieval step relies on [vector search](/ai-and-ml/vector-search): a
model converts both the stored documents and the incoming question into
**embeddings** — numerical vectors positioned so that similar meanings
end up close together — and the system finds the stored documents whose
embeddings are closest to the question's. This is a meaningfully
different kind of search than keyword matching: a question like "fix
authentication error" can retrieve a document titled "resolving login
credential issues" even though the two share almost no words in common,
because the embeddings for those phrases land near each other.

## RAG versus teaching the model directly

RAG isn't the only way to get a model to work with information beyond its
training data — it's worth being clear about what it does and doesn't
replace:

- **Versus [fine-tuning](/ai-and-ml/when-to-finetune)**: fine-tuning
  changes the model's own weights, which is well suited to teaching a new
  _behavior_ or style, but is a slow, expensive way to teach _facts_ — a
  fine-tuned model doesn't reliably retain new information any better
  than it retains its original training data, and every update means
  retraining. RAG changes what the model sees at question time, not the
  model itself, so updating the knowledge is as cheap as updating the
  documents it retrieves from.
- **Versus a bigger [context window](/ai-and-ml/context-window)**: for a
  small, fixed set of documents, just including everything directly in
  the prompt can be simpler than building a retrieval system at all.
  Retrieval earns its cost once the underlying knowledge base gets too
  large for that to hold, typically because it's large, changes
  frequently, or both.

In practice, the strongest systems often combine more than one of these —
retrieval for knowledge that changes, a model whose base behavior has
been shaped for the domain, and a reasonably sized context window to hold
what retrieval brings back — rather than treating them as mutually
exclusive choices.

## Where it's a good fit, and where it isn't

RAG earns its keep for tasks grounded in a real, checkable body of
knowledge — documentation search, customer support over a product
knowledge base, research assistance over a document collection —
especially where that knowledge changes often enough that retraining a
model on it would be impractical. It's a poor fit for tasks that aren't
really about looking something up at all: open-ended creative writing,
casual conversation, or anything where the "knowledge" needed is small
enough to just fit directly in the prompt without the overhead of
building a retrieval pipeline around it.
