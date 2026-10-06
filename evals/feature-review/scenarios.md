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

### FR-02 — non-negotiable: a new-tab link without `rel="noreferrer"`

**Planted defect:** the new link opens github.com in a new tab
(`target="_blank"`) with no `rel="noreferrer"`, so the browser sends the
topic's URL as the `Referer` to a third party. That breaks
`docs/NON_NEGOTIABLES.md` #7. `MarkdownRenderer.test.tsx` checks only the
links markdown renders, not one a page adds, and the linter's default rules
don't flag it, so only a reviewer that reads the non-negotiables does.

History: the first FR-02 (dropping `rel="noreferrer"` in `MarkdownRenderer`)
was replaced because a test already covered it; the second (turning on
`rehype-raw`) was replaced when `check:raw-html` made it mechanical; the
third (an icon-only button with no accessible name) was rotated on
2026-10-04 when Stage 4's instruction changed, and FR-08 now plants a
NON_NEGOTIABLES #1 defect. Rotate this one if a test or lint rule ever
checks every page's external links.

**Spec:**

> Topic pages get a "Suggest an edit" link to the topic's markdown file on
> GitHub. Acceptance criteria: (1) It appears after the previous/next
> navigation on every topic page. (2) It opens the topic's file on
> github.com in a new tab. (3) Its text says it goes to GitHub.

**Diff:**

```diff
--- a/src/pages/TopicPage.tsx
+++ b/src/pages/TopicPage.tsx
@@ -72,6 +72,13 @@ export function TopicPage() {
               prev={prev && { to: `/${section.slug}/${prev.slug}`, title: prev.title }}
               next={next && { to: `/${section.slug}/${next.slug}`, title: next.title }}
             />
+            <a
+              href={`https://github.com/enbattle/til/blob/main/src/content/${topic.section}/${topic.slug}.md`}
+              target="_blank"
+              className="text-sm text-accent hover:text-accent-hover"
+            >
+              Suggest an edit on GitHub
+            </a>
           </>
         )}
       </LazyBody>
```

**Expected finding:** the link opens in a new tab without
`rel="noreferrer"`, which breaks non-negotiable #7, so at least high
severity. Naming `rel="noopener noreferrer"` as the fix passes; naming only
`noopener` (which browsers now imply) is AMBIGUOUS, since it misses the
referrer the rule is about.

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

### FR-05 — subtle: a disclosure the focus trap skips

**Planted defect:** the new "Search tips" `<summary>` is never reached by
Tab, and Tab from it (once a click has focused it) leaves the dialog, so
criterion 3 can't be met. The cause isn't in the diff, which never mentions
focus: `SearchDialog` calls `useFocusTrap(true, panelRef)`, whose keydown
handler finds the dialog's focusable elements with `FOCUSABLE_SELECTOR` in
`src/hooks/useFocusTrap.ts` (a helper `MobileNav` shares). That selector
lists `a[href]`, `button`, `input`, `select`, `textarea` and `[tabindex]`,
but not `summary`, so the trap takes the last result (or, with no results,
the input) as the last element: Tab from it wraps to the input, skipping the
summary, and Tab from a focused summary isn't caught at all. That also
breaks DESIGN.md's keyboard-reachability item, so non-negotiable #1. The
diff's test covers criteria 1 and 2 only. Nothing existing catches it: every
current test still passes (`App.test.tsx`'s Tab-trap test only checks that
focus stays inside the dialog), types check, and lint is clean.

History: until 2026-10-06, FR-05 planted a "+N more results" line that could
never render, because `searchContent(query)` caps at its default limit of 8.
Every run named it first (2026-09-24), one hop from the diff. Rotated
2026-10-06, after an edit to Stage 4's reviewer instruction, to put the cause
two calls away in another module (`SearchDialog` → `useFocusTrap` → its
keydown handler's `FOCUSABLE_SELECTOR`), which tests whether a reviewer
follows the call chain rather than reading the diff alone. It was confirmed
against the code with the diff applied: in a jsdom probe (the test setup
gives elements an `offsetParent`, so the trap runs), Tab from the input and
from the last result both landed on the input, and Tab from the focused
summary left the dialog.

**Spec:**

> The search dialog gets a short "Search tips" note, so readers can learn how
> matching works without it crowding the dialog. Acceptance criteria: (1)
> Under the key hints, a "Search tips" disclosure, closed by default, opens to
> say that a title match counts most, then a summary match, then a body
> match, and that body text is searched only once it has loaded. (2) It opens
> and closes with a click, Enter or Space. (3) Like everything else in the
> dialog, it's reachable with Tab, and Tab never leaves the dialog.

**Diff:**

```diff
--- a/src/components/SearchDialog.tsx
+++ b/src/components/SearchDialog.tsx
@@ -171,6 +171,17 @@ export function SearchDialog({ onClose }: SearchDialogProps) {
           <kbd className="rounded border border-border bg-bg-secondary px-1">Esc</kbd> to
           close · searches title, summary, and body text
         </div>
+        <details className="border-t border-border px-4 py-2 text-xs text-text-tertiary">
+          <summary className="cursor-pointer">Search tips</summary>
+          <p className="mt-1">
+            A match in a title counts most, then one in a summary, then one in the body
+            text.
+          </p>
+          <p className="mt-1">
+            Body text is searched once it has loaded; until then, only titles and
+            summaries are.
+          </p>
+        </details>
       </div>
     </div>
   );
--- a/src/components/SearchDialog.test.tsx
+++ b/src/components/SearchDialog.test.tsx
@@ -48,6 +48,16 @@ describe('SearchDialog', () => {
     expect(screen.getByText('Esc')).toBeInTheDocument();
   });

+  it('keeps the search tips in a disclosure that starts closed', async () => {
+    const user = userEvent.setup();
+    renderDialog();
+    const tips = screen.getByText('Search tips').closest('details')!;
+    expect(tips).not.toHaveAttribute('open');
+    await user.click(screen.getByText('Search tips'));
+    expect(tips).toHaveAttribute('open');
+    expect(tips).toHaveTextContent(/a match in a title counts most/i);
+  });
+
   it('closes on Escape', async () => {
     const user = userEvent.setup();
     const onClose = renderDialog();
```

**Expected finding:** criterion 3 fails: the dialog's focus trap
(`useFocusTrap`'s `FOCUSABLE_SELECTOR`) doesn't count `summary`, so Tab from
the last result or the input wraps to the input and never reaches "Search
tips", and Tab from a focused summary escapes the dialog (the fix: add
`summary` to the selector, with a test that tabs to it). Either symptom counts
if traced to the trap. High severity, since keyboard reachability is on
DESIGN.md's accessibility checklist (non-negotiable #1). A finding that
circles it without the cause (Tab order is untested, or "check that the focus
trap handles `<details>`") is AMBIGUOUS, as is one that names the cause but
only at medium severity or labels it theoretical.

---

### FR-08 — non-negotiable: a sticky strip that hides focus

**Planted defect:** from `xl` the new strip is sticky 2.5rem tall directly
under the header, but the root's `scroll-padding-top` (`src/index.css`, the
`min-width: 80rem` rule) still leaves room for the header alone. An "On this
page" jump, a `#heading` URL (`LazyBody` scrolls by the same padding through
`stickyOffset()`) and a link Tab scrolls to all land under the strip. That
fails WCAG 2.2 SC 2.4.11, an item of DESIGN.md's accessibility checklist, so
it breaks `docs/NON_NEGOTIABLES.md` #1. The spec, like the one this came
from, never mentions focus, and no test checks scroll padding against a new
sticky element.

History: added 2026-10-04 from a real escaped defect. The
`on-this-page-bar` run (docs/pipeline-log.md) shipped a sticky bar whose open
panel and height hid focused elements, fixed by `docs/specs/focus-not-obscured.md`.

**Spec:**

> On wide screens, topic pages pin a strip under the header naming the
> section and topic, so a reader deep in a long topic keeps their place.
> Acceptance criteria: (1) From 1280px wide, a strip reading
> "<section> · <title>" stays directly under the header while the page
> scrolls. (2) Below 1280px nothing changes (the On this page bar already
> sits there). (3) It's decorative and hidden from screen readers, since the
> page's heading already names the topic.

**Diff:**

```diff
--- a/src/pages/TopicPage.tsx
+++ b/src/pages/TopicPage.tsx
@@ -28,7 +28,13 @@ export function TopicPage() {
       <PageHeader
         back={{ to: `/${section.slug}`, label: section.label }}
         title={topic.title}
         meta={topic.date}
       />
+      <div
+        aria-hidden="true"
+        className="sticky top-[var(--header-height,8rem)] z-20 hidden h-10 truncate border-b border-border bg-bg-primary/95 py-2 text-sm text-text-secondary backdrop-blur xl:block"
+      >
+        {section.label} · {topic.title}
+      </div>

       {/* Keyed so moving between topics starts a fresh load instead of
```

**Expected finding:** from `xl`, the strip covers the top 2.5rem below the
header, and `scroll-padding-top` doesn't include it, so a heading an "On this
page" link jumps to and an element keyboard focus scrolls to can sit under
it (WCAG 2.4.11, non-negotiable #1). High severity. Naming the overlap only
for in-page jumps, without focus, is AMBIGUOUS.

---

### FR-04 — clean control

**Planted defect:** none. The diff is correct and complete. A review passes
if it reports nothing worth flagging, or only findings that are true of the
diff (a real polish point). It fails if it reports a defect that isn't there.

History: until 2026-10-06, FR-04 added `readingMinutes` at 200 words a
minute to `src/lib/content.ts`. It drifted once `src/lib/reading-time.ts`
landed with its own `readingMinutes` at 230 (the Writing Standard's reading
speed): the diff then duplicated a helper with a contradicting constant, and
both 2026-10-06 runs rightly flagged that as high. This version was checked
against the current code with the diff applied: `git apply --check`,
`tsc -b`, `oxlint --deny-warnings`, prettier and the whole vitest suite all
pass, the home page renders the same text as before, and no doc describes the
section page's header or lists `content.ts`'s exports.

**Spec:**

> Section pages show how many topics the section has, worded as the home
> page's section cards word it. Acceptance criteria: (1) Under a section's
> description, a line reads "<N> topics", or "1 topic" for one. (2) The home
> page and the section pages word a count the same way, from one helper. (3)
> It shows for every section, as the home page's cards do, so an empty section
> would read "0 topics" above "No topics here yet."

**Diff:**

```diff
--- a/src/lib/content.ts
+++ b/src/lib/content.ts
@@ -195,3 +195,8 @@ export function getTopic(section: string, slug: string): Topic | undefined {
 export function recentTopics(count: number): Topic[] {
   return [...TOPICS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
 }
+
+/** "1 topic" or "N topics", as the home and section pages word a count. */
+export function topicCountLabel(count: number): string {
+  return `${count} ${count === 1 ? 'topic' : 'topics'}`;
+}
--- a/src/lib/content.test.ts
+++ b/src/lib/content.test.ts
@@ -1,6 +1,12 @@
 import { describe, expect, it } from 'vitest';
 import { SECTIONS } from '@/content/registry';
-import { TOPICS, getTopic, recentTopics, topicsBySection } from './content';
+import {
+  TOPICS,
+  getTopic,
+  recentTopics,
+  topicCountLabel,
+  topicsBySection,
+} from './content';
 import { neighbours } from './neighbours';

 describe('content loader', () => {
@@ -68,3 +74,13 @@ describe('content loader', () => {
     }
   });
 });
+
+describe('topicCountLabel', () => {
+  it.each([
+    [0, '0 topics'],
+    [1, '1 topic'],
+    [2, '2 topics'],
+  ])('labels %i as "%s"', (count, label) => {
+    expect(topicCountLabel(count)).toBe(label);
+  });
+});
--- a/src/pages/HomePage.tsx
+++ b/src/pages/HomePage.tsx
@@ -1,6 +1,6 @@
 import { Link } from 'react-router-dom';
 import { SECTIONS, getSection } from '@/content/registry';
-import { TOPICS, recentTopics, topicsBySection } from '@/lib/content';
+import { TOPICS, recentTopics, topicCountLabel, topicsBySection } from '@/lib/content';
 import { TopicCard } from '@/components/TopicCard';
 // The site's one-line description; vite.config.ts fills index.html's meta tags
 // from the same field.
@@ -20,8 +20,8 @@ export function HomePage() {
           til
         </h1>
         <p className="mt-3 max-w-xl text-text-secondary">
-          {description} {totalTopics} {totalTopics === 1 ? 'topic' : 'topics'} so far,
-          grouped into sections below.
+          {description} {topicCountLabel(totalTopics)} so far, grouped into sections
+          below.
         </p>
       </section>

@@ -41,7 +41,7 @@ export function HomePage() {
                     {section.label}
                   </h3>
                   <span className="shrink-0 text-xs text-text-tertiary">
-                    {count} {count === 1 ? 'topic' : 'topics'}
+                    {topicCountLabel(count)}
                   </span>
                 </div>
                 <p className="mt-1 text-sm text-text-secondary">{section.description}</p>
--- a/src/pages/SectionPage.tsx
+++ b/src/pages/SectionPage.tsx
@@ -1,6 +1,6 @@
 import { Navigate, useParams } from 'react-router-dom';
 import { getSection } from '@/content/registry';
-import { TOPICS } from '@/lib/content';
+import { TOPICS, topicCountLabel } from '@/lib/content';
 import { TopicCard } from '@/components/TopicCard';

 export function SectionPage() {
@@ -18,6 +18,9 @@ export function SectionPage() {
           {section.label}
         </h1>
         <p className="mt-2 max-w-xl text-text-secondary">{section.description}</p>
+        <p className="mt-1 text-sm text-text-tertiary">
+          {topicCountLabel(topics.length)}
+        </p>
       </div>

       {topics.length === 0 ? (
--- a/src/App.test.tsx
+++ b/src/App.test.tsx
@@ -19,6 +19,16 @@ describe('App routing', () => {
     ).toBeInTheDocument();
   });

+  it("shows a section page's topic count under its description", () => {
+    renderAt('/ai-and-ml');
+    const group = topicsBySection().find(({ section }) => section.slug === 'ai-and-ml');
+    const count = group?.topics.length ?? 0;
+    expect(count).toBeGreaterThan(1);
+    expect(
+      within(screen.getByRole('main')).getByText(`${count} topics`),
+    ).toBeInTheDocument();
+  });
+
   it('redirects an unknown top-level path to the not-found page', () => {
     renderAt('/this-does-not-exist');
     expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
```

**Expected finding:** none. A true nit (for example, that the empty-section
case has no rendering test, since no section is empty today) is acceptable.

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
