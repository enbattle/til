import { describe, expect, it } from 'vitest';
import { bodyOnlyWord } from '@/test/content';
import { TOPICS } from './content';
import { DSA_ENTRIES } from './dsa';
import { parseFrontmatter } from './frontmatter';
import { CASE_STUDIES } from './system-design';
import { ensureFullTextSearch, searchContent } from './search';

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('searchContent', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchContent('')).toEqual([]);
    expect(searchContent('   ')).toEqual([]);
  });

  it.each(CASE_STUDIES.map((c) => [c.slug, c] as const))(
    'finds case study %s by its exact title as a case-study result (criterion 11)',
    (_slug, caseStudy) => {
      const results = searchContent(caseStudy.title);
      const hit = results.find(
        (result) =>
          result.kind === 'caseStudy' && result.caseStudy.slug === caseStudy.slug,
      );
      expect(hit).toBeDefined();
    },
  );

  it('still returns a topic result for a query matching a known topic', () => {
    const results = searchContent('prompt engineering');
    expect(
      results.some(
        (result) => result.kind === 'topic' && result.topic.slug === 'prompt-engineering',
      ),
    ).toBe(true);
  });

  it('finds a topic by a distinctive body phrase once full-text search has loaded', async () => {
    await ensureFullTextSearch();
    // Read from the topic's file, not pinned (docs/specs/harness-follow-ups.md,
    // criterion 9).
    const results = searchContent(
      bodyOnlyWord('engineering-practices', 'plan-before-you-build'),
    );
    expect(
      results.some(
        (result) =>
          result.kind === 'topic' && result.topic.slug === 'plan-before-you-build',
      ),
    ).toBe(true);
  });

  it('finds the URL shortener by a body-only phrase once full-text search has loaded (criterion 11)', async () => {
    const raw = RAW['/src/system-design/case-studies/url-shortener.md'];
    expect(raw).toBeDefined();
    const { data, content } = parseFrontmatter(raw);
    // A heading read from the file now, which the title and summary don't
    // contain, so only the body can match it; no published phrase is pinned
    // (docs/specs/harness-follow-ups.md, criterion 9).
    const phrase = [...content.matchAll(/^##+ +(.+)$/gm)]
      .map(([, heading]) => heading.trim())
      .find(
        (heading) =>
          // Plain words within Fuse's 32-character pattern length.
          /^[A-Za-z -]{4,32}$/.test(heading) &&
          !`${data.title} ${data.summary}`.toLowerCase().includes(heading.toLowerCase()),
      );
    expect(phrase).toBeDefined();

    await ensureFullTextSearch();
    // Every document may match a template heading, so the limit covers the
    // whole corpus: this tests that the body is searched, not how it ranks.
    const everything = TOPICS.length + CASE_STUDIES.length + DSA_ENTRIES.length;
    expect(
      searchContent(phrase!, everything).some(
        (r) => r.kind === 'caseStudy' && r.caseStudy.slug === 'url-shortener',
      ),
    ).toBe(true);
  });

  it('respects the limit argument', () => {
    expect(searchContent('database', 50).length).toBeGreaterThan(2);
    expect(searchContent('database', 1)).toHaveLength(1);
    expect(searchContent('database', 2).length).toBeLessThanOrEqual(2);
  });

  it('carries the full topic, case study or DSA entry on each result', () => {
    for (const result of searchContent('database', 50)) {
      if (result.kind === 'topic') {
        expect(typeof result.topic.slug).toBe('string');
        expect(typeof result.topic.section).toBe('string');
      } else if (result.kind === 'dsa') {
        expect(typeof result.entry.slug).toBe('string');
        expect(typeof result.entry.kind).toBe('string');
      } else {
        expect(result.kind).toBe('caseStudy');
        expect(typeof result.caseStudy.slug).toBe('string');
        expect(typeof result.caseStudy.order).toBe('number');
      }
    }
  });
});
