/** One topic write-up: a single markdown file under `src/content/<section>/`. */
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
  /** Markdown body, frontmatter already stripped. */
  body: string;
}

/**
 * One System Design question page: a single markdown file under
 * `src/system-design/questions/`. It lives outside `src/content/` so the
 * catalog's section-per-folder rule (and `registry.test.ts`) never sees it.
 */
export interface Question {
  /** Filename without extension, kebab-case. */
  slug: string;
  /** The question itself, e.g. "What do I do when my database can't keep up with reads?" */
  title: string;
  /** One plain-text sentence shown on the landing page and in search results. */
  summary: string;
  /** ISO date (`YYYY-MM-DD`) the question was written. */
  date: string;
  /** Position in the question list; a positive integer, unique across questions. */
  order: number;
  /** Markdown body, frontmatter already stripped. */
  body: string;
}
