---
title: LLM Evals
summary: An eval is a test suite for model output, scored on a fixed set of cases so you can tell whether a change helped.
date: 2026-09-14
---

Say you've built a support bot for an online shop. It answers questions about refunds, shipping and returns. Yesterday you rewrote its prompt to make the answers friendlier. Did that help, or did it quietly break something?

In ordinary code you'd run the unit tests. A **unit test** feeds in a known input and checks that the output equals a known expected value. A large language model (LLM) breaks that habit: ask it the same question twice and you can get two differently worded answers, both fine. "Does the output exactly match?" stops being a usable check.

An **eval** is the replacement. It is a fixed set of test cases, a way to score the system's output on each one, and a single number (or a few) that summarizes the scores. You run it before and after a change and compare.

## Building the test set

Where do the cases come from? Start small, with a few dozen real questions your bot should handle: "Can I return a sale item?", "My parcel says delivered but it isn't here." Then add the awkward ones: a question the policy doesn't cover, a customer who is rude, a request to ignore the rules. Each case pairs the input with whatever you'll need to judge the answer, often a reference answer or a note on what a good reply must contain.

Whenever the bot fails in production, add that exact case to the set. Over time the set becomes a record of every failure you've caught, which is the thing you most want to avoid repeating.

## Scoring the answers

Now the harder question: how do you score a free-form answer? There are three common ways, and most evals mix them.

- **Code checks.** Anything a program can verify exactly: the reply is valid JSON, it names the right refund window, it never includes a phone number. These are cheap, fast and repeatable, so use them wherever they fit.
- **Human review.** A person reads the answer and grades it. This is the most trustworthy judgment for fuzzy qualities like tone, but it is slow and expensive, so it suits a small sample rather than every run.
- **Model as judge.** A second model gets the question, the answer and a grading rubric, and returns a score. It needs no person, so it can grade every case on every run, and it covers fuzzy qualities, but it can be wrong in ways that are hard to see: some judges favor longer answers, or answers from their own model family. Check its scores against a batch of human grades before you trust it, pin the judge's model version, and re-check when you change it.

Because the bot's output varies from run to run, a single run on one case tells you little. Run the whole set, and first run the old prompt two or three times to see how far the score moves with nothing changed. A difference smaller than that is noise. With 40 cases, one case flipping is already 2.5 points.

## What to measure depends on the system

There is no universal metric, because different systems fail differently. Your support bot might read the policy documents from a search step first, which makes it a [retrieval-augmented system](/ai-and-ml/what-is-rag). That adds two separate failure points. It can retrieve the wrong document. Or it can retrieve the right one and still state something the document doesn't say. The second is a **faithfulness** failure: the answer isn't grounded in the retrieved text. Score the two separately, or a bad answer won't tell you which half to fix.

If you later let the bot issue refunds itself, it becomes an [agent](/ai-and-ml/what-are-ai-agents) that calls tools. Now an eval should check which tool it chose, and whether the final state is right (the refund went to the right order, once), not only whether the conversation sounded good. An agent can finish all its steps and still miss the goal.

## Closing the loop

Back to yesterday's friendlier prompt. Run the set on the old prompt and the new one. Suppose tone scores rise, but the cases about the refund window now fail more often: the friendlier wording has made the bot vague about dates. You'd never have caught that by reading a handful of replies, because the vague answers are spread across cases nobody happened to look at.

So you read the failures, not just the average. Group them, decide what to fix, change the prompt or the retrieval, and run the set again to confirm the fix helped. An eval run once and filed away does very little.

That makes speed matter. A set that takes a day to run gets run before big releases only; one that takes a minute gets run after every edit. Two evals can measure the same thing and still differ in usefulness, because the slow one is skipped. Keep a small fast set for everyday changes and a larger one for releases.

One caution about the set itself. If you tune the prompt until the set scores perfectly, you've fitted the bot to those cases, much as a student memorizes past exam papers. Keep some cases aside that you don't tune against, and refresh the set with new production failures.

**Rule of thumb.** Before you change a prompt, a model or a retrieval step, write down the cases that would show it went wrong, and score them the same way every time. Start with a few dozen, add every production failure to the set, and judge a change by the failures it fixes and creates, not by how its answers read.
