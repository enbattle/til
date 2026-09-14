import Fuse from 'fuse.js';
import type { Topic } from '@/types';
import { TOPICS } from './content';

const fuse = new Fuse<Topic>(TOPICS, {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'summary', weight: 2 },
    { name: 'body', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

/** Fuzzy-searches every topic's title, summary, and body. Empty query returns no results. */
export function searchTopics(query: string, limit = 8): Topic[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return fuse.search(trimmed, { limit }).map((result) => result.item);
}
