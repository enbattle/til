#!/usr/bin/env node
// Guardrail for docs/NON_NEGOTIABLES.md #6: markdown never renders raw HTML,
// and `dangerouslySetInnerHTML` only takes output from an escaping source.
// Fails if a dependency that turns on raw HTML in markdown is installed, or
// if `dangerouslySetInnerHTML` appears in app code outside the one component
// allowed to use it (CodeBlock.tsx, which passes it Shiki's escaped output).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const RAW_HTML_PACKAGES = ['rehype-raw', 'rehype-dom-raw'];
const ALLOWED = new Set(['src/components/CodeBlock.tsx']);
const violations = [];

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'devDependencies']) {
  for (const name of RAW_HTML_PACKAGES) {
    if (pkg[field]?.[name])
      violations.push(`package.json ${field}: ${name} renders raw HTML`);
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.[jt]sx?$/.test(entry) && !/\.test\.[jt]sx?$/.test(entry)) {
      const rel = relative(ROOT, path).split('\\').join('/');
      if (
        !ALLOWED.has(rel) &&
        readFileSync(path, 'utf8').includes('dangerouslySetInnerHTML')
      ) {
        violations.push(
          `${rel}: dangerouslySetInnerHTML outside ${[...ALLOWED].join(', ')}`,
        );
      }
    }
  }
}
walk(join(ROOT, 'src'));

if (violations.length > 0) {
  console.error('Raw HTML rendering found (docs/NON_NEGOTIABLES.md #6):\n');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('No raw HTML rendering outside CodeBlock.tsx.');
