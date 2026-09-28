// Shared by the site (MarkdownRenderer, headings.ts) and by
// scripts/check-diagrams.mjs, which runs under plain Node and can't import a
// `.ts` module, so this is JavaScript with its types in diagram-refs.d.mts.
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * The markdown parser the site renders with: react-markdown is remark-parse
 * plus the remark plugins it's given, and `MarkdownRenderer` gives it
 * remark-gfm. `h2Headings` extends this into the HTML tree; the diagram check
 * reads its markdown tree.
 */
export function markdownParser() {
  return unified().use(remarkParse).use(remarkGfm);
}

/** Whether a markdown image URL points at a rendered D2 diagram
 * (`/diagrams/<case>/<name>.svg`), i.e. whether it renders as a `Diagram`. */
export function isDiagramSrc(src) {
  return typeof src === 'string' && /^\/diagrams\/[^?#]+\.svg$/.test(src);
}

/** The diagram a `/diagrams/` image URL names, without the folder or the
 * extension: `/diagrams/url-shortener/architecture.svg` ->
 * `url-shortener/architecture`. */
export function diagramName(src) {
  return src.slice('/diagrams/'.length, -'.svg'.length);
}

/**
 * Every diagram image URL in a markdown body, in document order, as the site
 * would render it: `image` nodes (`![alt](url)`, with any title, angle
 * brackets or wrapped alt text) and `imageReference` nodes whose label has a
 * matching definition (`![alt][ref]` plus `[ref]: url`). Code (fenced,
 * indented or inline) holds no image nodes, so an example there doesn't count.
 */
export function diagramReferences(markdown) {
  const tree = markdownParser().parse(markdown);
  const definitions = new Map();
  const images = [];
  const visit = (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    } else if (node.type === 'image') {
      images.push({ url: node.url });
    } else if (node.type === 'imageReference') {
      images.push({ identifier: node.identifier });
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return images
    .map((image) => image.url ?? definitions.get(image.identifier))
    .filter(isDiagramSrc);
}
