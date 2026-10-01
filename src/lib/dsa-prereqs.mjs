// Prerequisite links of a DSA entry (docs/dsa.md). JavaScript with its types in
// dsa-prereqs.d.mts, like diagram-refs.mjs, so `vite.config.ts` can import it
// for the build-time `?dsaPrereqs` query and the tests see the same code.
import { markdownParser } from './diagram-refs.mjs';

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
 * links are ignored. The body is parsed with the site's own markdown stack, so
 * an example link inside code is not a link, and a reference-style link counts
 * when its definition exists.
 */
export function dsaPrerequisites(markdown) {
  const tree = markdownParser().parse(markdown);
  const definitions = new Map();
  const collectDefinitions = (node) => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
    node.children?.forEach(collectDefinitions);
  };
  collectDefinitions(tree);

  const slugs = [];
  const visit = (node) => {
    const url =
      node.type === 'link'
        ? node.url
        : node.type === 'linkReference'
          ? definitions.get(node.identifier)
          : undefined;
    const slug = url === undefined ? undefined : DSA_LINK.exec(url)?.[1];
    if (slug && !slugs.includes(slug)) slugs.push(slug);
    node.children?.forEach(visit);
  };

  let inSection = false;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth <= 2) {
      inSection = node.depth === 2 && textOf(node).trim() === 'Prerequisites';
    } else if (inSection) {
      visit(node);
    }
  }
  return slugs;
}
