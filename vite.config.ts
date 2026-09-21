/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './src/lib/frontmatter.ts';

/**
 * `import meta from './topic.md?meta'` resolves to just that file's
 * frontmatter as a JSON object, so the app can list every topic (sidebar,
 * cards, sort order) without bundling any topic body. Bodies come in
 * separately through a lazy `?raw` glob (see `src/lib/content.ts`). Uses the
 * same `parseFrontmatter` as the runtime, so the flat `key: value` contract is
 * unchanged. Vitest reuses these plugins, so tests see the same module.
 */
function markdownMeta(): Plugin {
  return {
    name: 'markdown-meta',
    enforce: 'pre',
    load(id) {
      const [file, query = ''] = id.split('?');
      if (!file.endsWith('.md') || !new URLSearchParams(query).has('meta')) return null;
      this.addWatchFile(file);
      const { data } = parseFrontmatter(readFileSync(file, 'utf8'));
      return `export default ${JSON.stringify(data)};`;
    },
  };
}

export default defineConfig({
  plugins: [markdownMeta(), react(), tailwindcss()],
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
  },
});
