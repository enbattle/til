#!/usr/bin/env node
// Guardrail for docs/pipeline-log.md (column definitions in its header): every
// row has the eight columns in their format, and a run that had gate failures
// or findings can't close with a bare "nothing to change" retro, the rule a
// self-graded retro would otherwise break silently. Rows are parsed by cell
// because Prettier re-pads the table whenever a row is added.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// An optional path argument lets the tests point it at a fixture.
const LOG =
  process.argv[2] ?? fileURLToPath(new URL('../docs/pipeline-log.md', import.meta.url));
const HEADER =
  'Date|Run|Gate failures|Findings (H/M/L, pre)|Fix rounds|Agents|Retro|Escaped defect';
// Each column's format, by position; the last (Escaped defect) is free text.
const FORMATS = [
  ['Date must be YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/],
  [
    'Run must be "/feature <spec>", "add-topic <topic>", "add-case-study <path>" or "add-dsa-entry <path>"',
    /^(\/feature|add-topic|add-case-study|add-dsa-entry) \S/,
  ],
  ['Gate failures must start with a count', /^\d+\b/],
  ['Findings must look like "H/M/L" or "H/M/L, pre:N"', /^\d+\/\d+\/\d+(, pre:\d+)?$/],
  [
    'Fix rounds must be 0, 1, 2 or "N (user-authorized)" for N of 3 or more',
    /^([0-2]|([3-9]|[1-9]\d+) \(user-authorized\))$/,
  ],
  ['Agents must be a positive integer or "—"', /^([1-9]\d*|—)$/],
  ['Retro must not be empty', /\S/],
];

const cells = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.trim());
const rows = readFileSync(LOG, 'utf8')
  .split(/\r?\n/)
  .filter((line) => line.trim().startsWith('|'));
const violations = [];
if (rows.length < 2 || cells(rows[0]).join('|') !== HEADER) {
  violations.push(
    `table header not found; expected the columns: ${HEADER.replaceAll('|', ' | ')}`,
  );
}
for (const line of rows.slice(2)) {
  const row = cells(line);
  const at = `row "${row.slice(0, 2).join(' | ')}"`;
  if (row.length !== 8) {
    violations.push(`${at}: expected 8 cells, found ${row.length}`);
    continue;
  }
  FORMATS.forEach(
    ([message, format], i) => format.test(row[i]) || violations.push(`${at}: ${message}`),
  );
  const [, , gates, findings, , , retro] = row;
  const bare = retro.toLowerCase().replace(/[\s.,;:!—–-]+/g, ' ');
  const friction = parseInt(gates, 10) > 0 || /[1-9]/.test(findings.split(',')[0]);
  if (friction && bare.trim() === 'nothing to change') {
    violations.push(
      `${at}: the run had gate failures or findings, so the Retro must say why none called for a change`,
    );
  }
}

if (violations.length > 0) {
  console.error('docs/pipeline-log.md has problems:\n');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('docs/pipeline-log.md rows are well-formed.');
