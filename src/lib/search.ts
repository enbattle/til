import Fuse from 'fuse.js';
import type { CaseStudy, Topic } from '@/types';
import { TOPICS, loadAllTopicBodies } from './content';
import { CASE_STUDIES, loadAllCaseStudyBodies } from './system-design';

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
  { kind: 'topic'; topic: Topic } | { kind: 'caseStudy'; caseStudy: CaseStudy };

// Fuse scores flat fields, so each entry carries the searchable fields next
// to the result it stands for.
interface ContentEntry {
  title: string;
  summary: string;
  body: string;
  result: SearchResult;
}

interface SearchIndexDeps {
  topics: Topic[];
  caseStudies: CaseStudy[];
  /** Every topic body keyed `section/slug`; called at most once per success. */
  loadTopicBodies: () => Promise<Map<string, string>>;
  /** Every case-study body keyed by slug; called at most once per success. */
  loadCaseStudyBodies: () => Promise<Map<string, string>>;
}

/**
 * A search index over topics and case studies. Neither kind's body is in the
 * main bundle, so the index starts with titles and summaries only (every
 * `body` is empty) and gains the body text once `ensureFullTextSearch` has
 * loaded both sets. Takes its dependencies as arguments so the load/retry
 * behavior can be tested with fake loaders; the module's own exports are one
 * instance built from the real content.
 */
export function createSearchIndex({
  topics,
  caseStudies,
  loadTopicBodies,
  loadCaseStudyBodies,
}: SearchIndexDeps) {
  function build(
    bodies: { topics: Map<string, string>; caseStudies: Map<string, string> } | undefined,
  ): Fuse<ContentEntry> {
    return new Fuse<ContentEntry>(
      [
        ...topics.map((topic) => ({
          title: topic.title,
          summary: topic.summary,
          body: bodies?.topics.get(`${topic.section}/${topic.slug}`) ?? '',
          result: { kind: 'topic', topic } as const,
        })),
        ...caseStudies.map((caseStudy) => ({
          title: caseStudy.title,
          summary: caseStudy.summary,
          body: bodies?.caseStudies.get(caseStudy.slug) ?? '',
          result: { kind: 'caseStudy', caseStudy } as const,
        })),
      ],
      FUSE_OPTIONS,
    );
  }

  let fuse = build(undefined);
  let ready = false;
  let loading: Promise<void> | undefined;

  /** Fuzzy-searches topics and case studies together. Empty query returns no
   * results. Sync: body text is included once `ensureFullTextSearch` resolves. */
  function searchContent(query: string, limit = 8): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return fuse.search(trimmed, { limit }).map((result) => result.item.result);
  }

  /** Loads every topic and case-study body and rebuilds the index with them.
   * Safe to call repeatedly: concurrent calls share one load, and after a
   * failure of either set the next call tries again (each body store keeps
   * what it already fetched, so only the failed chunks are re-requested). */
  function ensureFullTextSearch(): Promise<void> {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    const attempt = Promise.all([loadTopicBodies(), loadCaseStudyBodies()]).then(
      ([topicBodies, caseStudyBodies]) => {
        fuse = build({ topics: topicBodies, caseStudies: caseStudyBodies });
        ready = true;
      },
    );
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
  caseStudies: CASE_STUDIES,
  loadTopicBodies: () => loadAllTopicBodies(),
  loadCaseStudyBodies: () => loadAllCaseStudyBodies(),
});

export const searchContent = defaultIndex.searchContent;
export const ensureFullTextSearch = defaultIndex.ensureFullTextSearch;
export const isFullTextSearchReady = defaultIndex.isFullTextSearchReady;
