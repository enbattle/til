import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/lib/frontmatter';
import {
  RAW_CASE_STUDIES,
  RAW_DSA_ENTRIES,
  RAW_TOPICS,
  bodyOnlyWord,
  fuzzyMatchesFrontmatter,
} from './content';

// bodyOnlyWord must pick a word the app's fuzzy search can't find in any title
// or summary, or a search test that expects "no match before bodies load"
// fails when a new summary happens to hold a near-variant (catalog batch 8: a
// summary's "discovers" matched the picked word "discovering").

describe('fuzzyMatchesFrontmatter', () => {
  const entries = [
    {
      title: 'Model Context Protocol',
      summary: 'The application discovers what the server offers by asking it.',
    },
  ];

  it('matches a near-variant of a word in a summary, not only the exact word', () => {
    expect(fuzzyMatchesFrontmatter('discovering', entries)).toBe(true);
  });

  it('does not match a word with no near-variant in any title or summary', () => {
    expect(fuzzyMatchesFrontmatter('zanzibarquokkatron', entries)).toBe(false);
  });
});

describe('bodyOnlyWord', () => {
  it('picks a word with no fuzzy match in any published title or summary', () => {
    const entries = Object.values({
      ...RAW_TOPICS,
      ...RAW_CASE_STUDIES,
      ...RAW_DSA_ENTRIES,
    }).map((raw) => {
      const { data } = parseFrontmatter(raw);
      return { title: data.title ?? '', summary: data.summary ?? '' };
    });
    const word = bodyOnlyWord('engineering-practices', 'plan-before-you-build');
    expect(fuzzyMatchesFrontmatter(word, entries)).toBe(false);
  });
});
