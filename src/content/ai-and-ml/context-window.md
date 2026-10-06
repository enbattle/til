---
title: Context Window
summary: The token budget that your prompt, the conversation so far and the model's reply all share, and how to spend it when the material won't fit or fits badly.
date: 2026-09-14
---

Say you're building a support assistant for a software company. A customer
types a question, and the assistant should answer from the company's help
center: a few hundred pages of articles. The model only knows what you hand it
in each call, so the first design question is simple: how much can you hand
it?

That limit is the **context window**: the maximum number of
[tokens](/ai-and-ml/tokenization) (the chunks of text a model reads and
writes) it can work with in one call. Current models range from tens of
thousands of tokens to a million or more, and the number keeps moving, so
check the one for the model you use.

## One budget, many claimants

The window is a single pool. Everything the model sees goes into it, and so
does everything it writes back:

```
instructions + conversation so far + help articles + new question + reply
  must all fit inside the context window
```

The last item is the one people forget. If the window is 100,000 tokens and
your prompt is 99,000, the reply has room for about 1,000 tokens, and it may be
cut off mid-sentence. Many APIs also let you set a separate cap on the reply
length, which has to fit in the leftover space too.

## What happens when you go over

You'd hope for a graceful fallback; what you get depends on the system. A raw API call usually rejects an oversized request with an error,
which is annoying but honest. A chat product or a framework that builds the
prompt for you may instead drop something to make room, often the oldest
messages or the middle of a long document, and tell no one.

For the support assistant, that second case is the dangerous one. If the
article that answers the customer's question is the one that gets dropped, the
model still replies, fluently, from whatever remained. Nothing in the answer
says that the evidence is missing. So you measure the tokens you're sending
instead of hoping they fit.

## Fitting isn't the same as working

Suppose the whole help center fits in a million-token window. Why not paste it
all into every call? Two reasons.

- **Cost and speed.** You're billed per input token, on every call, and
  processing a long prompt takes longer than a short one. Text that repeats on
  every request, such as the instructions, is the first place to trim, because
  the cost multiplies across all your customers' questions. Long contexts also
  take more memory on the serving side, which is what the
  [KV cache](/ai-and-ml/kv-cache) is about.
- **Attention.** A model can accept a long input and still use it unevenly.
  Studies of long-context models have found that facts buried in the middle of
  a very long input are often used less reliably than facts near the start or
  end, and accuracy can fall as the input grows even when the answer is
  present. How much this matters varies by model, so measure it on your own
  questions.

A window size tells you what is allowed, not how well the model reasons over it.

## Three ways to stay under budget

Back to the help center. You have more text than you can or should send, so you
choose what goes in.

**Retrieve only what's relevant.** Search the articles for the few that match
this customer's question and include only those. This is
[retrieval-augmented generation](/ai-and-ml/what-is-rag), and it can shrink a
prompt from the whole help center to a few thousand tokens. Its cost is a
retrieval system that can miss: if the search doesn't find the right article,
the model never sees it.

**Summarize before you include.** Compress a long document into a short one in
an earlier call, and send the summary. You trade detail for space, and the
summary can lose the one sentence that mattered.

**Trim the conversation.** A long chat grows with every turn, because
each call resends the earlier turns. Keep the recent exchanges verbatim and
replace older ones with a running summary, or drop them. The customer's first
message about their account type might matter later, so decide what to pin
instead of cutting purely by age.

Agents that read files and run tools fill their windows fast, and the same
tradeoffs apply; [Context Budget for an AI Coding Harness](/coding-agents/context-is-a-budget)
covers that case.

## Big window or retrieval?

If the help center were three articles, you'd paste them in. There's no
retrieval system to build or tune, and nothing to miss. At a few hundred pages,
you'd pay for the whole set on every call and lean on the model's uneven
attention, and retrieval starts to win. There's no sharp line between those
cases. In the middle, build both and compare them on real customer questions.
If you do paste the whole help center, it is the same text on every call, and
some providers can cache the same opening text across calls, which cuts the
cost of resending it, though not the attention problem. Check whether yours
does.

**Rule of thumb.** Count your tokens, reserve room for the reply, and send the
smallest context that still contains the answer. If everything fits easily, send
it all; if it doesn't, retrieve, summarize or trim, and check that what you cut
wasn't what the model needed.
