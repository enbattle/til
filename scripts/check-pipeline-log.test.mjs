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
      date = '2026-09-23',
    } = {},
  ) =>
    `|  ${date}  | ${run} | ${gates} | ${findings} | ${rounds} | ${agents} |  ${retro}  |  |`;
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
    // Rows are never rewritten, so rows from before the rule keep their wording.
    expect(check(row('Proposed / pending the user', { date: '2026-10-04' }))).toBe(0);
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
    [
      'a retro still pending the user',
      row('Stage 4 edit, pending the user', { date: '2026-10-05' }),
    ],
    ['a retro still Pending, any case', row('PENDING', { date: '2027-01-01' })],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });

  // docs/specs/harness-follow-ups.md, criteria 2 and 3: both rules apply only
  // to rows dated after 2026-10-06, since rows are never rewritten.
  function result(...rows) {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${rows.join('\n')}\n`);
    const { status, stdout, stderr } = run('check-pipeline-log.mjs', [file]);
    return { status, output: `${stdout}${stderr}` };
  }
  const content = (retro, options = {}) =>
    row(retro, {
      run: 'add-topic src/content/databases/x.md',
      agents: '—',
      date: '2026-10-07',
      ...options,
    });

  describe('content rows record the kinds of finding (criterion 2)', () => {
    it('fails a content row with findings and no kinds, naming the row', () => {
      const { status, output } = result(content('n/a', { findings: '0/2/0' }));
      expect(status).toBe(1);
      expect(output).toContain('2026-10-07 | add-topic src/content/databases/x.md');
    });

    it('fails an unknown kind, naming it', () => {
      const { status, output } = result(content('kinds: vibes', { findings: '0/2/0' }));
      expect(status).toBe(1);
      expect(output).toContain('vibes');
      expect(output).toContain('2026-10-07 | add-topic src/content/databases/x.md');
    });

    it('fails when one of several kinds is unknown', () => {
      const { status, output } = result(
        content('kinds: tone, vibes', { findings: '1/0/0' }),
      );
      expect(status).toBe(1);
      expect(output).toContain('vibes');
    });

    // Review decisions, "Fix with a test (4a round 1)": every token in the
    // kinds clause (up to ";", "|" or the cell end) is checked, not just the
    // run of names the clause starts with.
    it.each([
      ['a capitalized unknown kind', 'kinds: tone, Vibes', 'Vibes'],
      ['kinds joined by "and"', 'kinds: tone and vibes', 'vibes'],
      ['a list ending in "and"', 'kinds: tone, jargon and vibes', 'vibes'],
      ['a parenthesized kind', 'kinds: tone (vibes)', 'vibes'],
      ['a second kinds clause', 'kinds: tone; kinds: vibes', 'vibes'],
    ])('fails %s, naming it', (_label, retro, named) => {
      const { status, output } = result(content(retro, { findings: '0/2/0' }));
      expect(status).toBe(1);
      expect(output).toContain(named);
    });

    it.each([
      'kinds: tone, wrong-claim',
      'kinds: tone,wrong-claim.',
      'kinds:  tone ,  jargon',
    ])('passes "%s"', (retro) => {
      expect(result(content(retro, { findings: '0/2/0' })).status).toBe(0);
    });

    it.each([
      'add-case-study src/system-design/case-studies/x.md',
      'add-dsa-entry src/dsa/entries/x.md',
    ])('applies to %s rows too', (run) => {
      expect(result(content('n/a', { findings: '0/0/1', run })).status).toBe(1);
    });

    it('counts findings before ", pre" only', () => {
      expect(result(content('n/a', { findings: '0/0/0, pre:2' })).status).toBe(0);
      expect(result(content('n/a', { findings: '0/1/0, pre:2' })).status).toBe(1);
    });

    it.each([
      [
        'a row whose kinds are all on the list',
        content('kinds: test-gap, wrong-claim', { findings: '0/2/0' }),
      ],
      [
        'a row naming every kind on the list',
        content(
          'kinds: jargon, tone, figurative, wrong-claim, estimate, no-alternative, compression, code-bug, test-gap, narration, duplication, inconsistency, structure',
          { findings: '3/5/5' },
        ),
      ],
      [
        'kinds beside other retro text',
        content('fixed both; kinds: tone. no gap', { findings: '0/1/0' }),
      ],
      [
        'a row dated on the cut-off',
        content('n/a', { findings: '0/2/0', date: '2026-10-06' }),
      ],
      [
        'a /feature row (its Retro is the retro)',
        row('n/a', { findings: '0/1/0', date: '2026-10-07' }),
      ],
      ['a content row with no findings', content('n/a')],
    ])('passes %s', (_label, good) => {
      expect(result(good).status).toBe(0);
    });
  });

  describe('no fix round without a cause (criterion 3)', () => {
    it('fails a fix round with no gate failure, finding or pre-finding, naming the row', () => {
      const { status, output } = result(row('n/a', { rounds: '1', date: '2026-10-07' }));
      expect(status).toBe(1);
      expect(output).toContain('2026-10-07 | /feature docs/specs/x.md');
    });

    it('fails it on a content row too', () => {
      expect(result(content('n/a', { rounds: '2' })).status).toBe(1);
    });

    it.each([
      [
        'a fix round after a gate failure',
        row('fixed', { rounds: '1', gates: '1', date: '2026-10-07' }),
      ],
      [
        'a fix round after a pre-finding',
        row('fixed', { rounds: '1', findings: '0/0/0, pre:1', date: '2026-10-07' }),
      ],
      [
        'a causeless fix round from before the rule',
        row('n/a', { rounds: '1', date: '2026-10-05' }),
      ],
      [
        'a causeless fix round dated on the cut-off',
        row('n/a', { rounds: '1', date: '2026-10-06' }),
      ],
      ['no fix round at all', row('n/a', { date: '2026-10-07' })],
    ])('passes %s', (_label, good) => {
      expect(result(good).status).toBe(0);
    });
  });

  it('passes the real log under the new rules (criterion 4)', () => {
    const { status, stderr } = run('check-pipeline-log.mjs');
    expect(status, stderr).toBe(0);
  });
});
