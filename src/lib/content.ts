import type { Topic } from '@/types';
import { SECTIONS, type Section } from '@/content/registry';
import { parseFrontmatter } from './frontmatter';

// Frontmatter and word counts only, eagerly: enough for the sidebar, cards,
// sort order, search results and the read-time label without shipping any
// topic body in the main bundle. The queries are served by the `markdownMeta`
// plugin in `vite.config.ts`.
const metaFiles = import.meta.glob<Record<string, string>>('/src/content/**/*.md', {
  query: '?meta',
  import: 'default',
  eager: true,
});
const wordFiles = import.meta.glob<number>('/src/content/**/*.md', {
  query: '?words',
  import: 'default',
  eager: true,
});

// Bodies, one lazy chunk per file, fetched only when something asks for one.
const bodyFiles = import.meta.glob<string>('/src/content/**/*.md', {
  query: '?raw',
  import: 'default',
});

const PATH_PATTERN = /^\/src\/content\/([^/]+)\/([^/]+)\.md$/;

/**
 * Turns one file's path and parsed frontmatter into a `Topic`, less the body's
 * `words` (the loader adds those from the `?words` view). Exported so the
 * frontmatter contract can be unit-tested against fixtures instead of only the
 * real files.
 */
export function parseTopicMeta(
  filePath: string,
  data: Record<string, string>,
): Omit<Topic, 'words'> {
  const match = PATH_PATTERN.exec(filePath);
  if (!match) {
    throw new Error(
      `Topic file path doesn't match /src/content/<section>/<slug>.md: ${filePath}`,
    );
  }
  const [, section, slug] = match;

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
  };
}

/**
 * Loads bodies on demand from `loaders` (keyed `section/slug` for topics, the
 * slug for case studies in `system-design.ts`), remembering each
 * one. A promise is memoized per key so concurrent callers share one fetch,
 * and a rejected one is evicted so a retry re-invokes the loader instead of
 * replaying the stored failure forever. That does not guarantee the retry
 * succeeds: a browser can cache a failed dynamic-import URL until the page is
 * reloaded, so an in-page retry of a chunk that failed may fail again. The
 * error boundary's Reload button is the real recovery. The loaders take their
 * dependencies as arguments so this can be tested without the real chunks.
 */
export function createBodyStore(loaders: Record<string, () => Promise<string>>) {
  const bodies = new Map<string, Promise<string>>();
  let all: Promise<Map<string, string>> | undefined;

  function load(key: string): Promise<string> {
    const cached = bodies.get(key);
    if (cached) return cached;
    if (!Object.hasOwn(loaders, key)) {
      return Promise.reject(new Error(`No body registered for "${key}"`));
    }
    const promise = loaders[key]();
    bodies.set(key, promise);
    promise.catch(() => {
      if (bodies.get(key) === promise) bodies.delete(key);
    });
    return promise;
  }

  function loadAll(): Promise<Map<string, string>> {
    if (all) return all;
    const promise = Promise.all(
      Object.keys(loaders).map(async (key) => [key, await load(key)] as const),
    ).then((entries) => new Map(entries));
    all = promise;
    promise.catch(() => {
      if (all === promise) all = undefined;
    });
    return promise;
  }

  return { load, loadAll };
}

/**
 * One kind of content (topics, case studies, DSA entries) from its two globs:
 * `meta`, the eager `?meta` glob (path -> frontmatter), every path of which
 * goes through `parse`, so a malformed file throws at load; and `bodies`, the
 * lazy `?raw` glob. `key(path)` gives an item's key, or undefined for a path
 * that isn't one (its body is skipped). `items` is in glob order; callers sort.
 * `loadBody` strips the frontmatter and rejects a key with no item without
 * loading anything.
 */
export function createCollection<T>({
  meta,
  bodies,
  parse,
  key,
}: {
  meta: Record<string, Record<string, string>>;
  bodies: Record<string, () => Promise<string>>;
  parse: (path: string, data: Record<string, string>) => T;
  key: (path: string) => string | undefined;
}) {
  const byKey = new Map<string, T>();
  const items = Object.entries(meta).map(([path, data]) => {
    const item = parse(path, data);
    const itemKey = key(path);
    if (itemKey !== undefined) byKey.set(itemKey, item);
    return item;
  });

  const store = createBodyStore(
    Object.fromEntries(
      Object.entries(bodies).flatMap(([path, loadRaw]) => {
        const bodyKey = key(path);
        if (bodyKey === undefined) return [];
        return [[bodyKey, async () => parseFrontmatter(await loadRaw()).content]];
      }),
    ),
  );

  return {
    items,
    get: (itemKey: string): T | undefined => byKey.get(itemKey),
    /** The same promise comes back for the same key. */
    loadBody(itemKey: string): Promise<string> {
      if (!byKey.has(itemKey)) {
        return Promise.reject(new Error(`Unknown item "${itemKey}"`));
      }
      return store.load(itemKey);
    },
    /** Every body, keyed by key. Fetches all the body chunks the first time. */
    loadAllBodies: () => store.loadAll(),
  };
}

const topics = createCollection({
  meta: metaFiles,
  bodies: bodyFiles,
  parse: (filePath, data): Topic => ({
    ...parseTopicMeta(filePath, data),
    words: wordFiles[filePath],
  }),
  key: (filePath) => {
    const match = PATH_PATTERN.exec(filePath);
    return match ? `${match[1]}/${match[2]}` : undefined;
  },
});

/** Every topic across every section, sorted by title. Metadata only. */
export const TOPICS: Topic[] = [...topics.items].sort((a, b) =>
  a.title.localeCompare(b.title),
);

/** A topic's markdown body, frontmatter stripped. Rejects for an unknown
 * topic. The same promise comes back for the same topic, so it's safe to
 * hand straight to React's `use`. */
export function loadTopicBody(section: string, slug: string): Promise<string> {
  return topics.loadBody(`${section}/${slug}`);
}

/** Every topic body, keyed `section/slug`. Fetches all the body chunks the
 * first time; used by full-text search. */
export function loadAllTopicBodies(): Promise<Map<string, string>> {
  return topics.loadAllBodies();
}

// Built once: the topic set is fixed at build time.
const TOPICS_BY_SECTION = SECTIONS.map((section) => ({
  section,
  topics: TOPICS.filter((topic) => topic.section === section.slug),
})).filter((group) => group.topics.length > 0);

/** Topics grouped by section, in `SECTIONS` order, each by title. Empty
 * sections are omitted. The same array every call. */
export function topicsBySection(): { section: Section; topics: Topic[] }[] {
  return TOPICS_BY_SECTION;
}

export function getTopic(section: string, slug: string): Topic | undefined {
  return topics.get(`${section}/${slug}`);
}

/** The `count` most recently written topics, newest first. */
export function recentTopics(count: number): Topic[] {
  return [...TOPICS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, count);
}
