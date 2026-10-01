import type { DsaEntry, DsaKind } from '@/types';
import { createBodyStore } from './content';
import { parseFrontmatter } from './frontmatter';

// Frontmatter and prerequisite links only, eagerly: enough for the landing
// page, the sidebar, search titles and "Before this", without shipping any
// entry body in the main bundle. Both queries are served by the
// `markdownMeta` plugin in `vite.config.ts`.
const metaFiles = import.meta.glob<Record<string, string>>('/src/dsa/entries/*.md', {
  query: '?meta',
  import: 'default',
  eager: true,
});
const prereqFiles = import.meta.glob<string[]>('/src/dsa/entries/*.md', {
  query: '?dsaPrereqs',
  import: 'default',
  eager: true,
});

// Bodies, one lazy chunk per file, fetched only when something asks for one.
const bodyFiles = import.meta.glob<string>('/src/dsa/entries/*.md', {
  query: '?raw',
  import: 'default',
});

const PATH_PATTERN = /^\/src\/dsa\/entries\/([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;

const KINDS: readonly DsaKind[] = ['data-structure', 'pattern', 'algorithm'];

const KIND_LABELS: Record<DsaKind, string> = {
  'data-structure': 'Data structure',
  pattern: 'Pattern',
  algorithm: 'Algorithm',
};

/** The text label for a kind, shown on cards and entry pages (never color
 * alone). */
export function dsaKindLabel(kind: DsaKind): string {
  return KIND_LABELS[kind];
}

function isKind(value: string): value is DsaKind {
  return (KINDS as readonly string[]).includes(value);
}

/**
 * Turns one entry file's path and parsed frontmatter into a `DsaEntry`.
 * Exported so the frontmatter contract can be unit-tested against fixtures
 * instead of only the real files.
 */
export function parseDsaEntry(filePath: string, data: Record<string, string>): DsaEntry {
  const match = PATH_PATTERN.exec(filePath);
  if (!match) {
    throw new Error(
      `DSA entry file path doesn't match /src/dsa/entries/<slug>.md: ${filePath}`,
    );
  }
  const [, slug] = match;
  const name = `dsa/entries/${slug}.md`;

  for (const field of ['title', 'summary', 'date', 'kind'] as const) {
    if (!data[field]) {
      throw new Error(`${name} is missing required frontmatter field "${field}"`);
    }
  }
  const { kind } = data;
  if (!isKind(kind)) {
    throw new Error(
      `${name} has an invalid "kind" (${JSON.stringify(kind)}): expected one of ${KINDS.join(', ')}`,
    );
  }

  return { slug, title: data.title, summary: data.summary, date: data.date, kind };
}

/** Kind first (data structures, patterns, algorithms), then title, then slug
 * so the order never depends on the input. */
function compareEntries(a: DsaEntry, b: DsaEntry): number {
  return (
    KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) ||
    a.title.localeCompare(b.title) ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * `entries` in a topological order over `prereqs` (slug -> the slugs it
 * needs): every prerequisite comes before the entries that need it. Among
 * entries whose prerequisites are all placed, the lowest by kind (data
 * structures, patterns, algorithms), then title, goes next (Kahn's algorithm).
 * An entry missing from `prereqs` has none. Throws, naming the entries, on a
 * self-link, a prerequisite that isn't an entry, or a cycle.
 */
export function orderDsaEntries(
  entries: DsaEntry[],
  prereqs: Record<string, string[]>,
): DsaEntry[] {
  const bySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const needs = new Map<string, Set<string>>();
  for (const entry of entries) {
    const own = prereqs[entry.slug] ?? [];
    for (const slug of own) {
      if (slug === entry.slug) {
        throw new Error(`DSA entry "${entry.slug}" lists itself as a prerequisite`);
      }
      if (!bySlug.has(slug)) {
        throw new Error(
          `DSA entry "${entry.slug}" has an unknown prerequisite "${slug}" (no src/dsa/entries/${slug}.md)`,
        );
      }
    }
    needs.set(entry.slug, new Set(own));
  }

  const placed = new Set<string>();
  const ordered: DsaEntry[] = [];
  let remaining = [...entries].sort(compareEntries);
  while (remaining.length > 0) {
    const next = remaining.find((entry) =>
      [...needs.get(entry.slug)!].every((slug) => placed.has(slug)),
    );
    if (!next) {
      throw new Error(
        `DSA prerequisites form a cycle: ${findCycle(remaining, needs, placed).join(' -> ')}`,
      );
    }
    ordered.push(next);
    placed.add(next.slug);
    remaining = remaining.filter((entry) => entry !== next);
  }
  return ordered;
}

/** One cycle among `remaining`, as slugs with the first repeated at the end.
 * Every remaining entry waits on another remaining one, so following those
 * links must come back to an entry already seen. */
function findCycle(
  remaining: DsaEntry[],
  needs: Map<string, Set<string>>,
  placed: Set<string>,
): string[] {
  const path: string[] = [];
  let slug = remaining[0].slug;
  while (!path.includes(slug)) {
    path.push(slug);
    slug = [...needs.get(slug)!].find((s) => !placed.has(s))!;
  }
  return [...path.slice(path.indexOf(slug)), slug];
}

function slugOf(filePath: string): string | undefined {
  return PATH_PATTERN.exec(filePath)?.[1];
}

// slug -> the prerequisite slugs in its `## Prerequisites` section, from the
// build-time `?dsaPrereqs` query.
const PREREQS: Record<string, string[]> = Object.fromEntries(
  Object.entries(prereqFiles).flatMap(([filePath, slugs]) => {
    const slug = slugOf(filePath);
    return slug ? [[slug, slugs] as const] : [];
  }),
);

/** Every DSA entry, prerequisites first (see `orderDsaEntries`). Metadata
 * only. Throws at load time on a bad file or a broken prerequisite, so the
 * tests that import it fail (and with them `verify`, where `test:run` runs
 * before `build`); `vite build` alone doesn't run this code. */
export const DSA_ENTRIES: DsaEntry[] = orderDsaEntries(
  Object.entries(metaFiles).map(([filePath, data]) => parseDsaEntry(filePath, data)),
  PREREQS,
);

export function getDsaEntry(slug: string): DsaEntry | undefined {
  return DSA_ENTRIES.find((entry) => entry.slug === slug);
}

/** The entries `slug` lists under `## Prerequisites`, in the order it links
 * them; [] for an unknown slug. */
export function getDsaPrerequisites(slug: string): DsaEntry[] {
  return (PREREQS[slug] ?? [])
    .map((prereq) => getDsaEntry(prereq))
    .filter((entry): entry is DsaEntry => entry !== undefined);
}

const bodyStore = createBodyStore(
  Object.fromEntries(
    Object.entries(bodyFiles).flatMap(([filePath, loadRaw]) => {
      const slug = slugOf(filePath);
      if (!slug) return [];
      return [[slug, async () => parseFrontmatter(await loadRaw()).content]];
    }),
  ),
);

/** An entry's markdown body, frontmatter stripped. Rejects for an unknown
 * slug. The same promise comes back for the same entry. */
export function loadDsaEntryBody(slug: string): Promise<string> {
  if (!getDsaEntry(slug)) {
    return Promise.reject(new Error(`Unknown DSA entry "${slug}"`));
  }
  return bodyStore.load(slug);
}

/** Every entry body, keyed by slug. Fetches all the body chunks the first
 * time; used by full-text search. */
export function loadAllDsaBodies(): Promise<Map<string, string>> {
  return bodyStore.loadAll();
}

/** Whether `pathname` is the DSA landing page or one of its entry pages.
 * Shared by the header tabs and the sidebar so both switch on exactly the
 * same routes. */
export function isDsaPath(pathname: string): boolean {
  return pathname === '/dsa' || pathname.startsWith('/dsa/');
}
