// What the site reads out of a markdown body, parsed with the site's own
// markdown stack: diagram images, catalog and case-study links, DSA
// prerequisites. Shared by the app (MarkdownRenderer, Diagram, headings.ts),
// `vite.config.ts` (the build-time `?links`, `?dsaPrereqs` and `?words` queries) and
// scripts/check-diagrams.mjs, which runs under plain Node and can't import a
// `.ts` module, so this is JavaScript with its types in markdown.d.mts.
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/**
 * The markdown parser the site renders with: react-markdown is remark-parse
 * plus the remark plugins it's given, and `MarkdownRenderer` gives it
 * remark-gfm. `h2Headings` extends this into the HTML tree; the extractors
 * below read its markdown tree.
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

// Every question below parses the whole body afresh.
function parse(markdown) {
  return markdownParser().parse(markdown);
}

const IMAGES = { inline: 'image', reference: 'imageReference' };
const LINKS = { inline: 'link', reference: 'linkReference' };

/**
 * The URLs of every image or link (`kind`) under `nodes` (default: the whole
 * tree), in document order: inline ones (`[text](url)`, with any title, angle
 * brackets or wrapped text) and references whose label has a matching
 * definition anywhere in `tree` (`[text][ref]` plus `[ref]: url`; the first
 * definition of a label wins). Code (fenced, indented or inline) holds no
 * image or link nodes, so an example there doesn't count.
 */
function urlsOf(tree, kind, nodes = [tree]) {
  const definitions = new Map();
  const collectDefinitions = (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
    node.children?.forEach(collectDefinitions);
  };
  collectDefinitions(tree);

  const urls = [];
  const visit = (node) => {
    if (node.type === kind.inline) urls.push(node.url);
    else if (node.type === kind.reference && definitions.has(node.identifier)) {
      urls.push(definitions.get(node.identifier));
    }
    node.children?.forEach(visit);
  };
  nodes.forEach(visit);
  return urls;
}

/** Every diagram image URL in a markdown body, in document order, as the site
 * would render it (inline and reference-style images; none inside code). */
export function diagramReferences(markdown) {
  return urlsOf(parse(markdown), IMAGES).filter(isDiagramSrc);
}

/** Link destinations in a markdown body, in document order, with any
 * `#fragment` or `?query` dropped. */
function linkPaths(markdown) {
  return urlsOf(parse(markdown), LINKS).map((url) => url.replace(/[#?].*$/, ''));
}

/** Links in `body` whose destination is exactly `/<section>/<slug>`, first
 * appearance first, de-duplicated. Excludes external, single-segment and
 * `/system-design/...` links. Doesn't check that the topic exists. */
export function extractTopicRefs(body) {
  const seen = new Set();
  const refs = [];
  for (const path of linkPaths(body)) {
    const match = /^\/([^/]+)\/([^/]+)$/.exec(path);
    if (!match || match[1] === 'system-design') continue;
    const key = `${match[1]}/${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ section: match[1], slug: match[2] });
  }
  return refs;
}

/** Slugs of `/system-design/<slug>` links in `body` (links to other case
 * studies), first appearance first, de-duplicated. */
export function extractCaseStudyRefs(body) {
  const slugs = [];
  for (const path of linkPaths(body)) {
    const match = /^\/system-design\/([^/]+)$/.exec(path);
    if (match && !slugs.includes(match[1])) slugs.push(match[1]);
  }
  return slugs;
}

/** A link to one DSA entry: `/dsa/<slug>`, optionally with a `#fragment`. */
const DSA_LINK = /^\/dsa\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:#.*)?$/;

function textOf(node) {
  return node.value ?? (node.children ?? []).map(textOf).join('');
}

/**
 * The slugs of the DSA entries linked inside a markdown body's
 * `## Prerequisites` section, in order of first appearance and de-duplicated.
 * The section runs from that heading to the next `#` or `##` heading (a `###`
 * inside it doesn't end it). Only `/dsa/<slug>` links count: a `/dsa/` link
 * elsewhere in the body is a "see also", and catalog, external and landing-page
 * links are ignored.
 */
export function dsaPrerequisites(markdown) {
  const tree = parse(markdown);
  const section = [];
  let inSection = false;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth <= 2) {
      inSection = node.depth === 2 && textOf(node).trim() === 'Prerequisites';
    } else if (inSection) {
      section.push(node);
    }
  }

  const slugs = [];
  for (const url of urlsOf(tree, LINKS, section)) {
    const slug = DSA_LINK.exec(url)?.[1];
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

// Nodes whose text a reader doesn't read as prose: code blocks, raw HTML,
// reference definitions, and images (their alt text).
const UNREAD = new Set(['code', 'html', 'definition', 'image', 'imageReference']);
// Blocks that hold inline text: each one's words are counted on their own, so
// two blocks never merge into one token.
const TEXT_BLOCKS = new Set(['paragraph', 'heading', 'tableCell']);

/** The inline text of `node` as one string: formatting adds no space, so
 * `foo**bar**` stays one token; a hard line break is a space. */
function inlineText(node) {
  if (UNREAD.has(node.type)) return '';
  if (node.type === 'break') return ' ';
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  return (node.children ?? []).map(inlineText).join('');
}

/**
 * The number of words a reader reads in a markdown body: heading, paragraph,
 * list, table, blockquote and link text, and inline code. Code blocks (fenced
 * or indented), image alt text, raw HTML and reference definitions don't
 * count. A word is a whitespace-separated token with a letter or digit in it.
 * Drives the read-time label (the build-time `?words` view) and the structure
 * tests' five-minute budget (docs/specs/five-minute-templates.md).
 */
export function proseWordCount(markdown) {
  let words = 0;
  const visit = (node) => {
    if (UNREAD.has(node.type)) return;
    if (TEXT_BLOCKS.has(node.type)) {
      words += inlineText(node)
        .split(/\s+/)
        .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
      return;
    }
    node.children?.forEach(visit);
  };
  visit(parse(markdown));
  return words;
}
