#!/usr/bin/env node
// Guardrail for docs/DESIGN.md's "every color is a CSS custom property...
// never a raw hex value" rule. Component code referencing a raw hex color
// bypasses the light/dark theme tokens in src/index.css, so this fails CI
// instead of relying on review to catch it — the same "convert a
// documented convention into a hard check" reasoning as `npm run size`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');

// Token definitions legitimately live here; everything else under src/ is
// app code that should reference a token, not a literal.
const EXCLUDED_FILES = new Set([join(SRC, 'index.css')]);
// Published prose, not app code — a topic's body text isn't held to this.
const EXCLUDED_DIRS = new Set([join(SRC, 'content')]);
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (EXCLUDED_DIRS.has(path)) continue;
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path, files);
    } else if (SCANNED_EXTENSIONS.has(extname(path)) && !EXCLUDED_FILES.has(path)) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const file of walk(SRC)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    const matches = line.match(HEX_COLOR);
    if (matches) {
      violations.push({ file, line: i + 1, matches });
    }
  });
}

if (violations.length > 0) {
  console.error(
    'Raw hex color(s) found outside src/index.css — use a CSS custom property token instead (see docs/DESIGN.md):\n',
  );
  for (const { file, line, matches } of violations) {
    console.error(`  ${file}:${line} — ${matches.join(', ')}`);
  }
  console.error(
    '\nIf this is a legitimate new token, add it to src/index.css and reference the token, not the literal.',
  );
  process.exit(1);
}

console.log('No raw hex colors found outside src/index.css.');
