# Feature-review scenarios

Each scenario is a short spec and a diff against this repository's real code,
exactly as `/feature`'s Stage 4 reviewer would receive them, with **exactly
one** deliberately planted defect, or none for the control. The diffs are
fixtures for this eval only: never apply them to the working tree. See
`HOW_TO_RUN.md` for the procedure and grading, and `../README.md` for the
general eval philosophy.

The planted defects are the kind a hurried implementer ships and a
rubber-stamp review waves through: a subtle correctness bug, a quiet
violation of `docs/NON_NEGOTIABLES.md`, a React stale closure. **When
Stage 4's reviewer instruction is edited, rotate at least one scenario's
planted defect** (same file, different bug), so the instruction can't drift
toward the specific bugs listed here.

---

### FR-01 — correctness: inline comments break single-quoted values

**Planted defect:** the diff skips comment stripping only for a
double-quoted value, so a single-quoted value containing ` #` is cut:
`summary: 'Use # for comments'` becomes `'Use` (the closing quote goes with
the comment, so `unquote` no longer strips the opening one). The spec's rule
is that a `#` inside _a quoted value_ is kept, and criterion 3's example
passes only because it uses double quotes. The realistic trigger is this
repo's own convention: every quoted value under `src/content/` today (six
titles) uses single quotes, and none uses double quotes, so the next author
who quotes a value containing ` #` hits it. No current content does, which
is what makes it a test of the "theoretical" label: a reviewer that names
the bug but calls it theoretical or low grades FAIL.

History: the first FR-01 cut at any `#` (`split('#')`), which broke three of
the spec's four examples and was always the top finding. It was rotated on
2026-09-29, when Stage 4 gained the realistic-trigger and "theoretical"
wording, to a bug whose trigger the spec doesn't spell out.

Known flaw, to fix at the next rotation: this diff has two more real
defects than the one planted, both found in its first run (2026-09-29). A
quoted value that contains ` #` and has a trailing comment
(`"Use # for comments" # draft`) is cut at the inner `#`, and a
double-quoted value containing its own `"` no longer matches the guard.
Findings naming either are true of the diff, so they don't count against a
reviewer, but the scenario no longer has exactly one defect.

**Spec:**

> Frontmatter values may end with an inline comment: whitespace, then `#`,
> then anything, which is stripped before the value is used. Acceptance
> criteria: (1) `title: Caching # draft` parses as `Caching`. (2) A `#` not
> preceded by whitespace is part of the value: `title: C# in five minutes`
> parses unchanged. (3) A `#` inside a quoted value is kept:
> `summary: "Use # for comments"` parses as `Use # for comments`. (4) A
> value that starts with `#` keeps it: `title: #1 tip` parses as `#1 tip`.

**Diff:**

```diff
--- a/src/lib/frontmatter.ts
+++ b/src/lib/frontmatter.ts
@@ -16,4 +16,6 @@ const DELIMITER = '---';
  * (e.g. a summary like "Note: do X") still parses correctly. A value can
  * optionally be wrapped in matching single or double quotes (handy when it
- * ends with punctuation that could be misread), which are stripped.
+ * ends with punctuation that could be misread), which are stripped. A
+ * trailing inline comment (whitespace, then `#`, then anything) is dropped
+ * unless the value is quoted.
  */
@@ -37,3 +39,4 @@ export function parseFrontmatter(raw: string): ParsedMarkdown {
     const key = lines[i].slice(0, separator).trim();
-    const value = unquote(lines[i].slice(separator + 1).trim());
+    const rawValue = lines[i].slice(separator + 1).trim();
+    const value = unquote(/^"[^"]*"$/.test(rawValue) ? rawValue : stripComment(rawValue));
     if (key) data[key] = value;
@@ -58,3 +61,8 @@ function unquote(value: string): string {
       (value.startsWith("'") && value.endsWith("'")));
   return isQuoted ? value.slice(1, -1) : value;
 }
+
+/** Drops a trailing inline comment: whitespace, then `#`, then anything. */
+function stripComment(value: string): string {
+  return value.replace(/\s+#.*$/, '');
+}
```

**Expected finding:** a single-quoted value keeps no `#`: the quoted-value
exemption tests only for double quotes, so `'Use # for comments'` is cut to
`'Use`, breaking the spec's rule for quoted values (and the new docstring's
"unless the value is quoted"), with this repo's single-quote convention as
the trigger. Medium severity or higher, and not labelled theoretical. Naming
only a missing single-quote test, without the wrong output, is AMBIGUOUS.

---

### FR-02 — non-negotiable: an icon-only button with no accessible name

**Planted defect:** the new button's only content is a decorative arrow
(`aria-hidden`), and it has no `aria-label` or visible text, so a screen
reader announces an unnamed "button". That breaks `docs/NON_NEGOTIABLES.md`
#1 (DESIGN.md's accessibility checklist). No test or `check:*` script
catches it (the linter has no accessibility rules), so only a reviewer that
reads the non-negotiables does.

History: the first FR-02 (dropping `rel="noreferrer"`) was replaced because
a test already covered it; the second (turning on `rehype-raw`) was
replaced when `check:raw-html` made it mechanical. Rotate this one the same
way if a check ever starts catching unnamed buttons.

**Spec:**

> Long topic pages get a "back to top" control at the end of the article.
> Acceptance criteria: (1) It appears after the previous/next navigation on
> every topic page. (2) Activating it scrolls the window to the top. (3) It
> is keyboard-operable.

**Diff:**

```diff
--- a/src/pages/TopicPage.tsx
+++ b/src/pages/TopicPage.tsx
@@ -84,6 +84,13 @@ export function TopicPage() {
                 )}
               </nav>
             )}
+            <button
+              type="button"
+              onClick={() => window.scrollTo({ top: 0 })}
+              className="mt-8 rounded-full border border-border p-2 text-text-secondary hover:text-accent"
+            >
+              <span aria-hidden="true">↑</span>
+            </button>
           </>
         )}
       </LazyBody>
```

**Expected finding:** the button has no accessible name (the arrow is
`aria-hidden`, and there is no `aria-label`), which breaks non-negotiable
#1, so at least high severity.

---

### FR-03 — React stale closure: the first Escape always closes

**Planted defect:** the keydown handler reads `query`, but the effect's
dependency list is still `[onClose]`, so the handler keeps the `query` from
the first render (`''`) and the first Escape always closes the dialog,
failing criterion 1.

**Spec:**

> In the search dialog, Escape with a non-empty query clears the query and
> keeps the dialog open; Escape with an empty query closes it. Acceptance
> criteria: (1) Type "cache", press Escape: the input is empty and the
> dialog is still open. (2) Press Escape again: the dialog closes. (3)
> Escape on an empty query closes the dialog immediately.

**Diff:**

```diff
--- a/src/components/SearchDialog.tsx
+++ b/src/components/SearchDialog.tsx
@@ -74,7 +74,12 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
   useEffect(() => {
     function onKeyDown(event: KeyboardEvent) {
-      if (event.key === 'Escape') onClose();
+      if (event.key !== 'Escape') return;
+      if (query) {
+        setQuery('');
+        return;
+      }
+      onClose();
     }
     window.addEventListener('keydown', onKeyDown);
     return () => window.removeEventListener('keydown', onKeyDown);
   }, [onClose]);
```

Watch: oxlint's `exhaustive-deps` rule already warns about the missing
`query` but exits 0. If that rule is ever made an error, `verify` catches this
mechanically and the scenario must be rotated.

**Expected finding:** the stale closure: `query` is missing from the
dependency list, so the handler always sees `''`.

---

### FR-05 — subtle: a count that can never be positive

**Planted defect:** `searchContent(query)` already caps results at its
default limit of 8, so `results.length - 8` is never positive and the "+N
more" line never renders: criterion 2 can't be met. The diff also adds no
test for criterion 2, which is how it slipped through. Nothing existing
catches it: every current test still passes, types check, and lint is clean.
This scenario exists because every planted defect in FR-01..03 was each
review's top finding (the 2026-09-23 and 2026-09-24 runs), so the eval
couldn't tell a strong reviewer from a merely adequate one; this defect is
quiet, spec-level, and sits next to correct-looking code.

Result so far: on 2026-09-24 all three runs still named it first, one hop
from the diff (`searchContent`'s default limit). It stays as a regression
check; the next rotation should put the cause several hops away (a limit
set in another module, or a default changed in a shared helper) to test
whether a reviewer follows the call chain.

**Spec:**

> When a search matches more topics than the dialog shows, say so.
> Acceptance criteria: (1) The dialog lists at most 8 results, as today.
> (2) When more than 8 results match, a line under the list reads "+N more
> results — refine your search", where N is the number not shown. (3) With 8
> or fewer matches, no such line appears.

**Diff:**

```diff
--- a/src/components/SearchDialog.tsx
+++ b/src/components/SearchDialog.tsx
@@ -52,2 +52,4 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
   const results = searchContent(query);
+  const SHOWN = 8;
+  const hidden = Math.max(0, results.length - SHOWN);

@@ -155,3 +157,8 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
           })}
         </ul>
+        {hidden > 0 && (
+          <p className="px-4 pb-2 text-xs text-text-tertiary">
+            +{hidden} more results — refine your search
+          </p>
+        )}
         <div className="border-t border-border px-4 py-2 text-xs text-text-tertiary">
```

**Expected finding:** criterion 2 can never be met, because `searchContent`
is called with its default limit of 8, so `results.length` never exceeds 8
and `hidden` is always 0 (the fix: ask for more results, e.g.
`searchContent(query, Infinity)`, and slice to 8 for display). Medium
severity or higher. A finding that only notes the missing test, without
seeing that the feature can't work, is AMBIGUOUS.

---

### FR-04 — clean control

**Planted defect:** none. The diff is correct and complete. A review passes
if it reports nothing worth flagging, or only findings that are true of the
diff (a real polish point). It fails if it reports a defect that isn't there.

**Spec:**

> Add `readingMinutes(wordCount: number): number` to `src/lib/content.ts`:
> whole minutes at 200 words per minute, rounded up, with a minimum of 1.
> Acceptance criteria: (1) 0 words → 1. (2) 200 words → 1. (3) 201 words
> → 2. (4) 1000 words → 5.

**Diff:**

```diff
--- a/src/lib/content.ts
+++ b/src/lib/content.ts
@@ -159,3 +159,10 @@ export function recentTopics(count: number): Topic[] {
 export function recentTopics(count: number): Topic[] {
   return [...TOPICS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
 }
+
+const WORDS_PER_MINUTE = 200;
+
+/** Whole minutes to read `wordCount` words, rounded up, never less than 1. */
+export function readingMinutes(wordCount: number): number {
+  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
+}
--- a/src/lib/content.test.ts
+++ b/src/lib/content.test.ts
@@ -6,5 +6,6 @@ import {
   loadAllTopicBodies,
   recentTopics,
+  readingMinutes,
   sectionNeighbors,
   topicsBySection,
 } from './content';
@@ -76,3 +77,14 @@ describe('content loader', () => {
     }
   });
 });
+
+describe('readingMinutes', () => {
+  it.each([
+    [0, 1],
+    [200, 1],
+    [201, 2],
+    [1000, 5],
+  ])('%i words take %i minute(s)', (words, minutes) => {
+    expect(readingMinutes(words)).toBe(minutes);
+  });
+});
```

**Expected finding:** none. A true nit (for example, import placement) is
acceptable.

---

## Triage scenarios

These test Stage 4's finding triage, not the reviewer: each gives the triager
a spec, a diff and one review finding (procedure in `HOW_TO_RUN.md`).

### FR-06 — triage: a reachable finding

**Spec:**

> Add `firstSentence(text)` to `src/lib/content.ts` for the topic page's meta
> description: the text up to and including the first sentence's period.
> Criteria: (1) `One. Two.` → `One.` (2) Text with no period is unchanged.

**Diff:**

```diff
--- a/src/lib/content.ts
+++ b/src/lib/content.ts
@@ -159,3 +159,9 @@ export function recentTopics(count: number): Topic[] {
 export function recentTopics(count: number): Topic[] {
   return [...TOPICS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
 }
+
+/** A summary's first sentence, for the page's meta description. */
+export function firstSentence(text: string): string {
+  const end = text.indexOf('. ');
+  return end === -1 ? text : text.slice(0, end + 1);
+}
```

**Finding:** "Medium: `firstSentence` ends a sentence at any `. `, so an
abbreviation such as `vs.` cuts the summary short. Possibly theoretical if no
summary uses one."

**Expected outcome:** Fix with a test. Three real summaries contain `vs. `
(`git-rebase-vs-merge.md`, `optimistic-vs-pessimistic-locking.md`,
`partitioning-vs-sharding.md`); the first becomes "What each actually does to
history, which to use on a private branch vs." FAIL if labelled theoretical,
Known limitation or Reject.

### FR-07 — triage: a theoretical finding

**Spec:**

> Add a test that fails when a topic's or case study's summary has a second
> sentence (`.`, `?` or `!`, whitespace, then a capital letter). Criteria:
> (1) Every current summary passes. (2) `One thing. Another.` fails.

**Diff:**

```diff
--- a/src/lib/content.test.ts
+++ b/src/lib/content.test.ts
@@ -1,3 +1,4 @@
 import { describe, expect, it } from 'vitest';
 import { SECTIONS } from '@/content/registry';
-import { getTopic, recentTopics, sectionNeighbors, topicsBySection } from './content';
+import { getTopic, recentTopics, sectionNeighbors, TOPICS, topicsBySection } from './content';
+import { CASE_STUDIES } from './system-design';
@@ -51,1 +52,9 @@ describe('content loader', () => {
 });
+
+describe('summaries', () => {
+  it.each([...TOPICS, ...CASE_STUDIES].map((item) => [item.title, item.summary]))(
+    '%s has a one-sentence summary',
+    (_title, summary) => expect(summary).not.toMatch(/[.?!]\s+[A-Z]/),
+  );
+});
```

**Finding:** "Medium: `[A-Z]` is ASCII-only, so a second sentence that starts
with an accented capital (`Émile…`) passes the check."

**Expected outcome:** Known limitation (Reject only if it's disproved). The
finding is true, but every summary is English, none has a second sentence,
and no doc describes that shape. FAIL if escalated to Fix with a test.
