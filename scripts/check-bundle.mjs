#!/usr/bin/env node
// Guardrail for the lazy-loaded markdown bodies (docs/specs/lazy-content-loading.md,
// docs/specs/system-design-case-studies.md). Topic and case-study bodies are
// meant to ship as their own small chunks, fetched when the page is opened or
// search is first used. Nothing in `npm run size` notices if a change quietly
// inlines them back into the main chunk (it only notices once the total has
// grown past the limit), so this checks it directly: run it after
// `npm run build`.
//
// For every topic file (src/content/) and case-study file
// (src/system-design/case-studies/) it takes one sentence-length fragment from the body and fails if that fragment is in
// the main chunk (`dist/assets/index-*.js`), if it is in no other chunk at all
// (a body that went missing), or if the chunk that holds it also holds another
// topic's fragment (bodies grouped into one lazy chunk, which would make
// opening any topic download every body), or if any other chunk pulls a body
// chunk in with a static import (so it would load whenever that chunk does,
// e.g. on every topic view). Only a dynamic `import()` may reach a body chunk.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseFrontmatter } from '../src/lib/frontmatter.ts';
import { escapeRegExp, isMain, listFiles, ROOT } from './lib.mjs';

const BODY_DIRS = ['src/content', 'src/system-design/case-studies'];
const MIN_LINE = 40;
const MIN_FRAGMENT = 30;
// Markdown reaches the bundle as a JS string, so quotes, backslashes, backticks,
// `$` and non-ASCII characters may be escaped or re-encoded. Searching only for
// a run of characters that no string encoding rewrites sidesteps all of that.
const SAFE_RUN = /[A-Za-z0-9 ,.;:()-]+/g;

/**
 * The first prose line of at least MIN_LINE characters (skipping code fences,
 * their contents, and lines that are only a heading, list or quote marker),
 * reduced to its longest run of escape-proof characters.
 */
function fragmentFor(raw) {
  let inFence = false;
  for (const line of parseFrontmatter(raw).content.split('\n')) {
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

/**
 * Checks `root`'s markdown bodies against its dist/assets build output:
 * the problems, each naming the file at fault, and how many bodies were
 * checked.
 */
function checkBundle(root) {
  const assets = join(root, 'dist', 'assets');
  if (!existsSync(assets)) {
    return {
      problems: ['dist/assets does not exist: run `npm run build` first.'],
      checked: 0,
    };
  }

  const chunks = readdirSync(assets)
    .filter((name) => name.endsWith('.js'))
    .map((name) => ({ name, text: readFileSync(join(assets, name), 'utf8') }));
  const mainChunks = chunks.filter((chunk) => /^index-.*\.js$/.test(chunk.name));
  const otherChunks = chunks.filter((chunk) => !mainChunks.includes(chunk));

  if (mainChunks.length === 0) {
    return {
      problems: [
        'No dist/assets/index-*.js main chunk found: has the build layout changed?',
      ],
      checked: 0,
    };
  }

  const violations = [];
  const checks = [];
  const chunkTopics = new Map();
  const bodyFiles = BODY_DIRS.filter((under) => existsSync(join(root, under))).flatMap(
    (under) => listFiles({ root, under, ext: '.md' }),
  );
  for (const file of bodyFiles) {
    const name = relative(root, file);
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
  // One chunk per file: a chunk that holds one body must hold no other's.
  for (const [chunkName, names] of chunkTopics) {
    if (names.length > 1) {
      violations.push(
        `${chunkName}: holds the bodies of ${names.length} files (${names.slice(0, 3).join(', ')}${names.length > 3 ? ', ...' : ''}); each body must be its own chunk`,
      );
    }
  }
  // Only a dynamic `import()` may reach a body chunk. A static `import ... from
  // "./x.js"` or side-effect `import "./x.js"` would load it together with the
  // importing chunk, so a chunk loaded on every topic view (the markdown
  // renderer) or the main chunk could drag bodies in without inlining them.
  // `import("./x.js")` has a parenthesis before the quote, so it doesn't match.
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
  return { problems: violations, checked: checks.length };
}

/** The problems with `root`'s build output (default: the repository), each
 * naming the file at fault; `[]` when every body is in its own lazy chunk. */
export function bundleProblems(root = ROOT) {
  return checkBundle(root).problems;
}

if (isMain(import.meta.url)) {
  const { problems, checked } = checkBundle(ROOT);
  if (problems.length > 0) {
    console.error('Markdown bodies are not split out of the main chunk as expected:\n');
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      '\nTopic and case-study bodies must be loaded through a lazy import.meta.glob with one chunk per file (see src/lib/content.ts and src/lib/system-design.ts), not eagerly, grouped, or imported statically.',
    );
    process.exit(1);
  }
  console.log(
    `All ${checked} topic and case-study bodies are outside the main chunk, each in its own lazy chunk, reached only by dynamic import.`,
  );
}
