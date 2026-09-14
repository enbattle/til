import { describe, expect, it } from 'vitest';
import { searchTopics } from './search';

describe('searchTopics', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchTopics('')).toEqual([]);
    expect(searchTopics('   ')).toEqual([]);
  });

  it('finds a topic by a distinctive word in its title', () => {
    const results = searchTopics('prompt engineering');
    expect(results.some((topic) => topic.slug === 'prompt-engineering')).toBe(true);
  });

  it('finds a topic by a distinctive phrase in its body', () => {
    const results = searchTopics('thin vertical slice');
    expect(results.some((topic) => topic.slug === 'plan-before-you-build')).toBe(true);
  });
});
