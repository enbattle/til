import Fuse from 'fuse.js';
import type { Question, Topic } from '@/types';
import { TOPICS, loadAllTopicBodies } from './content';
import { QUESTIONS } from './system-design';

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

export type SearchResult =
  { kind: 'topic'; topic: Topic } | { kind: 'question'; question: Question };

// Fuse scores flat fields, so each entry carries the searchable fields next
// to the result it stands for.
type ContentEntry = Pick<Question, 'title' | 'summary' | 'body'> & {
  result: SearchResult;
};

interface SearchIndexDeps {
  topics: Topic[];
  questions: Question[];
  /** Every topic body keyed `section/slug`; called at most once per success. */
  loadTopicBodies: () => Promise<Map<string, string>>;
}

/**
 * A search index over topics and questions. Topic bodies aren't in the main
 * bundle, so the index starts with each topic's title and summary only (a
 * topic's `body` is empty) and gains the body text once `ensureFullTextSearch`
 * has loaded it. Takes its dependencies as arguments so the load/retry
 * behavior can be tested with fake loaders; the module's own exports are one
 * instance built from the real content.
 */
export function createSearchIndex({
  topics,
  questions,
  loadTopicBodies,
}: SearchIndexDeps) {
  function build(bodies: Map<string, string> | undefined): Fuse<ContentEntry> {
    return new Fuse<ContentEntry>(
      [
        ...topics.map((topic) => ({
          title: topic.title,
          summary: topic.summary,
          body: bodies?.get(`${topic.section}/${topic.slug}`) ?? '',
          result: { kind: 'topic', topic } as const,
        })),
        ...questions.map((question) => ({
          title: question.title,
          summary: question.summary,
          body: question.body,
          result: { kind: 'question', question } as const,
        })),
      ],
      FUSE_OPTIONS,
    );
  }

  let fuse = build(undefined);
  let ready = false;
  let loading: Promise<void> | undefined;

  /** Fuzzy-searches topics and questions together. Empty query returns no
   * results. Sync: topic body text is included once `ensureFullTextSearch` resolves. */
  function searchContent(query: string, limit = 8): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return fuse.search(trimmed, { limit }).map((result) => result.item.result);
  }

  /** Loads every topic body and rebuilds the index with them. Safe to call
   * repeatedly: concurrent calls share one load, and after a failure the next
   * call tries again. */
  function ensureFullTextSearch(): Promise<void> {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    const attempt = loadTopicBodies().then((bodies) => {
      fuse = build(bodies);
      ready = true;
    });
    loading = attempt;
    attempt.catch(() => {
      if (loading === attempt) loading = undefined;
    });
    return attempt;
  }

  function isFullTextSearchReady(): boolean {
    return ready;
  }

  return { searchContent, ensureFullTextSearch, isFullTextSearchReady };
}

const defaultIndex = createSearchIndex({
  topics: TOPICS,
  questions: QUESTIONS,
  loadTopicBodies: () => loadAllTopicBodies(),
});

export const searchContent = defaultIndex.searchContent;
export const ensureFullTextSearch = defaultIndex.ensureFullTextSearch;
export const isFullTextSearchReady = defaultIndex.isFullTextSearchReady;
