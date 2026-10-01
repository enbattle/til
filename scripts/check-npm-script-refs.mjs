#!/usr/bin/env node
// Guardrail against a doc telling someone to run `npm run <script>` for a
// script that's been renamed or removed from package.json — the same
// "fact owned by code, restated by hand in a doc" drift class as
// check-design-tokens.mjs, applied to every markdown file in the repo.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, ROOT } from './lib.mjs';

const SCRIPT_REF = /npm run ([a-zA-Z0-9:_-]+)/g;

const { scripts } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const validScripts = new Set(Object.keys(scripts));

const violations = [];
// Every markdown file git sees: node_modules and dist are .gitignored, and an
// agent worktree (a full repo copy, checked in its own run) is a nested repo,
// which `git ls-files -o` lists as one directory entry and never walks into.
for (const file of listFiles({ ext: '.md' })) {
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
