import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './system-design';
import { searchContent, searchTopics } from './search';

describe('searchContent', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchContent('')).toEqual([]);
    expect(searchContent('   ')).toEqual([]);
  });

  it.each(QUESTIONS.map((q) => [q.slug, q] as const))(
    'finds question %s by its exact title as a question result',
    (_slug, question) => {
      const results = searchContent(question.title);
      const hit = results.find(
        (result) => result.kind === 'question' && result.question.slug === question.slug,
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

  it('finds a topic by a distinctive body phrase', () => {
    const results = searchContent('thin vertical slice');
    expect(
      results.some(
        (result) =>
          result.kind === 'topic' && result.topic.slug === 'plan-before-you-build',
      ),
    ).toBe(true);
  });

  it('respects the limit argument', () => {
    expect(searchContent('database', 50).length).toBeGreaterThan(2);
    expect(searchContent('database', 1)).toHaveLength(1);
    expect(searchContent('database', 2).length).toBeLessThanOrEqual(2);
  });

  it('carries the full topic or question on each result', () => {
    for (const result of searchContent('database', 50)) {
      if (result.kind === 'topic') {
        expect(typeof result.topic.slug).toBe('string');
        expect(typeof result.topic.section).toBe('string');
      } else {
        expect(typeof result.question.slug).toBe('string');
        expect(typeof result.question.order).toBe('number');
      }
    }
  });

  it('leaves searchTopics returning topics only', () => {
    for (const topic of searchTopics('database', 50)) {
      expect(topic).toHaveProperty('section');
      expect(topic).not.toHaveProperty('kind');
    }
  });
});
