import type { Topic } from '@/types';
import { SECTIONS, type Section } from '@/content/registry';
import { parseFrontmatter } from './frontmatter';

// Frontmatter only, eagerly: enough for the sidebar, cards, sort order and
// search results without shipping any topic body in the main bundle. The
// `?meta` query is served by the `markdownMeta` plugin in `vite.config.ts`.
const metaFiles = import.meta.glob<Record<string, string>>('/src/content/**/*.md', {
  query: '?meta',
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
 * Turns one file's path and parsed frontmatter into a `Topic`. Exported so the
 * frontmatter contract can be unit-tested against fixtures instead of only the
 * real files.
 */
export function parseTopicMeta(filePath: string, data: Record<string, string>): Topic {
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

/** Every topic across every section, sorted by title. Metadata only. */
export const TOPICS: Topic[] = Object.entries(metaFiles)
  .map(([filePath, data]) => parseTopicMeta(filePath, data))
  .sort((a, b) => a.title.localeCompare(b.title));

/**
 * Loads bodies on demand from `loaders` (key `section/slug`), remembering each
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
      return Promise.reject(new Error(`No topic body registered for "${key}"`));
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

const bodyStore = createBodyStore(
  Object.fromEntries(
    Object.entries(bodyFiles).flatMap(([filePath, loadRaw]) => {
      const match = PATH_PATTERN.exec(filePath);
      if (!match) return [];
      return [
        [
          `${match[1]}/${match[2]}`,
          async () => parseFrontmatter(await loadRaw()).content,
        ],
      ];
    }),
  ),
);

/** A topic's markdown body, frontmatter stripped. Rejects for an unknown
 * topic. The same promise comes back for the same topic, so it's safe to
 * hand straight to React's `use`. */
export function loadTopicBody(section: string, slug: string): Promise<string> {
  if (!getTopic(section, slug)) {
    return Promise.reject(new Error(`Unknown topic "${section}/${slug}"`));
  }
  return bodyStore.load(`${section}/${slug}`);
}

/** Every topic body, keyed `section/slug`. Fetches all the body chunks the
 * first time; used by full-text search. */
export function loadAllTopicBodies(): Promise<Map<string, string>> {
  return bodyStore.loadAll();
}

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
