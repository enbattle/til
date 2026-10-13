import { describe, expect, it } from 'vitest';
import { RAW_CASE_STUDIES, RAW_DSA_ENTRIES, RAW_TOPICS } from '@/test/content';
import { TOPICS } from './content';
import { DSA_ENTRIES } from './dsa';
import { parseFrontmatter } from './frontmatter';
import { proseWordCount } from './markdown.mjs';
import { CASE_STUDIES } from './system-design';

// docs/specs/five-minute-templates.md, criterion 3: the build-time `?words`
// view (a `MARKDOWN_VIEWS` entry in vite.config.ts, which Vitest reuses)
// resolves to `proseWordCount` of the file's body without its frontmatter.
// This file imports the view directly, and also checks the loaders' `words`
// field against it (the last describe).

const CASE_STUDY_WORDS = import.meta.glob<number>(
  '/src/system-design/case-studies/*.md',
  {
    query: '?words',
    import: 'default',
    eager: true,
  },
);
const DSA_WORDS = import.meta.glob<number>('/src/dsa/entries/*.md', {
  query: '?words',
  import: 'default',
  eager: true,
});
const TOPIC_WORDS = import.meta.glob<number>('/src/content/**/*.md', {
  query: '?words',
  import: 'default',
  eager: true,
});

describe('the ?words view (five-minute criterion 3)', () => {
  it.each([
    ['a real case study', CASE_STUDY_WORDS, RAW_CASE_STUDIES, 'url-shortener.md'],
    ['a real DSA entry', DSA_WORDS, RAW_DSA_ENTRIES, 'binary-search.md'],
  ])(
    'gives %s the counter’s number for its body without frontmatter',
    (_, views, raws, file) => {
      const path = Object.keys(raws).find((p) => p.endsWith(`/${file}`))!;
      expect(path).toBeDefined();
      const expected = proseWordCount(parseFrontmatter(raws[path]).content);
      expect(expected).toBeGreaterThan(0);
      expect(views[path]).toBe(expected);
    },
  );

  it.each([
    ['case study', CASE_STUDY_WORDS, RAW_CASE_STUDIES],
    ['DSA entry', DSA_WORDS, RAW_DSA_ENTRIES],
  ])('covers every %s file, each with its body’s count', (_, views, raws) => {
    expect(Object.keys(views).sort()).toEqual(Object.keys(raws).sort());
    for (const [path, raw] of Object.entries(raws)) {
      expect(views[path], path).toBe(proseWordCount(parseFrontmatter(raw).content));
    }
  });

  it('does not count the frontmatter', () => {
    const [path, raw] = Object.entries(RAW_CASE_STUDIES)[0];
    expect(CASE_STUDY_WORDS[path]).toBeLessThan(proseWordCount(raw));
  });
});

// docs/specs/content-dedupe.md, criterion 2: `words` is set by createCollection
// from the `?words` view instead of by a wrapper in each loader, and every item
// still carries its own file's count. (This replaces the per-loader words tests
// in content-loading.test.ts, system-design.test.ts and dsa.test.ts.)
describe('the loaded items carry their file’s ?words count (content-dedupe criterion 2)', () => {
  it.each([
    [
      'topic',
      TOPICS.map((t) => [`/src/content/${t.section}/${t.slug}.md`, t.words] as const),
      TOPIC_WORDS,
    ],
    [
      'case study',
      CASE_STUDIES.map(
        (c) => [`/src/system-design/case-studies/${c.slug}.md`, c.words] as const,
      ),
      CASE_STUDY_WORDS,
    ],
    [
      'DSA entry',
      DSA_ENTRIES.map((e) => [`/src/dsa/entries/${e.slug}.md`, e.words] as const),
      DSA_WORDS,
    ],
  ])('every %s, one per file, with a positive integer count', (_, items, views) => {
    expect(items.map(([path]) => path).sort()).toEqual(Object.keys(views).sort());
    for (const [path, words] of items) {
      expect(Number.isInteger(words), path).toBe(true);
      expect(words, path).toBeGreaterThan(0);
      expect(words, path).toBe(views[path]);
    }
  });

  it('gives topics the counter’s number for each body without frontmatter', () => {
    expect(Object.keys(TOPIC_WORDS).sort()).toEqual(Object.keys(RAW_TOPICS).sort());
    for (const [path, raw] of Object.entries(RAW_TOPICS)) {
      expect(TOPIC_WORDS[path], path).toBe(proseWordCount(parseFrontmatter(raw).content));
    }
  });
});
