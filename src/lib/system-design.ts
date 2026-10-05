import type { CaseStudy, Topic } from '@/types';
import { createCollection, getTopic } from './content';
import type { TopicRef } from './markdown.mjs';

// Frontmatter, topic links and word counts only, eagerly: enough for the
// landing page, the sidebar, search titles, "Go deeper", the topic pages'
// back-links and the read-time label, without shipping any case-study body in
// the main bundle. The queries are served by the `markdownMeta` plugin in
// `vite.config.ts`.
const metaFiles = import.meta.glob<Record<string, string>>(
  '/src/system-design/case-studies/*.md',
  { query: '?meta', import: 'default', eager: true },
);
const linkFiles = import.meta.glob<TopicRef[]>('/src/system-design/case-studies/*.md', {
  query: '?links',
  import: 'default',
  eager: true,
});
const wordFiles = import.meta.glob<number>('/src/system-design/case-studies/*.md', {
  query: '?words',
  import: 'default',
  eager: true,
});

// Bodies, one lazy chunk per file, fetched only when something asks for one.
const bodyFiles = import.meta.glob<string>('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
});

const PATH_PATTERN = /^\/src\/system-design\/case-studies\/([^/]+)\.md$/;

/**
 * Turns one case-study file's path and parsed frontmatter into a `CaseStudy`,
 * less the body's `words` (the loader adds those from the `?words` view).
 * Exported so the frontmatter contract, including `order`, can be unit-tested
 * against fixtures instead of only the real files.
 */
export function parseCaseStudy(
  filePath: string,
  data: Record<string, string>,
): Omit<CaseStudy, 'words'> {
  const match = PATH_PATTERN.exec(filePath);
  if (!match) {
    throw new Error(
      `Case study file path doesn't match /src/system-design/case-studies/<slug>.md: ${filePath}`,
    );
  }
  const [, slug] = match;
  const name = `system-design/case-studies/${slug}.md`;

  for (const field of ['title', 'summary', 'date', 'order'] as const) {
    if (!data[field]) {
      throw new Error(`${name} is missing required frontmatter field "${field}"`);
    }
  }
  if (!/^\d+$/.test(data.order) || Number(data.order) < 1) {
    throw new Error(
      `${name} has an invalid "order" (${JSON.stringify(data.order)}): expected a positive integer`,
    );
  }

  return {
    slug,
    title: data.title,
    summary: data.summary,
    date: data.date,
    order: Number(data.order),
  };
}

function slugOf(filePath: string): string | undefined {
  return PATH_PATTERN.exec(filePath)?.[1];
}

const caseStudies = createCollection({
  meta: metaFiles,
  bodies: bodyFiles,
  parse: (filePath, data): CaseStudy => ({
    ...parseCaseStudy(filePath, data),
    words: wordFiles[filePath],
  }),
  key: slugOf,
});

/** Every case study, sorted by `order` ascending. Metadata only. */
export const CASE_STUDIES: CaseStudy[] = [...caseStudies.items].sort(
  (a, b) => a.order - b.order,
);

export function getCaseStudy(slug: string): CaseStudy | undefined {
  return caseStudies.get(slug);
}

/** A case study's markdown body, frontmatter stripped. Rejects for an unknown
 * slug. The same promise comes back for the same case study. */
export function loadCaseStudyBody(slug: string): Promise<string> {
  return caseStudies.loadBody(slug);
}

/** Every case-study body, keyed by slug. Fetches all the body chunks the first
 * time; used by full-text search. */
export function loadAllCaseStudyBodies(): Promise<Map<string, string>> {
  return caseStudies.loadAllBodies();
}

// slug -> the topic links in that case study's body, from the build-time
// `?links` query, so nothing here waits on a body.
const LINKS_BY_SLUG = new Map<string, TopicRef[]>(
  Object.entries(linkFiles).flatMap(([filePath, refs]) => {
    const slug = slugOf(filePath);
    return slug ? [[slug, refs] as const] : [];
  }),
);

/** The catalog topics `caseStudy` links to, in order of first appearance. A
 * ref that doesn't resolve is skipped rather than thrown on: a dead link is
 * caught by a test, not by breaking the page at render time. */
export function topicsForCaseStudy(caseStudy: CaseStudy): Topic[] {
  return (LINKS_BY_SLUG.get(caseStudy.slug) ?? [])
    .map(({ section, slug }) => getTopic(section, slug))
    .filter((topic): topic is Topic => topic !== undefined);
}

// topic key (`section/slug`) -> the case studies linking to it, in `order`.
// Built once from the static case-study set.
const CASE_STUDIES_BY_TOPIC = new Map<string, CaseStudy[]>();
for (const caseStudy of CASE_STUDIES) {
  for (const { section, slug } of LINKS_BY_SLUG.get(caseStudy.slug) ?? []) {
    const key = `${section}/${slug}`;
    CASE_STUDIES_BY_TOPIC.set(key, [
      ...(CASE_STUDIES_BY_TOPIC.get(key) ?? []),
      caseStudy,
    ]);
  }
}

/** The case studies whose bodies link to the given topic, in `order`. */
export function caseStudiesForTopic(section: string, slug: string): CaseStudy[] {
  return CASE_STUDIES_BY_TOPIC.get(`${section}/${slug}`) ?? [];
}

/** Whether `pathname` is the System Design landing page or one of its case
 * study pages. Shared by the header tabs and the sidebar so both switch on
 * exactly the same routes. */
export function isSystemDesignPath(pathname: string): boolean {
  return pathname === '/system-design' || pathname.startsWith('/system-design/');
}
