#!/usr/bin/env node
// Guardrail for docs/pipeline-log.md (column definitions in its header): every
// row has the eight columns in their format, and a run that had gate failures
// or findings can't close with a bare "nothing to change" retro, the rule a
// self-graded retro would otherwise break silently, nor with a proposal still
// "pending" (from 2026-10-05). From 2026-10-07, a content row with findings
// names their kinds (every one from KINDS), and no row logs a fix round with
// nothing to fix. Rows are parsed by cell
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
// The last date a Retro cell could say "pending" (the rule came after it).
const PENDING_ALLOWED_UNTIL = '2026-10-04';
// The last date a row could skip the two rules below (the kinds a content
// review found, and a fix round with no cause); they came after it.
const KINDS_AND_ROUNDS_ALLOWED_UNTIL = '2026-10-06';
// The kinds of finding a content row's Retro can name, as `kinds: a, b`. This
// list is the source; the pipeline-log header's Retro definition copies it.
const KINDS = [
  'jargon',
  'tone',
  'figurative',
  'wrong-claim',
  'estimate',
  'no-alternative',
  'compression',
  'code-bug',
  'test-gap',
  'narration',
  'duplication',
  'inconsistency',
  'structure',
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
  const [date, run, gates, findings, rounds, , retro] = row;
  if (date > KINDS_AND_ROUNDS_ALLOWED_UNTIL) {
    const found = /[1-9]/.test(findings.split(',')[0]);
    // A content row's Retro names the kinds its review found, so an audit can
    // see which recur; a /feature row's Retro is the retro, so it's exempt.
    if (found && !run.startsWith('/feature')) {
      // Every clause, each running to ";", "|", a sentence-ending period or the
      // cell end, and every comma-separated token in it, not just the leading
      // run of names: "tone and vibes" is one unknown token.
      const clauses = [...retro.matchAll(/\bkinds:((?:[^;|.]|\.(?=\S))*)/g)];
      if (clauses.length === 0) {
        violations.push(
          `${at}: the review had findings, so the Retro must name their kinds as "kinds: a, b" from: ${KINDS.join(', ')}`,
        );
      } else {
        for (const kind of clauses.flatMap((clause) =>
          clause[1].split(',').map((token) => token.trim()),
        )) {
          if (!KINDS.includes(kind)) {
            violations.push(
              `${at}: unknown kind "${kind}"; the kinds are: ${KINDS.join(', ')}`,
            );
          }
        }
      }
    }
    if (
      parseInt(rounds, 10) > 0 &&
      parseInt(gates, 10) === 0 &&
      !found &&
      !/\bpre:\d*[1-9]/.test(findings)
    ) {
      violations.push(
        `${at}: a fix round needs a cause: a gate failure, a finding or a pre:N`,
      );
    }
  }
  // The Retro cell records the user's decision (feature/SKILL.md Stage 6).
  // Rows before the rule keep their wording, since rows are never rewritten.
  if (date > PENDING_ALLOWED_UNTIL && /\bpending\b/i.test(retro)) {
    violations.push(
      `${at}: the Retro records what the user decided (applied, or declined and why), not a pending proposal`,
    );
  }
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
