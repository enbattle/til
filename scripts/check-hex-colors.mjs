#!/usr/bin/env node
// Guardrail for docs/DESIGN.md's "every color is a CSS custom property...
// never a raw hex value" rule. Component code referencing a raw hex color
// bypasses the light/dark theme tokens in src/index.css, so this fails CI
// instead of relying on review to catch it — the same "convert a
// documented convention into a hard check" reasoning as `npm run size`.
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { isMain, listFiles, ROOT } from './lib.mjs';

// `.d2` diagram sources aren't scanned here: check:diagrams already rejects a
// hex color (or any color style key) in them, where `#` also starts comments.
// `.mjs` covers src/lib/markdown.mjs, which ships to the browser.
const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.mjs', '.css'];
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;

/** Each raw hex color in app code under `root`'s src/, as `file:line — colors`. */
export function hexColorProblems(root = ROOT) {
  const src = join(root, 'src');
  // Token definitions legitimately live in src/index.css; published prose
  // under src/content/ isn't app code.
  const excludedFile = join(src, 'index.css');
  const excludedDir = join(src, 'content') + sep;
  const problems = [];
  for (const file of listFiles({ root, under: 'src', ext: SCANNED_EXTENSIONS })) {
    if (file === excludedFile || file.startsWith(excludedDir)) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        const matches = line.match(HEX_COLOR);
        if (matches) problems.push(`${file}:${i + 1} — ${matches.join(', ')}`);
      });
  }
  return problems;
}

if (isMain(import.meta.url)) {
  const problems = hexColorProblems();
  if (problems.length > 0) {
    console.error(
      'Raw hex color(s) found outside src/index.css — use a CSS custom property token instead (see docs/DESIGN.md):\n',
    );
    for (const problem of problems) console.error(`  ${problem}`);
    console.error(
      '\nIf this is a legitimate new token, add it to src/index.css and reference the token, not the literal.',
    );
    process.exit(1);
  }
  console.log('No raw hex colors found outside src/index.css.');
}
