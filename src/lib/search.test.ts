import { describe, expect, it } from 'vitest';
import * as searchModule from './search';
import { ensureFullTextSearch, searchContent } from './search';

function topicSlugs(query: string): string[] {
  return searchContent(query).flatMap((result) =>
    result.kind === 'topic' ? [result.topic.slug] : [],
  );
}

describe('searchContent over topics', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchContent('')).toEqual([]);
    expect(searchContent('   ')).toEqual([]);
  });

  it('finds a topic by a distinctive word in its title', () => {
    expect(topicSlugs('prompt engineering')).toContain('prompt-engineering');
  });

  it('finds a topic by a distinctive phrase in its body once full-text search has loaded', async () => {
    await ensureFullTextSearch();
    expect(topicSlugs('thin vertical slice')).toContain('plan-before-you-build');
  });

  it('no longer exports searchTopics (criterion 7)', () => {
    expect('searchTopics' in searchModule).toBe(false);
  });
});
