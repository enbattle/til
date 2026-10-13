import Fuse from 'fuse.js';
import { getSection } from '@/content/registry';
import { TOPICS, loadAllTopicBodies } from './content';
import { CASE_STUDIES, loadAllCaseStudyBodies } from './system-design';

/** Exported so tests can ask whether a word fuzzy-matches the way the app's
 * search does (src/test/content.ts `bodyOnlyWord`). */
export const FUSE_OPTIONS = {
  keys: [
    { name: 'title', weight: 3 },
    { name: 'summary', weight: 2 },
    { name: 'body', weight: 1 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/** One searchable item and what its result row shows: `key` is unique across
 * every source (the dialog's list key), `path` is where it goes, `label` is
 * the section label a topic shows, or the header tab (System Design) for a
 * case study. */
export interface SearchResult {
  key: string;
  path: string;
  label: string;
  title: string;
  summary: string;
}

/** One kind of content in the index: its items, and a loader resolving every
 * item's body keyed by the item's `key` (called at most once per success). */
export interface SearchSource {
  items: SearchResult[];
  loadBodies(): Promise<Map<string, string>>;
}

// Fuse scores flat fields, so each entry carries the searchable fields next
// to the item it stands for.
interface ContentEntry {
  title: string;
  summary: string;
  body: string;
  item: SearchResult;
}

/**
 * A search index over `sources`, in source order then item order (Fuse keeps
 * that order on a tie). No source's bodies are in the main bundle, so the
 * index starts with titles and summaries only (every `body` is empty) and
 * gains the body text once `ensureFullTextSearch` has loaded every source.
 * Takes its sources as arguments so the load/retry behavior can be tested
 * with fake loaders; the module's own exports are one instance built from the
 * real content.
 */
export function createSearchIndex(sources: SearchSource[]) {
  function build(bodies: Map<string, string>[] | undefined): Fuse<ContentEntry> {
    return new Fuse<ContentEntry>(
      sources.flatMap((source, i) =>
        source.items.map((item) => ({
          title: item.title,
          summary: item.summary,
          body: bodies?.[i].get(item.key) ?? '',
          item,
        })),
      ),
      FUSE_OPTIONS,
    );
  }

  let fuse = build(undefined);
  let ready = false;
  let loading: Promise<void> | undefined;

  /** Fuzzy-searches every source together. Empty query returns no results.
   * Sync: body text is included once `ensureFullTextSearch` resolves. */
  function searchContent(query: string, limit = 8): SearchResult[] {
    const trimmed = query.trim();
    if (!trimmed) return [];
    return fuse.search(trimmed, { limit }).map((result) => result.item.item);
  }

  /** Loads every source's bodies and rebuilds the index with them. Safe to
   * call repeatedly: concurrent calls share one load, and after a failure of
   * any source the next call tries again (each body store keeps what it
   * already fetched, so only the failed chunks are re-requested). */
  function ensureFullTextSearch(): Promise<void> {
    if (ready) return Promise.resolve();
    if (loading) return loading;
    const attempt = Promise.all(sources.map((source) => source.loadBodies())).then(
      (bodies) => {
        fuse = build(bodies);
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

/** `bodies` (keyed by slug) re-keyed `<prefix>/<slug>`, the items' keys. */
function prefixKeys(prefix: string, bodies: Map<string, string>): Map<string, string> {
  return new Map([...bodies].map(([slug, body]) => [`${prefix}/${slug}`, body]));
}

const defaultIndex = createSearchIndex([
  {
    items: TOPICS.map((topic) => ({
      key: `${topic.section}/${topic.slug}`,
      path: topic.path,
      label: getSection(topic.section)?.label ?? topic.section,
      title: topic.title,
      summary: topic.summary,
    })),
    // Already keyed `section/slug`.
    loadBodies: () => loadAllTopicBodies(),
  },
  {
    items: CASE_STUDIES.map((caseStudy) => ({
      key: `system-design/${caseStudy.slug}`,
      path: caseStudy.path,
      label: 'System Design',
      title: caseStudy.title,
      summary: caseStudy.summary,
    })),
    loadBodies: () =>
      loadAllCaseStudyBodies().then((bodies) => prefixKeys('system-design', bodies)),
  },
]);

export const searchContent = defaultIndex.searchContent;
export const ensureFullTextSearch = defaultIndex.ensureFullTextSearch;
export const isFullTextSearchReady = defaultIndex.isFullTextSearchReady;
