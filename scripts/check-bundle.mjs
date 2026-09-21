#!/usr/bin/env node
// Guardrail for the lazy-loaded topic bodies (docs/specs/lazy-content-loading.md).
// Topic bodies are meant to ship as their own small chunks, fetched when a topic
// is opened or search is first used. Nothing in `npm run size` notices if a
// change quietly inlines them back into the main chunk (it only notices once
// the total has grown past the limit), so this checks it directly: run it
// after `npm run build`.
//
// For every topic file it takes one sentence-length fragment from the body and
// fails if that fragment is in the main chunk (`dist/assets/index-*.js`), if it
// is in no other chunk at all (a body that went missing), or if the chunk that
// holds it also holds another topic's fragment (bodies grouped into one lazy
// chunk, which would make opening any topic download every body), or if any
// other chunk pulls a body chunk in with a static import (so it would load
// whenever that chunk does, e.g. on every topic view). Only a dynamic
// `import()` may reach a body chunk. Question bodies are intentionally eager,
// so `src/system-design/` isn't checked.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONTENT = join(ROOT, 'src', 'content');
const ASSETS = join(ROOT, 'dist', 'assets');
const MIN_LINE = 40;
const MIN_FRAGMENT = 30;
// Markdown reaches the bundle as a JS string, so quotes, backslashes, backticks,
// `$` and non-ASCII characters may be escaped or re-encoded. Searching only for
// a run of characters that no string encoding rewrites sidesteps all of that.
const SAFE_RUN = /[A-Za-z0-9 ,.;:()-]+/g;

function walk(dir, ext, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, ext, files);
    } else if (extname(path) === ext) {
      files.push(path);
    }
  }
  return files;
}

/** The body of a markdown file: everything after a leading `---` frontmatter block. */
function bodyOf(raw) {
  const lines = raw.replace(/^﻿/, '').split('\n');
  if (lines[0]?.trim() !== '---') return lines;
  const closing = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  return closing === -1 ? lines : lines.slice(closing + 1);
}

/**
 * The first prose line of at least MIN_LINE characters (skipping code fences,
 * their contents, and lines that are only a heading, list or quote marker),
 * reduced to its longest run of escape-proof characters.
 */
function fragmentFor(raw) {
  let inFence = false;
  for (const line of bodyOf(raw)) {
    const text = line.trim();
    if (text.startsWith('```') || text.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || text.length < MIN_LINE) continue;
    if (/^(#{1,6}|[-*+>|]|\d+[.)])\s*$/.test(text)) continue;
    const longest = (text.match(SAFE_RUN) ?? []).reduce(
      (best, run) => (run.trim().length > best.length ? run.trim() : best),
      '',
    );
    if (longest.length >= MIN_FRAGMENT) return longest;
  }
  return null;
}

if (!existsSync(ASSETS)) {
  console.error('dist/assets does not exist: run `npm run build` first.');
  process.exit(1);
}

const chunks = readdirSync(ASSETS)
  .filter((name) => name.endsWith('.js'))
  .map((name) => ({ name, text: readFileSync(join(ASSETS, name), 'utf8') }));
const mainChunks = chunks.filter((chunk) => /^index-.*\.js$/.test(chunk.name));
const otherChunks = chunks.filter((chunk) => !mainChunks.includes(chunk));

if (mainChunks.length === 0) {
  console.error(
    'No dist/assets/index-*.js main chunk found: has the build layout changed?',
  );
  process.exit(1);
}

const violations = [];
const checks = [];
const chunkTopics = new Map();
for (const file of walk(CONTENT, '.md')) {
  const name = relative(ROOT, file);
  const fragment = fragmentFor(readFileSync(file, 'utf8'));
  if (!fragment) {
    violations.push(
      `${name}: no line qualified for the check (needs a prose line of ${MIN_LINE}+ characters with a ${MIN_FRAGMENT}+ character run of plain text); this does not mean the body is missing, but this file is not being verified`,
    );
    continue;
  }
  checks.push({ name, fragment });
}

for (const { name, fragment } of checks) {
  if (mainChunks.some((chunk) => chunk.text.includes(fragment))) {
    violations.push(`${name}: body text is inlined in the main chunk ("${fragment}")`);
    continue;
  }
  const holders = otherChunks.filter((chunk) => chunk.text.includes(fragment));
  if (holders.length === 0) {
    violations.push(
      `${name}: body text is in no chunk under dist/assets ("${fragment}")`,
    );
    continue;
  }
  for (const chunk of holders) {
    chunkTopics.set(chunk.name, [...(chunkTopics.get(chunk.name) ?? []), name]);
  }
}
// One chunk per topic: a chunk that holds one topic's body must hold no other's.
for (const [chunkName, names] of chunkTopics) {
  if (names.length > 1) {
    violations.push(
      `${chunkName}: holds the bodies of ${names.length} topics (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', ...' : ''}); each topic body must be its own chunk`,
    );
  }
}
// Only a dynamic `import()` may reach a body chunk. A static `import ... from
// "./x.js"` or side-effect `import "./x.js"` would load it together with the
// importing chunk, so a chunk loaded on every topic view (the markdown
// renderer) or the main chunk could drag bodies in without inlining them.
// `import("./x.js")` has a parenthesis before the quote, so it doesn't match.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const [bodyChunk, names] of chunkTopics) {
  const staticImport = new RegExp(
    `(?:from|import)\\s*["'\`]\\./${escapeRegExp(bodyChunk)}["'\`]`,
  );
  for (const chunk of chunks) {
    if (chunk.name === bodyChunk) continue;
    if (staticImport.test(chunk.text)) {
      violations.push(
        `${chunk.name}: statically imports the body chunk ${bodyChunk} (${names[0]}); a body must only be reachable through a dynamic import()`,
      );
    }
  }
}
const checked = checks.length;

if (violations.length > 0) {
  console.error('Topic bodies are not split out of the main chunk as expected:\n');
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    '\nTopic bodies must be loaded through a lazy import.meta.glob with one chunk per topic (see src/lib/content.ts), not eagerly, grouped, or imported statically.',
  );
  process.exit(1);
}

console.log(
  `All ${checked} topic bodies are outside the main chunk, each in its own lazy chunk, reached only by dynamic import.`,
);
