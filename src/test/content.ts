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

/** A word only the body of topic `section/slug` contains: in no other
 * published file and not in its own frontmatter, so only full-text search can
 * find it, and it ranks first. Read from the files at test time, so a search
 * test pins no published phrase (docs/specs/harness-follow-ups.md,
 * criterion 9). */
export function bodyOnlyWord(section: string, slug: string): string {
  const path = `/src/content/${section}/${slug}.md`;
  const raw = rawTopic(section, slug);
  const { data, content } = parseFrontmatter(raw);
  const frontmatter = Object.values(data).join(' ').toLowerCase();
  const others = Object.entries({
    ...RAW_TOPICS,
    ...RAW_CASE_STUDIES,
    ...RAW_DSA_ENTRIES,
  })
    .filter(([other]) => other !== path)
    .map(([, text]) => text.toLowerCase());
  const word = content
    .toLowerCase()
    .match(/\b[a-z]{9,20}\b/g)
    ?.find(
      (candidate) =>
        !frontmatter.includes(candidate) &&
        others.every((text) => !text.includes(candidate)),
    );
  if (!word) throw new Error(`${section}/${slug} has no word of its own to search for`);
  return word;
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
