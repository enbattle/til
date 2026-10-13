import { within } from '@testing-library/react';
import Fuse from 'fuse.js';
import { parseFrontmatter } from '@/lib/frontmatter';
import { FUSE_OPTIONS } from '@/lib/search';

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

/** The case study's markdown body, frontmatter stripped. */
export function caseStudyBody(slug: string): string {
  return parseFrontmatter(rawCaseStudy(slug)).content;
}

/** True when the app's search would match `candidate` against some entry's
 * title or summary. Search is fuzzy, so a near-variant ("discovers" for
 * "discovering") counts, not only an exact substring. */
export function fuzzyMatchesFrontmatter(
  candidate: string,
  entries: { title: string; summary: string }[],
): boolean {
  const fuse = new Fuse(entries, {
    ...FUSE_OPTIONS,
    keys: FUSE_OPTIONS.keys.filter((key) => key.name !== 'body'),
  });
  return fuse.search(candidate).length > 0;
}

/** A word only the body of topic `section/slug` contains: in no other
 * published file and not in its own frontmatter, and with no fuzzy match in
 * any title or summary, so only full-text search can find it, and it ranks
 * first. Read from the files at test time, so a search test pins no published
 * phrase (docs/specs/harness-follow-ups.md, criterion 9). */
export function bodyOnlyWord(section: string, slug: string): string {
  return bodyOnlyWordAt(`/src/content/${section}/${slug}.md`);
}

/** `bodyOnlyWord` for any published file (topic or case study), named by its
 * glob path, e.g. `/src/system-design/case-studies/url-shortener.md`. */
export function bodyOnlyWordAt(path: string): string {
  const files = { ...RAW_TOPICS, ...RAW_CASE_STUDIES };
  const { data, content } = parseFrontmatter(rawAt(files, path, path));
  const frontmatter = Object.values(data).join(' ').toLowerCase();
  const all = Object.entries(files);
  const others = all
    .filter(([other]) => other !== path)
    .map(([, text]) => text.toLowerCase());
  const entries = all.map(([, text]) => {
    const { data: fm } = parseFrontmatter(text);
    return { title: fm.title ?? '', summary: fm.summary ?? '' };
  });
  const word = content
    .toLowerCase()
    .match(/\b[a-z]{9,20}\b/g)
    ?.find(
      (candidate) =>
        !frontmatter.includes(candidate) &&
        others.every((text) => !text.includes(candidate)) &&
        !fuzzyMatchesFrontmatter(candidate, entries),
    );
  if (!word) throw new Error(`${path} has no word of its own to search for`);
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
