---
title: Planning Before Building
summary: A one-page written plan, reviewed before coding starts, is the cheapest place to find out an approach is wrong.
date: 2026-09-13
---

Your product manager asks for an "Export my data" button. You could open an editor and start. A reasonable first guess is a button that runs a database query and streams the result as a CSV file. By Friday you have it working, and on Monday someone mentions that one customer has eleven million rows. The request would time out, and your approach has to change after a week of work.

Teams that build reliably do something less obvious first. For anything bigger than a small fix, they write down the problem and the proposed approach in plain language, and they get it read before they write code. Why does that help? Because code is an expensive way to ask "does this make sense?" A page of prose takes an hour to write and a few minutes to read. Finding the same flaw by building takes days.

## What goes on the page

Companies give this document different names: a **design doc**, an **RFC** (Request for Comments), and its product-side cousin, the **PRD** (Product Requirements Document), states what to build rather than how. A short design doc usually answers five questions, and here is how each looks for the export button.

1. **What problem are we solving, and for whom?** "Customers who leave need their data, and support spends hours a week pulling it by hand." That is different from "build an export button," and it tells a reviewer what success means.
2. **What is the proposed approach?** In prose and rough diagrams, not code: a click queues an export job, a background worker writes the file, and the user gets an email with a download link. The queue is a [message queue](/systems-and-infrastructure/message-queues), the same idea of handing work to a separate worker so the request doesn't wait.
3. **What are the alternatives, and why not those?** Streaming the file straight from the request is simpler and is what you first imagined. It loses because large accounts would time out. Naming the road not taken is what makes the decision deliberate instead of arbitrary.
4. **What is out of scope?** "No PDF export, no scheduled exports." This stops a small feature from quietly growing.

5. **How will we know it works?** "Export the largest account in staging and time it." The [testing pyramid](/engineering-practices/testing-pyramid) helps decide which checks to plan for.

Keep it short on purpose: long enough to think clearly, short enough that a teammate reads all of it. Some teams decide in writing as a matter of course: a narrative memo of a few pages, read silently at the start of the meeting, replaces slides.

## Get it read before you build

A plan nobody reads has done only half its job. You send the doc to a teammate, a tech lead, and anyone the change affects. Someone on the data team writes back, "We cap every query at thirty seconds, so the worker's single query over eleven million rows will hit that too. Page through the rows in batches and write the file to object storage." That comment costs five minutes now. It would cost a week if it arrived after the worker was built.

Once the team agrees, resist the urge to build every layer to completion before connecting them. Build a **thin vertical slice** first: the smallest version that works end to end, such as a button that exports one small account through the queue and the email. It proves the shape of the approach while changing it is still cheap, and it gives people something real to react to instead of a document.

## Record why, not just what

After the decision, some teams write a short **ADR** (Architecture Decision Record): a few paragraphs, kept in the repository next to the code, saying what was decided and why. Months later someone asks why exports go through a queue when a direct download would be simpler. A commit message says what changed. The ADR says why, including the option that looked better and lost.

Smaller calls can go in a lightweight **decision log**, a running table of decision, date, reason and alternatives considered. It gives a call a written reason without a full document. Choices that trade speed now for cost later are worth logging too, since they are how [technical debt](/engineering-practices/technical-debt-vs-time-to-market) gets taken on deliberately rather than by accident.

## When to skip it

You would not write a design doc to fix a typo on the export page. For a well-understood, low-risk change, the doc costs more than it saves. The judgment is proportional: the less certain the approach, the costlier it is to reverse, and the more people it touches, the more a written plan is worth.

**Rule of thumb.** If a wrong approach would cost more than a day to undo, spend an hour writing the plan and have someone else read it before you build.
