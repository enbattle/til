#!/usr/bin/env node
// Guardrail against docs/DESIGN.md's Tokens table drifting from the actual
// tokens defined in src/index.css — this already happened once (accent-soft
// was added to the CSS but never added to the table). Fails CI if the two
// disagree in either direction: a token missing from the table, a token in
// the table that's no longer in the CSS, or a value that doesn't match.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CSS_PATH = join(ROOT, 'src', 'index.css');
const DESIGN_PATH = join(ROOT, 'docs', 'DESIGN.md');

function extractBlock(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1)
    throw new Error(`Could not find a "${selector} {" block in ${CSS_PATH}`);
  const end = css.indexOf('}', start);
  return css.slice(start, end);
}

function extractTokens(block) {
  const tokens = new Map();
  const pattern = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{3,8});/g;
  let match;
  while ((match = pattern.exec(block))) {
    tokens.set(match[1], match[2]);
  }
  return tokens;
}

const css = readFileSync(CSS_PATH, 'utf8');
const lightTokens = extractTokens(extractBlock(css, ':root'));
const darkTokens = extractTokens(extractBlock(css, '.dark'));

const design = readFileSync(DESIGN_PATH, 'utf8');
const tableTokens = new Map();
const rowPattern =
  /^\|\s*`([a-z-]+)`\s*\|\s*`(#[0-9a-fA-F]{3,8})`\s*\|\s*`(#[0-9a-fA-F]{3,8})`\s*\|$/gm;
let rowMatch;
while ((rowMatch = rowPattern.exec(design))) {
  tableTokens.set(rowMatch[1], { light: rowMatch[2], dark: rowMatch[3] });
}

const errors = [];

for (const [name, lightValue] of lightTokens) {
  const row = tableTokens.get(name);
  const darkValue = darkTokens.get(name);
  if (!row) {
    errors.push(
      `Token \`${name}\` is defined in src/index.css but missing from docs/DESIGN.md's table.`,
    );
    continue;
  }
  if (row.light !== lightValue) {
    errors.push(
      `Token \`${name}\` light value mismatch: CSS has ${lightValue}, docs/DESIGN.md has ${row.light}.`,
    );
  }
  if (row.dark !== darkValue) {
    errors.push(
      `Token \`${name}\` dark value mismatch: CSS has ${darkValue}, docs/DESIGN.md has ${row.dark}.`,
    );
  }
}

for (const name of tableTokens.keys()) {
  if (!lightTokens.has(name)) {
    errors.push(
      `docs/DESIGN.md documents \`${name}\`, but src/index.css no longer defines --color-${name}.`,
    );
  }
}

if (errors.length > 0) {
  console.error("docs/DESIGN.md's Tokens table is out of sync with src/index.css:\n");
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log("docs/DESIGN.md's Tokens table matches src/index.css.");
