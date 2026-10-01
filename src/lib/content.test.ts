import { describe, expect, it } from 'vitest';
import { SECTIONS } from '@/content/registry';
import { TOPICS, getTopic, recentTopics, topicsBySection } from './content';
import { neighbours } from './neighbours';

describe('content loader', () => {
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

  // docs/specs/dedupe-app-scripts-tests.md, criterion 5: the topic page's
  // prev/next is `neighbours` over its section's topics (sectionNeighbors is
  // gone), so a section's group must hold its topics in title order.
  it('walks prev/next neighbors within a section without leaking across sections', () => {
    const [firstSection] = topicsBySection();
    const [first, second] = firstSection.topics;
    const walk = (topic: (typeof firstSection.topics)[number]) =>
      neighbours(firstSection.topics, topic);

    expect(walk(first).prev).toBeNull();
    if (second) {
      expect(walk(first).next?.slug).toBe(second.slug);
      expect(walk(second).prev?.slug).toBe(first.slug);
    }

    const last = firstSection.topics[firstSection.topics.length - 1];
    expect(walk(last).next).toBeNull();
  });

  it("holds each section's topics in title order, exactly the section's TOPICS", () => {
    for (const { section, topics } of topicsBySection()) {
      expect(topics).toEqual(TOPICS.filter((t) => t.section === section.slug));
      const titles = topics.map((t) => t.title);
      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    }
  });

  // Criterion 4 (A11): built once at module load, not on every call.
  it('returns the same grouping on every call', () => {
    expect(topicsBySection()).toBe(topicsBySection());
  });

  it('returns the most recent topics, newest first, capped at the requested count', () => {
    const recent = recentTopics(2);
    expect(recent.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < recent.length; i++) {
      expect(recent[i - 1].date >= recent[i].date).toBe(true);
    }
  });
});
