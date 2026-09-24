#!/usr/bin/env node
// Guardrail for docs/pipeline-log.md: every row is well-formed, and a run that
// had gate failures or findings can't close with a bare "nothing to change"
// retro. That second rule is the one self-graded retros would otherwise break
// silently; see the log's header for the column definitions.
//
// Rows are parsed by cell, not by raw text, because Prettier (part of
// `verify`) re-pads the table's columns whenever a row is added.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOG = fileURLToPath(new URL('../docs/pipeline-log.md', import.meta.url));
const COLUMNS = [
  'Date',
  'Run',
  'Gate failures',
  'Findings (H/M/L, pre)',
  'Fix rounds',
  'Retro',
  'Escaped defect',
];

// Splits a `| a | b |` row into trimmed cells, honoring `\|` escapes.
function cells(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isValidDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

const lines = readFileSync(LOG, 'utf8').split(/\r?\n/);
const isRow = (line) => line.trim().startsWith('|');
const headerAt = lines.findIndex(
  (line) => isRow(line) && cells(line).join('\u0000') === COLUMNS.join('\u0000'),
);
const violations = [];

if (headerAt === -1) {
  violations.push(`table header not found; expected the columns: ${COLUMNS.join(' | ')}`);
} else {
  const separator = lines[headerAt + 1] ?? '';
  if (!/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(separator)) {
    violations.push(`line ${headerAt + 2}: expected the table's separator row`);
  }
  let tableEnded = false;
  for (let i = headerAt + 2; i < lines.length; i++) {
    const at = `line ${i + 1}`;
    if (!isRow(lines[i])) {
      if (lines[i].trim() !== '') tableEnded = true;
      else if (lines.slice(i).some(isRow)) tableEnded = true;
      continue;
    }
    if (tableEnded) {
      violations.push(`${at}: a table row after the table ended; keep rows contiguous`);
      continue;
    }
    const row = cells(lines[i]);
    if (row.length !== COLUMNS.length) {
      violations.push(`${at}: expected ${COLUMNS.length} cells, found ${row.length}`);
      continue;
    }
    const [date, run, gates, findings, rounds, retro] = row;
    if (!isValidDate(date)) violations.push(`${at}: Date must be a real YYYY-MM-DD date`);
    if (!/^(\/feature|add-topic) \S/.test(run)) {
      violations.push(
        `${at}: Run must start with "/feature <spec>" or "add-topic <topic>"`,
      );
    }
    const gateCount = /^(\d+)\b/.exec(gates);
    if (!gateCount) violations.push(`${at}: Gate failures must start with a count`);
    const found = /^(\d+)\/(\d+)\/(\d+)(, pre:\d+)?$/.exec(findings);
    if (!found)
      violations.push(`${at}: Findings must look like "H/M/L" or "H/M/L, pre:N"`);
    if (!/^[0-2]$/.test(rounds)) violations.push(`${at}: Fix rounds must be 0, 1 or 2`);
    const bareRetro = retro
      .toLowerCase()
      .replace(/[\s.,;:!—–-]+/g, ' ')
      .trim();
    if (bareRetro === '') violations.push(`${at}: Retro must not be empty`);
    const hadFriction =
      (gateCount && Number(gateCount[1]) > 0) ||
      (found && Number(found[1]) + Number(found[2]) + Number(found[3]) > 0);
    if (hadFriction && (bareRetro === 'nothing to change' || bareRetro === '')) {
      violations.push(
        `${at}: the run had gate failures or findings, so the Retro cell must say why none ` +
          'called for a change, not just "nothing to change"',
      );
    }
  }
}

if (violations.length > 0) {
  console.error('docs/pipeline-log.md has problems:\n');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('docs/pipeline-log.md rows are well-formed.');
