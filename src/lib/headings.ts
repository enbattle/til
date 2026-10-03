import remarkRehype from 'remark-rehype';
import { markdownParser } from './markdown.mjs';

/**
 * The in-page anchor slug for a heading's text: lowercase, with every run of
 * characters other than a-z and 0-9 collapsed to one hyphen. A heading with no
 * ASCII letters or digits (`日本語`, `—`) gets `section`, so an id is never
 * empty; `createHeadingIds` then numbers repeats (`section`, `section-1`).
 */
export function headingId(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * A fresh id numbering for one markdown body: each call returns
 * `headingId(text)` the first time a slug appears, then `-1`, `-2`, ... for
 * later headings with the same slug (`notes`, `notes-1`), so every heading in
 * the body gets a distinct id.
 */
export function createHeadingIds(): (text: string) => string {
  const used = new Set<string>();
  return (text) => {
    const base = headingId(text);
    let id = base;
    for (let n = 1; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
}

/** The parts of a hast (HTML syntax tree) node the heading passes and
 * `MarkdownRenderer`'s overrides read. */
export interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** A hast node's text content, all descendants' text joined. */
export function hastText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(hastText).join('');
}

/**
 * A rehype plugin that gives every h1 and h2 an id from its rendered text,
 * numbered in document order with `createHeadingIds` (duplicates become
 * `notes`, `notes-1`). `MarkdownRenderer` runs it on the tree it renders, and
 * `h2Headings` runs it on the same tree for the "On this page" nav, so the two
 * can't disagree. It runs per render, so the numbering is fresh per body.
 */
export function rehypeHeadingIds() {
  return (tree: HastNode) => {
    const nextId = createHeadingIds();
    const visit = (node: HastNode) => {
      if (node.type === 'element' && (node.tagName === 'h1' || node.tagName === 'h2')) {
        node.properties = { ...node.properties, id: nextId(hastText(node)) };
        return;
      }
      node.children?.forEach(visit);
    };
    visit(tree);
  };
}

/**
 * The same markdown -> HTML-tree pipeline `MarkdownRenderer` renders through
 * (react-markdown is remark-parse + remark-gfm + remark-rehype, with
 * `allowDangerousHtml` as react-markdown sets it), plus the heading ids.
 */
const processor = markdownParser()
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeHeadingIds);

/**
 * The "On this page" entries of a markdown body: every level-2 heading as it
 * renders (ATX `##` or setext `---`, anywhere the renderer puts one, with
 * inline markdown and entity references resolved), in order, with the id
 * `MarkdownRenderer` gives it. It parses with the renderer's own markdown
 * stack and heading-id pass, so it can't drift from the rendered ids. Level-1
 * headings (which the renderer shows as h2s too) take part in the numbering
 * but aren't listed.
 */
export function h2Headings(body: string): { text: string; id: string }[] {
  const tree = processor.runSync(processor.parse(body)) as unknown as HastNode;
  const headings: { text: string; id: string }[] = [];
  const visit = (node: HastNode) => {
    if (node.type === 'element' && node.tagName === 'h2') {
      headings.push({ text: hastText(node).trim(), id: String(node.properties?.id) });
      return;
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return headings;
}
