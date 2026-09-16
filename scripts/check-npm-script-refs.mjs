#!/usr/bin/env node
// Guardrail against a doc telling someone to run `npm run <script>` for a
// script that's been renamed or removed from package.json — the same
// "fact owned by code, restated by hand in a doc" drift class as
// check-design-tokens.mjs, applied to every markdown file in the repo.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);
const SCRIPT_REF = /npm run ([a-zA-Z0-9:_-]+)/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path, files);
    } else if (extname(path) === '.md') {
      files.push(path);
    }
  }
  return files;
}

const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const validScripts = new Set(Object.keys(scripts));

const violations = [];
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8');
  let match;
  while ((match = SCRIPT_REF.exec(content))) {
    const name = match[1];
    if (!validScripts.has(name)) {
      violations.push({ file, name });
    }
  }
}

if (violations.length > 0) {
  console.error('Doc(s) reference an npm script that does not exist in package.json:\n');
  for (const { file, name } of violations) {
    console.error(`  ${file} — "npm run ${name}"`);
  }
  console.error(`\nValid scripts: ${[...validScripts].join(', ')}`);
  process.exit(1);
}

console.log(
  'Every "npm run <script>" reference in the docs matches an actual package.json script.',
);
