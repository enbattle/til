// @vitest-environment node
// Planted-violation tests for scripts/check-pipeline-log.mjs. A guard that has
// only ever passed hasn't been tested (feature/SKILL.md, Stage 3), so each case
// plants the violation the script exists to catch and asserts it fails, plus a
// clean case that must pass.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, run, SCRIPTS, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

describe('check-pipeline-log', () => {
  const header = readFileSync(join(SCRIPTS, '../docs/pipeline-log.md'), 'utf8');
  const row = (
    retro,
    {
      gates = '0',
      findings = '0/0/0',
      rounds = '0',
      agents = '3',
      run = '/feature docs/specs/x.md',
    } = {},
  ) =>
    `|  2026-09-23  | ${run} | ${gates} | ${findings} | ${rounds} | ${agents} |  ${retro}  |  |`;
  function check(...rows) {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${rows.join('\n')}\n`);
    return run('check-pipeline-log.mjs', [file]).status;
  }

  it('passes the real log and well-formed (padded) rows', () => {
    expect(run('check-pipeline-log.mjs').status).toBe(0);
    expect(check(row('nothing to change'))).toBe(0);
    expect(
      check(
        row('fixed in 4a; no gap', {
          findings: '0/1/0, pre:2',
          rounds: '3 (user-authorized)',
        }),
      ),
    ).toBe(0);
    expect(
      check(
        row('n/a', {
          run: 'add-case-study src/system-design/case-studies/x.md',
          agents: '—',
        }),
      ),
    ).toBe(0);
  });

  it.each([
    [
      'a bare retro after gate failures',
      row('nothing to change', { gates: '1 test-lock' }),
    ],
    ['a bare retro after findings', row('Nothing to change.', { findings: '0/1/0' })],
    ['an empty retro', row('')],
    ['a bad date', row('ok').replace('2026-09-23', '26-9-23')],
    ['a run with no path', row('n/a', { run: 'add-topic' })],
    ['a bad findings cell', row('ok', { findings: '1 high' })],
    ['a fix round past the cap without authorization', row('ok', { rounds: '3' })],
    ['an Agents cell that is not a count', row('ok', { agents: '0' })],
    ['a wrong cell count', '| 2026-09-23 | /feature x | 0 |'],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });
});
