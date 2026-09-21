/// <reference types="vite/client" />

// Frontmatter of a markdown file as a flat object, produced by the
// `markdownMeta` plugin in `vite.config.ts`.
declare module '*.md?meta' {
  const meta: Record<string, string>;
  export default meta;
}
