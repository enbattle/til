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
