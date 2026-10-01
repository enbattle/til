/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter, type ParsedMarkdown } from './src/lib/frontmatter.ts';
import { extractTopicRefs } from './src/lib/markdown-links.ts';
import { dsaPrerequisites } from './src/lib/dsa-prereqs.mjs';

/**
 * Build-time views of a markdown file, so the app can list and cross-link
 * content without bundling any body. Bodies come in separately through a lazy
 * `?raw` glob (see `src/lib/content.ts` and `src/lib/system-design.ts`).
 *
 * - `import meta from './topic.md?meta'` resolves to the file's frontmatter as
 *   a JSON object (sidebar, cards, sort order, search titles). It uses the same
 *   `parseFrontmatter` as the runtime, so the flat `key: value` contract is
 *   unchanged.
 * - `import links from './case.md?links'` resolves to the catalog topic links
 *   in the file's body (`[{ section, slug }]`, first appearance first), from
 *   the same `extractTopicRefs` the tests use. Case studies use it for "Go
 *   deeper" and for the topic pages' back-links.
 * - `import prereqs from './entry.md?dsaPrereqs'` resolves to the slugs a DSA
 *   entry links under its `## Prerequisites` heading (`dsaPrerequisites` in
 *   `src/lib/dsa-prereqs.mjs`), which order the DSA list and fill its
 *   "Before this" links.
 *
 * Each view is one entry below, keyed by its query name; adding a view is
 * adding an entry. Vitest reuses these plugins, so tests see the same modules.
 */
const MARKDOWN_VIEWS: Record<string, (file: ParsedMarkdown) => unknown> = {
  meta: ({ data }) => data,
  links: ({ content }) => extractTopicRefs(content),
  dsaPrereqs: ({ content }) => dsaPrerequisites(content),
};

function markdownMeta(): Plugin {
  return {
    name: 'markdown-meta',
    enforce: 'pre',
    load(id) {
      const [file, query = ''] = id.split('?');
      if (!file.endsWith('.md')) return null;
      const params = new URLSearchParams(query);
      const view = Object.keys(MARKDOWN_VIEWS).find((name) => params.has(name));
      if (!view) return null;
      this.addWatchFile(file);
      const value = MARKDOWN_VIEWS[view](parseFrontmatter(readFileSync(file, 'utf8')));
      return `export default ${JSON.stringify(value)};`;
    },
  };
}

const DIAGRAM_MANIFEST = path.resolve(
  import.meta.dirname,
  'public/diagrams/manifest.json',
);
const DIAGRAM_SIZES = 'virtual:diagram-sizes';

/**
 * `import sizes from 'virtual:diagram-sizes'` resolves to each rendered
 * diagram's intrinsic size, keyed `<case>/<name>` (e.g.
 * `url-shortener/architecture`), read from the lock file `npm run diagrams`
 * writes. A diagram's `<img>` takes its width/height from it so the page
 * doesn't shift when the SVG arrives; the rest of the manifest (the source and
 * SVG hashes, and the `$tokens` entry) stays out of the bundle.
 */
function diagramSizes(): Plugin {
  const resolved = `\0${DIAGRAM_SIZES}`;
  return {
    name: 'diagram-sizes',
    resolveId(id) {
      return id === DIAGRAM_SIZES ? resolved : null;
    },
    load(id) {
      if (id !== resolved) return null;
      const sizes: Record<string, { width: number; height: number }> = {};
      if (existsSync(DIAGRAM_MANIFEST)) {
        this.addWatchFile(DIAGRAM_MANIFEST);
        const manifest = JSON.parse(readFileSync(DIAGRAM_MANIFEST, 'utf8')) as Record<
          string,
          { width?: number; height?: number }
        >;
        // Only `<case>/<name>.d2` entries are diagrams; `$tokens` (the colors
        // they were rendered with) is for check:diagrams, not the app.
        for (const [source, { width, height }] of Object.entries(manifest)) {
          if (!source.endsWith('.d2')) continue;
          if (width && height) sizes[source.replace(/\.d2$/, '')] = { width, height };
        }
      }
      return `export default ${JSON.stringify(sizes)};`;
    },
  };
}

export default defineConfig({
  plugins: [markdownMeta(), diagramSizes(), react(), tailwindcss()],
  base: '/til/',
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Tests that render the whole app pay for compiling its lazily loaded routes
    // on first use; on a cold cache that alone can pass the 5s default, which
    // made `verify` (and so the deploy) fail intermittently.
    testTimeout: 15000,
    // Agent worktrees (Claude Code `isolation: 'worktree'`) are full copies of
    // the repo under .claude/worktrees/; their tests are theirs to run.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
});
