import type { Topic } from '@/types';
import { SECTIONS, type Section } from '@/content/registry';
import { parseFrontmatter } from './frontmatter';

const files = import.meta.glob('/src/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PATH_PATTERN = /\/src\/content\/([^/]+)\/([^/]+)\.md$/;

function parseTopic(filePath: string, raw: string): Topic {
  const match = PATH_PATTERN.exec(filePath);
  if (!match) {
    throw new Error(
      `Topic file path doesn't match src/content/<section>/<slug>.md: ${filePath}`,
    );
  }
  const [, section, slug] = match;
  const { data, content } = parseFrontmatter(raw);

  for (const field of ['title', 'summary', 'date'] as const) {
    if (!data[field]) {
      throw new Error(
        `${section}/${slug}.md is missing required frontmatter field "${field}"`,
      );
    }
  }

  return {
    section,
    slug,
    title: data.title,
    summary: data.summary,
    date: data.date,
    body: content,
  };
}

/** Every topic across every section, sorted by title. */
export const TOPICS: Topic[] = Object.entries(files)
  .map(([filePath, raw]) => parseTopic(filePath, raw))
  .sort((a, b) => a.title.localeCompare(b.title));

/** Topics grouped by section, in `SECTIONS` order. Empty sections are omitted. */
export function topicsBySection(): { section: Section; topics: Topic[] }[] {
  return SECTIONS.map((section) => ({
    section,
    topics: TOPICS.filter((topic) => topic.section === section.slug),
  })).filter((group) => group.topics.length > 0);
}

export function getTopic(section: string, slug: string): Topic | undefined {
  return TOPICS.find((topic) => topic.section === section && topic.slug === slug);
}

/** The topics immediately before/after `topic` within its own section, alphabetically by title. */
export function sectionNeighbors(topic: Topic): {
  prev: Topic | null;
  next: Topic | null;
} {
  const siblings = TOPICS.filter((t) => t.section === topic.section);
  const index = siblings.findIndex((t) => t.slug === topic.slug);
  return {
    prev: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

/** The `count` most recently written topics, newest first. */
export function recentTopics(count: number): Topic[] {
  return [...TOPICS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}
