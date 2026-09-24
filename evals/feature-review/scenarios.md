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
> `summary: "Use # for comments"` parses as `Use # for comments`.

**Diff:**

```diff
--- a/src/lib/frontmatter.ts
+++ b/src/lib/frontmatter.ts
@@ -40,7 +40,7 @@ export function parseFrontmatter(raw: string): ParsedMarkdown {
     const separator = lines[i].indexOf(':');
     if (separator === -1) continue;
     const key = lines[i].slice(0, separator).trim();
-    const value = unquote(lines[i].slice(separator + 1).trim());
+    const value = unquote(lines[i].slice(separator + 1).split('#')[0].trim());
     if (key) data[key] = value;
   }
```

**Expected finding:** the split happens on any `#`, not whitespace-then-`#`,
and before unquoting, so criteria 2 and 3 fail.

---

### FR-02 — non-negotiable: external links lose `rel="noreferrer"`

**Planted defect:** the refactor keeps `target="_blank"` but drops
`rel="noreferrer"`, violating `docs/NON_NEGOTIABLES.md` #7. The spec doesn't
mention it, so only a reviewer that reads the non-negotiables catches it.

**Spec:**

> External links in topic bodies show a small "↗" after the link text so a
> reader knows they will leave the site. Acceptance criteria: (1) An
> `https://` link renders its text followed by `↗`, and the arrow is hidden
> from screen readers. (2) Site-internal links (`/section/slug`) are
> unchanged. (3) External links still open in a new tab.

**Diff:**

```diff
--- a/src/components/MarkdownRenderer.tsx
+++ b/src/components/MarkdownRenderer.tsx
@@ -34,10 +34,16 @@ const components: Components = {
   a({ href, children }) {
     if (href?.startsWith('/')) {
       return <Link to={href}>{children}</Link>;
     }
-    return (
-      <a href={href} target="_blank" rel="noreferrer">
-        {children}
-      </a>
-    );
+    return <ExternalLink href={href}>{children}</ExternalLink>;
   },
+};
+
+function ExternalLink({ href, children }: { href?: string; children: React.ReactNode }) {
+  return (
+    <a href={href} target="_blank">
+      {children}
+      <span aria-hidden="true"> ↗</span>
+    </a>
+  );
+}
```

**Expected finding:** `rel="noreferrer"` was dropped. That breaks a
non-negotiable, so it must be reported as at least high severity.

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
@@ -1,3 +1,10 @@
+const WORDS_PER_MINUTE = 200;
+
+/** Whole minutes to read `wordCount` words, rounded up, never less than 1. */
+export function readingMinutes(wordCount: number): number {
+  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
+}
+
--- a/src/lib/content.test.ts
+++ b/src/lib/content.test.ts
@@ -1,3 +1,12 @@
+import { readingMinutes } from './content';
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
