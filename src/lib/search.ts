import Fuse from 'fuse.js';
import type { Question, Topic } from '@/types';
import { TOPICS } from './content';
import { QUESTIONS } from './system-design';

// Shared by both indexes so a question is scored the same way a topic is.
const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'summary', weight: 2 },
    { name: 'body', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

// Built on first use: the app only calls `searchContent`, so it shouldn't pay
// for a second index over every topic body at load.
let topicsFuse: Fuse<Topic> | undefined;
function getTopicsFuse(): Fuse<Topic> {
  topicsFuse ??= new Fuse<Topic>(TOPICS, FUSE_OPTIONS);
  return topicsFuse;
}

export type SearchResult =
  { kind: 'topic'; topic: Topic } | { kind: 'question'; question: Question };

// Fuse scores flat fields, so each entry carries the searchable fields next
// to the result it stands for.
type ContentEntry = Pick<Topic, 'title' | 'summary' | 'body'> & { result: SearchResult };

const contentFuse = new Fuse<ContentEntry>(
  [
    ...TOPICS.map((topic) => ({ ...topic, result: { kind: 'topic', topic } as const })),
    ...QUESTIONS.map((question) => ({
      ...question,
      result: { kind: 'question', question } as const,
    })),
  ],
  FUSE_OPTIONS,
);

/** Fuzzy-searches every topic's title, summary, and body. Empty query returns no results. */
export function searchTopics(query: string, limit = 8): Topic[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return getTopicsFuse()
    .search(trimmed, { limit })
    .map((result) => result.item);
}

/** Fuzzy-searches topics and questions together, with the same keys, weights
 * and threshold as `searchTopics`. Empty query returns no results. */
export function searchContent(query: string, limit = 8): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return contentFuse.search(trimmed, { limit }).map((result) => result.item.result);
}
