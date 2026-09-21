import { beforeAll, describe, expect, it } from 'vitest';
import { SECTIONS } from '@/content/registry';
import {
  TOPICS,
  getTopic,
  loadAllTopicBodies,
  recentTopics,
  sectionNeighbors,
  topicsBySection,
} from './content';

describe('content loader', () => {
  // Bodies load on demand, keyed `section/slug`.
  let bodies: Map<string, string>;
  beforeAll(async () => {
    bodies = await loadAllTopicBodies();
  });

  it('loads at least one topic', () => {
    expect(TOPICS.length).toBeGreaterThan(0);
  });

  it('gives every topic a required title, summary, date, and non-empty body', () => {
    for (const topic of TOPICS) {
      expect(topic.title.length).toBeGreaterThan(0);
      expect(topic.summary.length).toBeGreaterThan(0);
      expect(topic.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(bodies.get(`${topic.section}/${topic.slug}`)?.length).toBeGreaterThan(0);
      expect(SECTIONS.some((section) => section.slug === topic.section)).toBe(true);
    }
  });

  it('finds a known topic by section and slug', () => {
    const topic = getTopic('ai-and-ml', 'prompt-engineering');
    expect(topic?.title).toContain('Prompt Engineering');
  });

  it('returns undefined for an unknown topic', () => {
    expect(getTopic('ai-and-ml', 'does-not-exist')).toBeUndefined();
  });

  it('groups topics by section in registry order, omitting empty sections', () => {
    const groups = topicsBySection();
    const groupSlugs = groups.map((g) => g.section.slug);
    const registryOrder = SECTIONS.map((s) => s.slug).filter((slug) =>
      groupSlugs.includes(slug),
    );
    expect(groupSlugs).toEqual(registryOrder);
    for (const group of groups) {
      expect(group.topics.length).toBeGreaterThan(0);
      for (const topic of group.topics) {
        expect(topic.section).toBe(group.section.slug);
      }
    }
  });

  it('walks prev/next neighbors within a section without leaking across sections', () => {
    const [firstSection] = topicsBySection();
    const [first, second] = firstSection.topics;

    expect(sectionNeighbors(first).prev).toBeNull();
    if (second) {
      expect(sectionNeighbors(first).next?.slug).toBe(second.slug);
      expect(sectionNeighbors(second).prev?.slug).toBe(first.slug);
    }

    const last = firstSection.topics[firstSection.topics.length - 1];
    expect(sectionNeighbors(last).next).toBeNull();
  });

  it('returns the most recent topics, newest first, capped at the requested count', () => {
    const recent = recentTopics(2);
    expect(recent.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < recent.length; i++) {
      expect(recent[i - 1].date >= recent[i].date).toBe(true);
    }
  });
});
