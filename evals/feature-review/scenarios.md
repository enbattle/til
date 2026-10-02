# Feature-review scenarios

Each scenario is a short spec and a diff against this repository's real code,
exactly as `/feature`'s Stage 4 reviewer would receive them, with **exactly
one** deliberately planted defect, or none for the control. The diffs are
fixtures for this eval only: never apply them to the working tree. The
`feature-review-eval` skill has the procedure and grading, and `../README.md`
the general eval philosophy.

The planted defects are the kind a hurried implementer ships and a
rubber-stamp review waves through: a subtle correctness bug, a quiet
violation of `docs/NON_NEGOTIABLES.md`, a React stale closure. **When
Stage 4's reviewer instruction is edited, rotate at least one scenario's
planted defect** (same file, different bug), so the instruction can't drift
toward the specific bugs listed here.

---

### FR-01 — correctness: a quoted value with a trailing comment

**Planted defect:** comment stripping is skipped for any quoted value, but a
quoted value followed by a comment no longer looks quoted, so it is stripped
from the first ` #`, which is inside the quotes:
`summary: 'Use # for comments' # draft` parses as `'Use` (and the opening
quote stays, since `unquote` no longer sees a closing one). Criteria 1 and 3
together say the result should be `Use # for comments`; each criterion's own
example passes, so only a reviewer that combines them finds it. The trigger
is realistic: the spec adds comments to frontmatter, and this repo quotes
values (eight titles under `src/content/` are single-quoted), so an author
annotating a quoted value hits it.

History: the first FR-01 cut at any `#` (`split('#')`), which broke three of
the spec's four examples and was always the top finding. The second (rotated
2026-09-29) exempted only double-quoted values, and its guard had two more
real defects than the planted one. This third version (rotated 2026-10-01)
checks both quote types correctly, so the planted defect is the only one.

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
@@ -16,5 +16,7 @@ export interface ParsedMarkdown {
  * (e.g. a summary like "Note: do X") still parses correctly. A value can
  * optionally be wrapped in matching single or double quotes (handy when it
- * ends with punctuation that could be misread), which are stripped.
+ * ends with punctuation that could be misread), which are stripped. A
+ * trailing inline comment (whitespace, then `#`, then anything) is dropped
+ * unless the value is quoted.
  */
 export function parseFrontmatter(raw: string): ParsedMarkdown {
@@ -36,5 +38,7 @@ export function parseFrontmatter(raw: string): ParsedMarkdown {
     if (separator === -1) continue;
     const key = lines[i].slice(0, separator).trim();
-    const value = unquote(lines[i].slice(separator + 1).trim());
+    const rawValue = lines[i].slice(separator + 1).trim();
+    const isQuoted = /^(['"]).*\1$/.test(rawValue);
+    const value = unquote(isQuoted ? rawValue : stripComment(rawValue));
     if (key) data[key] = value;
   }
@@ -59,2 +63,7 @@ function unquote(value: string): string {
   return isQuoted ? value.slice(1, -1) : value;
 }
+
+/** Drops a trailing inline comment: whitespace, then `#`, then anything. */
+function stripComment(value: string): string {
+  return value.replace(/\s+#.*$/, '');
+}
```

**Expected finding:** a quoted value followed by a comment is cut at the `#`
inside its quotes (`'Use # for comments' # draft` → `'Use`), because
`isQuoted` tests the whole raw value, comment included, and
`stripComment` then removes from the first ` #`. The same cause has a mirror
symptom, which also counts: a comment that ends in a quote
(`"Caching" # was "Cache"`) makes the whole raw value look quoted, so the
comment is kept as part of it. Medium severity or higher. A reviewer that names it but labels it theoretical grades AMBIGUOUS,
since no doc yet says authors comment quoted values.

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
@@ -68,6 +68,13 @@ export function TopicPage() {
               prev={prev && { to: `/${section.slug}/${prev.slug}`, title: prev.title }}
               next={next && { to: `/${section.slug}/${next.slug}`, title: next.title }}
             />
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

**Planted defect:** the keydown handler reads the query from `queryRef`, a
ref set to the first render's query (`''`) and never updated, so the first
Escape always closes the dialog, failing criterion 1. Lint can't see it:
`exhaustive-deps` doesn't track a ref's `.current`.

History: the first FR-03 left `query` out of the effect's dependency list.
Once `npm run lint` ran with `--deny-warnings` (2026-10-01), `exhaustive-deps`
caught that mechanically, so it was rotated to this ref, which lint can't
check.

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
@@ -49,6 +49,8 @@ interface SearchDialogProps {
  * time means the query naturally starts empty, with no reset-on-open effect. */
 export function SearchDialog({ onClose }: SearchDialogProps) {
   const [query, setQuery] = useState('');
+  // Read by the keydown handler, which is registered once.
+  const queryRef = useRef(query);
   const inputRef = useRef<HTMLInputElement>(null);
   const panelRef = useRef<HTMLDivElement>(null);
   const navigate = useNavigate();
@@ -84,7 +86,12 @@ export function SearchDialog({ onClose }: SearchDialogProps) {

   useEffect(() => {
     function onKeyDown(event: KeyboardEvent) {
-      if (event.key === 'Escape') onClose();
+      if (event.key !== 'Escape') return;
+      if (queryRef.current) {
+        setQuery('');
+        return;
+      }
+      onClose();
     }
     window.addEventListener('keydown', onKeyDown);
     return () => window.removeEventListener('keydown', onKeyDown);
```

**Expected finding:** the stale ref: `queryRef.current` is never updated
after the first render, so the handler always sees `''` and the first Escape
closes the dialog.

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
@@ -61,6 +61,8 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
   // arrive the same query has to start matching them, and the state change
   // above is what triggers this re-render. The index is small, so it's cheap.
   const results = searchContent(query);
+  const SHOWN = 8;
+  const hidden = Math.max(0, results.length - SHOWN);

   // Called before the autofocus effect below (hook order = call order), so
   // it captures whatever had focus before the dialog opened, not the input
@@ -165,6 +167,11 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
             );
           })}
         </ul>
+        {hidden > 0 && (
+          <p className="px-4 pb-2 text-xs text-text-tertiary">
+            +{hidden} more results — refine your search
+          </p>
+        )}
         <div className="border-t border-border px-4 py-2 text-xs text-text-tertiary">
           <kbd className="rounded border border-border bg-bg-secondary px-1">Enter</kbd>{' '}
           opens the first result ·{' '}
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
@@ -195,3 +195,10 @@ export function getTopic(section: string, slug: string): Topic | undefined {
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
@@ -1,4 +1,10 @@
 import { describe, expect, it } from 'vitest';
 import { SECTIONS } from '@/content/registry';
-import { TOPICS, getTopic, recentTopics, topicsBySection } from './content';
+import {
+  TOPICS,
+  getTopic,
+  readingMinutes,
+  recentTopics,
+  topicsBySection,
+} from './content';
 import { neighbours } from './neighbours';
@@ -68,3 +74,14 @@ describe('content loader', () => {
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
a spec, a diff and one review finding (procedure in the skill's Stage 1).

### FR-06 — triage: a reachable finding

**Spec:**

> Add `firstSentence(text)` to `src/lib/content.ts` for the topic page's meta
> description: the text up to and including the first sentence's period.
> Criteria: (1) `One. Two.` → `One.` (2) Text with no period is unchanged.

**Diff:**

```diff
--- a/src/lib/content.ts
+++ b/src/lib/content.ts
@@ -195,3 +195,9 @@ export function getTopic(section: string, slug: string): Topic | undefined {
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
@@ -2,6 +2,7 @@ import { describe, expect, it } from 'vitest';
 import { SECTIONS } from '@/content/registry';
 import { TOPICS, getTopic, recentTopics, topicsBySection } from './content';
 import { neighbours } from './neighbours';
+import { CASE_STUDIES } from './system-design';

 describe('content loader', () => {
   it('finds a known topic by section and slug', () => {
@@ -68,3 +69,10 @@ describe('content loader', () => {
     }
   });
 });
+
+describe('summaries', () => {
+  it.each([...TOPICS, ...CASE_STUDIES].map((item) => [item.title, item.summary]))(
+    '%s has a one-sentence summary',
+    (_title, summary) => expect(summary).not.toMatch(/[.?!]\s+[A-Z]/),
+  );
+});
```

**Finding:** "Medium: if an item has no `summary`, `expect(summary)` gets
`undefined` and `toMatch` throws a TypeError, so the test errors instead of
failing with a message that names the item."

**Expected outcome:** Known limitation or Reject. The mechanism is true
(`toMatch` on `undefined` throws a TypeError), but no input can reach it:
`content.ts` and `system-design.ts` throw at load time when `summary` is
missing, so every item the test iterates has one. Known limitation fits
"true but theoretical"; Reject fits "the loader makes it impossible". FAIL if
escalated to Fix with a test.

History: until 2026-10-01 the finding was "`[A-Z]` is ASCII-only, so a second
sentence starting with an accented capital passes". Its two runs that day
split, fairly: no doc limits summaries to ASCII, and the fix is one regex, so
it wasn't theoretical on every reading. This finding is unreachable by
construction.
