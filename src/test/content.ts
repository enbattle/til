import { within } from '@testing-library/react';
import { parseFrontmatter } from '@/lib/frontmatter';

// Shared content-test helpers (docs/specs/dedupe-app-scripts-tests.md,
// criterion 8): the tests' own view of the real markdown files, independent
// of the app's loaders (which load only frontmatter eagerly), plus small
// helpers more than one test file used to copy.

export const RAW_TOPICS = import.meta.glob('/src/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const RAW_CASE_STUDIES = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

export const RAW_DSA_ENTRIES = import.meta.glob('/src/dsa/entries/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function rawAt(files: Record<string, string>, path: string, what: string): string {
  const raw = files[path];
  if (raw === undefined) throw new Error(`no raw file for ${what}`);
  return raw;
}

/** The raw file (frontmatter included) of the topic `section/slug`. */
export function rawTopic(section: string, slug: string): string {
  return rawAt(RAW_TOPICS, `/src/content/${section}/${slug}.md`, `${section}/${slug}`);
}

/** The raw file (frontmatter included) of the case study `slug`. */
export function rawCaseStudy(slug: string): string {
  return rawAt(
    RAW_CASE_STUDIES,
    `/src/system-design/case-studies/${slug}.md`,
    `case study ${slug}`,
  );
}

/** The raw file (frontmatter included) of the DSA entry `slug`. */
export function rawDsaEntry(slug: string): string {
  return rawAt(RAW_DSA_ENTRIES, `/src/dsa/entries/${slug}.md`, `DSA entry ${slug}`);
}

/** The case study's markdown body, frontmatter stripped. */
export function caseStudyBody(slug: string): string {
  return parseFrontmatter(rawCaseStudy(slug)).content;
}

/** The DSA entry's markdown body, frontmatter stripped. */
export function dsaEntryBody(slug: string): string {
  return parseFrontmatter(rawDsaEntry(slug)).content;
}

/** A copy of frontmatter `data` with `field` removed. */
export function without(
  data: Record<string, string>,
  field: string,
): Record<string, string> {
  const copy = { ...data };
  delete copy[field];
  return copy;
}

/** Links inside <main> that sit outside the rendered markdown body. */
export function chromeLinks(main: HTMLElement): HTMLAnchorElement[] {
  return within(main)
    .getAllByRole('link')
    .filter((a) => !a.closest('.prose')) as HTMLAnchorElement[];
}
