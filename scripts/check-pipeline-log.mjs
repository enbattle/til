#!/usr/bin/env node
// Guardrail for docs/pipeline-log.md: every row is well-formed, and a run that
// had gate failures or findings can't close with a bare "nothing to change"
// retro. That second rule is the one self-graded retros would otherwise break
// silently; see the log's header for the column definitions.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const LOG = fileURLToPath(new URL('../docs/pipeline-log.md', import.meta.url));
const HEADER =
  '| Date | Run | Gate failures | Findings (H/M/L, pre) | Fix rounds | Retro | Escaped defect |';
const lines = readFileSync(LOG, 'utf8').split(/\r?\n/);
const headerAt = lines.findIndex((line) => line.trim() === HEADER);
const violations = [];

if (headerAt === -1) {
  violations.push(`table header not found; expected exactly:\n  ${HEADER}`);
} else {
  for (let i = headerAt + 2; i < lines.length && lines[i].trim().startsWith('|'); i++) {
    const at = `line ${i + 1}`;
    const cells = lines[i]
      .trim()
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    if (cells.length !== 7) {
      violations.push(`${at}: expected 7 cells, found ${cells.length}`);
      continue;
    }
    const [date, run, gates, findings, rounds, retro] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      violations.push(`${at}: Date must be YYYY-MM-DD`);
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
    const hadFriction =
      (gateCount && Number(gateCount[1]) > 0) ||
      (found && Number(found[1]) + Number(found[2]) + Number(found[3]) > 0);
    if (hadFriction && retro.toLowerCase() === 'nothing to change') {
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
