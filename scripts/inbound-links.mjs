#!/usr/bin/env node
// Lists every link to one catalog topic, so a rewrite keeps what other pages
// link in for (docs/specs/drift-and-rewrite-guards.md):
//
//   npm run links:inbound -- <section>/<slug>
//
// Reads every markdown body under src/content/**, src/system-design/
// case-studies/*.md and src/dsa/entries/*.md with the site's markdown parser,
// and prints one line per link whose path is /<section>/<slug>, or an old path
// src/content/redirects.ts maps to it (query ignored, #anchor kept). Inline
// links count, and so do reference-style ones (`[text][ref]`, `[ref][]`),
// resolved through their definition and reported at the line of their use:
//
//   <file>:<line>  <#anchor or —>  "<sentence holding the link>"
//
// Prints "no inbound links" when there are none. Exits 2 with a usage message
// when the argument is missing or names no topic (matched with exact case).
// A tool, not a verify step.
// The root is the repository, or INBOUND_LINKS_ROOT.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { markdownParser } from '../src/lib/markdown.mjs';
import { listFiles, ROOT as REPO_ROOT } from './lib.mjs';

// A site-relative link to one topic: /<section>/<slug>, then ?query, #anchor.
const TOPIC_LINK = /^\/([^/?#]+)\/([^/?#]+)(?:\?[^#]*)?(#.*)?$/;
// Blocks whose text a link's sentence is taken from, nearest first.
const SENTENCE_BLOCKS = new Set(['paragraph', 'listItem', 'heading', 'tableCell']);
const UNREAD = new Set(['code', 'html', 'definition', 'image', 'imageReference']);

/** `text` with its frontmatter blanked out, line numbers kept. */
function withoutFrontmatter(text) {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/.exec(text);
  return match ? match[0].replace(/[^\n]/g, '') + text.slice(match[0].length) : text;
}

/** The plain text of `block`, and where `target` starts and ends in it. */
function plainText(block, target) {
  let text = '';
  let start = -1;
  let end = -1;
  const visit = (node) => {
    if (UNREAD.has(node.type)) return;
    if (node === target) start = text.length;
    if (node.type === 'break') text += ' ';
    else if (node.type === 'text' || node.type === 'inlineCode') text += node.value;
    else node.children?.forEach(visit);
    if (node === target) end = text.length;
  };
  visit(block);
  return { text, start, end };
}

/** The sentence of `block`'s plain text that holds `link`, on one line. */
function sentenceOf(block, link) {
  const { text, start, end } = plainText(block, link);
  let from = 0;
  for (const match of text.slice(0, start).matchAll(/[.!?]["')\]]*\s+/g)) {
    from = match.index + match[0].length;
  }
  const stop = /[.!?]["')\]]*(?=\s|$)/.exec(text.slice(end));
  const to = stop ? end + stop.index + stop[0].length : text.length;
  return text.slice(from, to).replace(/\s+/g, ' ').trim();
}

/**
 * Every link (inline or reference-style) to `topic` (`<section>/<slug>`) in `bodies` (a list of
 * `{ file, text }`, whole markdown files), in body order and then document
 * order: `{ file, line, anchor, sentence }`, where `anchor` is the `#fragment`
 * or null. A link to an old path `redirects` maps to `topic` counts too.
 */
export function inboundLinks(topic, bodies, redirects = {}) {
  const targets = new Set([topic]);
  for (const [from, to] of Object.entries(redirects)) if (to === topic) targets.add(from);
  const links = [];
  for (const { file, text } of bodies) {
    const tree = markdownParser().parse(withoutFrontmatter(text));
    // Reference-style links (`[text][ref]`, `[ref][]`) resolve through the
    // first definition of their label, as the site's urlsOf does.
    const definitions = new Map();
    const collect = (node) => {
      if (node.type === 'definition' && !definitions.has(node.identifier)) {
        definitions.set(node.identifier, node.url);
      }
      node.children?.forEach(collect);
    };
    collect(tree);
    const visit = (node, blocks) => {
      if (UNREAD.has(node.type)) return;
      const url =
        node.type === 'link'
          ? node.url
          : node.type === 'linkReference'
            ? definitions.get(node.identifier)
            : undefined;
      if (url !== undefined) {
        const match = TOPIC_LINK.exec(url);
        if (match && targets.has(`${match[1]}/${match[2]}`)) {
          const block = blocks.at(-1) ?? node;
          links.push({
            file,
            line: node.position.start.line,
            anchor: match[3] ?? null,
            sentence: sentenceOf(block, node),
          });
        }
      }
      const inner = SENTENCE_BLOCKS.has(node.type) ? [...blocks, node] : blocks;
      node.children?.forEach((child) => visit(child, inner));
    };
    visit(tree, []);
  }
  return links;
}

/** The REDIRECTS map in `root`'s src/content/redirects.ts, or {} without one. */
async function readRedirects(root) {
  const path = join(root, 'src/content/redirects.ts');
  if (!existsSync(path)) return {};
  return (await import(pathToFileURL(path).href)).REDIRECTS ?? {};
}

/** Whether `root` has the topic file src/content/<section>/<slug>.md, with
 * exact case: existsSync ignores case on Windows and macOS, so this compares
 * against directory listings instead. */
function topicExists(root, topic) {
  const [section, slug] = topic.split('/');
  const content = join(root, 'src/content');
  try {
    return (
      readdirSync(content).includes(section) &&
      readdirSync(join(content, section)).includes(`${slug}.md`)
    );
  } catch {
    return false;
  }
}

async function main() {
  const root = process.env.INBOUND_LINKS_ROOT ?? REPO_ROOT;
  const topic = process.argv[2];
  if (
    !topic ||
    !/^[^/\\]+\/[^/\\]+$/.test(topic) ||
    topic.split('/').includes('..') ||
    !topicExists(root, topic)
  ) {
    console.error(
      `${topic ? `No topic ${topic}. ` : ''}Usage: npm run links:inbound -- <section>/<slug>`,
    );
    process.exit(2);
  }
  const rel = (full) => relative(root, full).split('\\').join('/');
  const files = [
    ...listFiles({ root, under: 'src/content', ext: '.md' }),
    ...listFiles({ root, under: 'src/system-design/case-studies', ext: '.md' }).filter(
      (full) => dirname(rel(full)) === 'src/system-design/case-studies',
    ),
    ...listFiles({ root, under: 'src/dsa/entries', ext: '.md' }).filter(
      (full) => dirname(rel(full)) === 'src/dsa/entries',
    ),
  ];
  const bodies = files.map((full) => ({
    file: rel(full),
    text: readFileSync(full, 'utf8'),
  }));
  const links = inboundLinks(topic, bodies, await readRedirects(root));
  if (links.length === 0) {
    console.log(`no inbound links to ${topic}`);
    return;
  }
  for (const { file, line, anchor, sentence } of links) {
    console.log(`${file}:${line}  ${anchor ?? '—'}  "${sentence}"`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
