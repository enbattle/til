/**
 * One topic write-up: a single markdown file under `src/content/<section>/`.
 * This is the metadata only; the markdown body is loaded on demand
 * (`loadTopicBody` in `src/lib/content.ts`) so it isn't in the main bundle.
 */
export interface Topic {
  /** Slug of the folder this topic lives in — see `src/content/registry.ts`. */
  section: string;
  /** Filename without extension, e.g. `git-worktrees`. */
  slug: string;
  title: string;
  /** One plain-text sentence shown on cards and in search results. */
  summary: string;
  /** ISO date (`YYYY-MM-DD`) the topic was written. */
  date: string;
}

/**
 * One System Design case study: a single markdown file under
 * `src/system-design/case-studies/`. It lives outside `src/content/` so the
 * catalog's section-per-folder rule (and `registry.test.ts`) never sees it.
 * Metadata only, like `Topic`: the body loads on demand
 * (`loadCaseStudyBody` in `src/lib/system-design.ts`).
 */
export interface CaseStudy {
  /** Filename without extension, kebab-case, e.g. `url-shortener`. */
  slug: string;
  /** e.g. "Design a URL Shortener (like TinyURL)". */
  title: string;
  /** One plain-text sentence shown on the landing page and in search results. */
  summary: string;
  /** ISO date (`YYYY-MM-DD`) the case study was written. */
  date: string;
  /** Position in the case-study list; a positive integer, unique across case studies. */
  order: number;
  /** Words a reader reads in the body (`proseWordCount`), counted at build
   * time; drives the "N min read" label. */
  words: number;
}

/** What a DSA entry teaches; it picks the entry's heading template
 * (docs/dsa.md). */
export type DsaKind = 'data-structure' | 'pattern' | 'algorithm';

/**
 * One DSA entry: a single markdown file under `src/dsa/entries/`, with its
 * tested code beside it under `src/dsa/code/<slug>/`. Metadata only, like
 * `Topic`: the body loads on demand (`loadDsaEntryBody` in `src/lib/dsa.ts`).
 */
export interface DsaEntry {
  /** Filename without extension, kebab-case, e.g. `binary-search`. */
  slug: string;
  title: string;
  /** One plain-text sentence shown on the landing page and in search results. */
  summary: string;
  /** ISO date (`YYYY-MM-DD`) the entry was written. */
  date: string;
  kind: DsaKind;
  /** Words a reader reads in the body (`proseWordCount`), counted at build
   * time; drives the "N min read" label. */
  words: number;
}

/** One kind's entries, as the DSA nav and landing page group them
 * (`groupDsaEntries` in `src/lib/dsa.ts`). */
export interface DsaGroup {
  kind: DsaKind;
  /** The group's plural heading, e.g. "Data structures". */
  heading: string;
  entries: DsaEntry[];
}
