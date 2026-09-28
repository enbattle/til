/// <reference types="vite/client" />

// Frontmatter of a markdown file as a flat object, produced by the
// `markdownMeta` plugin in `vite.config.ts`.
declare module '*.md?meta' {
  const meta: Record<string, string>;
  export default meta;
}

// Catalog topic links in a markdown file's body, first appearance first, also
// produced by the `markdownMeta` plugin.
declare module '*.md?links' {
  const links: { section: string; slug: string }[];
  export default links;
}

// Each rendered diagram's intrinsic size, keyed `<case>/<name>`, produced by
// the `diagramSizes` plugin from `public/diagrams/manifest.json`.
declare module 'virtual:diagram-sizes' {
  const sizes: Record<string, { width: number; height: number }>;
  export default sizes;
}
