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
@@ -128,6 +128,14 @@ export function TopicPage() {
           </nav>
         )}
       </TopicBody>
+      <button
+        type="button"
+        onClick={() => window.scrollTo({ top: 0 })}
+        className="mt-8 rounded-full border border-border p-2 text-text-secondary hover:text-accent"
+      >
+        <span aria-hidden="true">↑</span>
+      </button>
     </article>
   );
 }
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
