---
title: Tokenization
summary: A language model reads and writes numbered chunks of text called tokens, not letters or words, which explains its trouble with spelling and digits and why some text costs more.
date: 2026-09-14
---

Suppose you build a support assistant on top of a language model, and a customer writes: "My order 1234567 hasn't arrived." You see letters and words. The model sees neither. Before it does anything, a program called a **tokenizer** cuts the text into chunks called **tokens** and replaces each chunk with an integer ID. The model takes in a list of IDs and produces a list of IDs, which the tokenizer turns back into text. Everything odd about how models handle spelling, numbers and cost follows from that cutting step.

## Where do the chunks come from?

Why not just use one token per letter, or one per word? Letters make every message very long, and a model has a limited [context window](/ai-and-ml/context-window), so less fits, and every token costs compute. Whole words need an enormous vocabulary, and the first misspelling or new product name would have no entry. Chunks in between work better, and the most common method for finding them is **byte-pair encoding (BPE)**.

Start with a vocabulary of single characters (or single bytes, the units a computer stores text in). Scan a huge body of training text, find the pair of neighbouring symbols that occurs most often, and add that pair to the vocabulary as one new symbol. Repeat until the vocabulary hits a target size, often tens of thousands to a few hundred thousand entries.

```
Start:    t  h  e     (three symbols)
Round 1:  "t"+"h" is very common, so add "th"      ->  th  e
Round 2:  "th"+"e" is very common, so add "the"     ->  the
```

Nobody wrote a dictionary. Frequency decided, so common words such as "the" end up as a single token, rarer words split into several pieces, and a string the tokenizer has never seen can still be spelled out from smaller pieces. When the base symbols are bytes, any text at all can be represented, which is why many tokenizers start there.

## What does the model see in the customer's message?

The exact split depends on the tokenizer, but a tokenizer might turn "hasn't arrived" into something like ` has`, `n`, `'t`, ` arrived`. Notice that the space attaches to the front of the word, so "arrived" and " arrived" are different tokens with different IDs. That is why stray or doubled spaces can change what the model sees.

A tokenizer might cut `1234567` into `123`, `456`, `7`. Only the pieces exist for the model; the digits inside them are never presented as separate units. A human doing arithmetic lines up ones, tens and hundreds. If the cut falls differently for `1234567` and `98765`, the pieces don't line up, and the model has to infer place value from patterns it learned. This is one reason models make arithmetic mistakes on long numbers, and why having them write out steps, or hand the sum to a calculator tool, helps.

The same thing explains the famous failure of asking a model how many times "r" appears in "strawberry". If a tokenizer splits that word into two or three chunks, the model has no letter-level view of them. It answers from what it learned about how the word is spelled, and that can go wrong. Asking it to spell the word out one letter per line first usually helps, because the letters then become tokens of their own.

Code has a version of this. Four spaces and a tab can look identical in an editor but tokenize differently, so a model sometimes mixes the two when it edits indented code.

## Why does the same message cost more in some languages?

Your assistant is billed per token, so the next question is how many tokens a message takes. That depends on what the training text for the tokenizer looked like. A vocabulary built mostly from English will have single tokens for many English words. Text in a language or script that was rare in that data gets cut into many more, shorter pieces. The same sentence translated can take noticeably more tokens, sometimes several times as many. Your bill for those customers grows, and less of their conversation fits in the context window, and nothing about the content explains it.

Wording matters too, since filler is billed like everything else. "Please carefully analyze the following passage and provide a comprehensive summary of its key points" is longer than "Summarize the key points of this passage" and asks for the same thing. A system prompt sent on every call multiplies that difference.

You don't have to guess the counts. Most model providers publish a tokenizer or a counting function, and different models often use different ones, so a count from one tokenizer won't match another. Measure with the tokenizer for the model you actually call.

**Rule of thumb.** Treat tokens as the model's unit of reading, and expect trouble wherever a task depends on what is inside a token, such as letters, digits or exact whitespace. When it matters, restructure the task (spell it out, use a tool) and count cost with the tokenizer of the model you use.
