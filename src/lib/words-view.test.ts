import { describe, expect, it } from 'vitest';
import { RAW_CASE_STUDIES, RAW_DSA_ENTRIES } from '@/test/content';
import { parseFrontmatter } from './frontmatter';
import { proseWordCount } from './markdown.mjs';

// docs/specs/five-minute-templates.md, criterion 3: the build-time `?words`
// view (a `MARKDOWN_VIEWS` entry in vite.config.ts, which Vitest reuses)
// resolves to `proseWordCount` of the file's body without its frontmatter.
// This file imports the view directly, so it fails as a whole until the view
// exists; the loaders' `words` field is tested in system-design.test.ts and
// dsa.test.ts.

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
