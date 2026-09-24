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

### FR-01 — correctness: comment stripping breaks a legitimate `#`

**Planted defect:** the diff cuts everything after the first `#`, so a value
like `C# in five minutes` becomes `C` and a quoted value containing `#` is
cut, both of which the spec explicitly keeps.

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
@@ -35,7 +35,7 @@ export function parseFrontmatter(raw: string): ParsedMarkdown {
     const separator = lines[i].indexOf(':');
     if (separator === -1) continue;
     const key = lines[i].slice(0, separator).trim();
-    const value = unquote(lines[i].slice(separator + 1).trim());
+    const value = unquote(lines[i].slice(separator + 1).split('#')[0].trim());
     if (key) data[key] = value;
   }
```

**Expected finding:** the split happens on any `#`, not whitespace-then-`#`,
and before unquoting, so criteria 2, 3 and 4 fail.

---

### FR-02 — non-negotiable: raw HTML switched on in markdown

**Planted defect:** to render `<kbd>`, the diff adds `rehype-raw`, which makes
markdown render any raw HTML, including `<script>`-free XSS vectors such as
`<img onerror>`. That violates `docs/NON_NEGOTIABLES.md` #6. No test covers
it and the spec doesn't mention it, so only a reviewer that reads the
non-negotiables catches it. (Replaced a first version of FR-02, dropping
`rel="noreferrer"`, after the 2026-09-23 baseline: an existing test already
asserts that attribute, so it didn't test reading the non-negotiables.)

**Spec:**

> Topics can show keyboard keys: `<kbd>Ctrl</kbd>+<kbd>K</kbd>` in a topic
> body renders as styled keys. Acceptance criteria: (1) `<kbd>` in a body
> renders a `<kbd>` element with the `kbd` class. (2) Existing markdown
> renders unchanged.

**Diff:**

```diff
--- a/package.json
+++ b/package.json
@@ -53,5 +53,6 @@
     "react-dom": "^19.3.0",
     "react-markdown": "^10.1.0",
     "react-router-dom": "^7.18.3",
+    "rehype-raw": "^7.0.0",
     "remark-gfm": "^4.0.1",
     "shiki": "^4.4.3"
--- a/src/components/MarkdownRenderer.tsx
+++ b/src/components/MarkdownRenderer.tsx
@@ -1,5 +1,6 @@
 import { isValidElement, type ReactNode } from 'react';
 import ReactMarkdown, { type Components } from 'react-markdown';
+import rehypeRaw from 'rehype-raw';
 import remarkGfm from 'remark-gfm';
 import { Link } from 'react-router-dom';
 import { CodeBlock } from './CodeBlock';
@@ -62,6 +63,9 @@ const components: Components = {
         {children}
       </code>
     );
   },
+  kbd({ children }) {
+    return <kbd className="kbd">{children}</kbd>;
+  },
 };
@@ -73,7 +77,11 @@ export function MarkdownRenderer({ content }: MarkdownRendererProps) {
   return (
     <div className="prose prose-neutral dark:prose-invert max-w-none">
-      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
+      <ReactMarkdown
+        remarkPlugins={[remarkGfm]}
+        rehypePlugins={[rehypeRaw]}
+        components={components}
+      >
         {content}
       </ReactMarkdown>
     </div>
```

**Expected finding:** `rehype-raw` turns on raw HTML for every topic, which
breaks non-negotiable #6 (an XSS surface), so at least high severity; a good
review suggests an allowlist (`rehype-sanitize` permitting `kbd`) or a
markdown-level syntax instead. The diff also omits the `package-lock.json`
hunk (left out for length) and, applied for real, pushes the markdown chunk
past its 95 kB budget; a review reporting either is correct, but PASS still
requires the #6 finding.

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
@@ -48,7 +48,12 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
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

**Expected finding:** the stale closure: `query` is missing from the
dependency list, so the handler always sees `''`.

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
@@ -157,4 +157,12 @@ export function recentTopics(count: number): Topic[] {
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
@@ -6,6 +6,7 @@ import {
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
