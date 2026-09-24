#!/usr/bin/env node
// Guardrail for docs/NON_NEGOTIABLES.md #6: markdown never renders raw HTML,
// and `dangerouslySetInnerHTML` only takes output from an escaping source.
// Fails if a dependency that turns on raw HTML in markdown is installed, if
// `dangerouslySetInnerHTML` appears in app code outside the one component
// allowed to use it (CodeBlock.tsx, which passes it Shiki's escaped output),
// or if app code writes HTML through another DOM sink (innerHTML and friends).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT =
  process.env.CHECK_RAW_HTML_ROOT ?? fileURLToPath(new URL('..', import.meta.url));
const RAW_HTML_PACKAGES = ['rehype-raw', 'rehype-dom-raw'];
const ALLOWED = new Set(['src/components/CodeBlock.tsx']);
// DOM APIs that parse a string as HTML; none is needed anywhere in this app.
const RAW_HTML_SINKS =
  /\.(innerHTML|outerHTML)\s*=|\.insertAdjacentHTML\s*\(|document\.write(ln)?\s*\(/;
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
    else if (/\.[jt]sx?$/.test(entry) && !/\.(test|spec)\.[jt]sx?$/.test(entry)) {
      const rel = relative(ROOT, path).split('\\').join('/');
      const source = readFileSync(path, 'utf8');
      if (!ALLOWED.has(rel) && source.includes('dangerouslySetInnerHTML')) {
        violations.push(
          `${rel}: dangerouslySetInnerHTML outside ${[...ALLOWED].join(', ')}`,
        );
      }
      const sink = RAW_HTML_SINKS.exec(source);
      if (sink) violations.push(`${rel}: ${sink[0].trim()} writes raw HTML`);
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
