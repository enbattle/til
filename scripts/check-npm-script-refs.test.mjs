// @vitest-environment node
// Planted-violation tests for scripts/check-npm-script-refs.mjs
// (docs/specs/remove-dsa-tab.md, criterion 10, and its Stage 4 fix).
//
// Interface assumed:
//
// - The script exports `npmRefProblems(root)` (default: the repository). It
//   reads `root`'s package.json scripts and every markdown file git lists
//   under `root`, and returns one problem string per `npm run <name>` whose
//   name is not a script, each naming the file (its path relative to `root`;
//   backslashes allowed) and the name; `[]` when every reference resolves.
// - Only the records are skipped, as an exact allowlist:
//   - every file under `docs/specs/` except `docs/specs/README.md`, which is a
//     live doc and is checked like any other;
//   - the table rows of `docs/pipeline-log.md`: the lines whose trimmed text
//     starts with `|` (the definition scripts/check-pipeline-log.mjs uses).
//     The log's header, every line above and around the table, is live text
//     and is checked.
//   Records are point-in-time, so a script named in one may since have been
//   removed. Every other markdown file is checked in full, including a sibling
//   whose name only starts the same (`docs/specs-old.md`,
//   `docs/pipeline-log-notes.md`), a record path nested somewhere else, and a
//   table row in any file but the log.
// - Importing the module runs nothing; run as a script on this repository it
//   exits 0.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, repoWith, slashes } from '../src/test/guard-helpers.mjs';
import { npmRefProblems } from './check-npm-script-refs.mjs';

afterEach(cleanTemps);

const PKG = JSON.stringify({
  scripts: { build: 'vite build', 'test:run': 'vitest run' },
});
const STALE = 'Run `npm run nope` first.\n';
const VALID = 'Run `npm run build`, then `npm run test:run`.\n';
const LOG = 'docs/pipeline-log.md';

/** A pipeline log whose header line holds `header` and whose one row holds `row`. */
function log(header, row) {
  return [
    '# Pipeline log',
    '',
    header,
    '',
    '| Run | Date | Notes |',
    '| --- | ---- | ----- |',
    row,
    '',
  ].join('\n');
}
const CLEAN_ROW = '| /feature docs/specs/x.md | 2026-10-13 | fine |';
const STALE_ROW = '| /feature docs/specs/x.md | 2026-10-13 | ran `npm run nope` |';
const CLEAN_HEADER = 'Columns (`npm run build` checks the format):';
const STALE_HEADER = 'Columns (`npm run nope` checks the format):';

/** The problems for a throwaway repository holding package.json and `files`. */
function problems(files) {
  return slashes(npmRefProblems(repoWith({ 'package.json': PKG, ...files })));
}

describe('check-npm-script-refs', () => {
  describe('skips the spec records', () => {
    it.each([
      'docs/specs/x.md',
      'docs/specs/some-spec.md',
      'docs/specs/nested/y.md',
      'docs/specs/nested/README.md',
    ])('does not report a stale reference in %s', (path) => {
      expect(problems({ [path]: STALE })).toEqual([]);
    });
  });

  describe('checks docs/specs/README.md, a live doc', () => {
    it('reports a stale reference in docs/specs/README.md, naming the file and the script', () => {
      const found = problems({ 'docs/specs/README.md': STALE });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain('docs/specs/README.md');
      expect(found[0]).toContain('nope');
    });

    it('reports the README but not a spec beside it holding the same reference', () => {
      const found = problems({
        'docs/specs/README.md': STALE,
        'docs/specs/some-spec.md': STALE,
      });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain('docs/specs/README.md');
      expect(found.join('\n')).not.toContain('some-spec');
    });

    it('passes a valid reference in docs/specs/README.md', () => {
      expect(problems({ 'docs/specs/README.md': VALID })).toEqual([]);
    });
  });

  describe('docs/pipeline-log.md: skips the table rows, checks the header', () => {
    it('does not report a stale reference in a table row', () => {
      expect(problems({ [LOG]: log(CLEAN_HEADER, STALE_ROW) })).toEqual([]);
    });

    it('does not report a stale reference in an indented table row', () => {
      expect(problems({ [LOG]: log(CLEAN_HEADER, `   ${STALE_ROW}`) })).toEqual([]);
    });

    it('reports a stale reference in a header line, naming the file and the script', () => {
      const found = problems({ [LOG]: log(STALE_HEADER, CLEAN_ROW) });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(LOG);
      expect(found[0]).toContain('nope');
    });

    it('reports a stale header line given with no table at all', () => {
      const found = problems({ [LOG]: STALE });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(LOG);
    });

    it('reports a stale reference in a list item of the header (not a row)', () => {
      const found = problems({
        [LOG]: log('- **Run** — see `npm run nope`.', CLEAN_ROW),
      });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(LOG);
    });

    it('reports only the header once both the header and a row are stale', () => {
      const found = problems({ [LOG]: log(STALE_HEADER, STALE_ROW) });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(LOG);
    });

    it('passes a valid reference in the header and a valid one in a row', () => {
      expect(
        problems({
          [LOG]: log(CLEAN_HEADER, '| /feature x | 2026-10-13 | `npm run build` |'),
        }),
      ).toEqual([]);
    });
  });

  describe('checks every other markdown file', () => {
    it.each([
      'docs/x.md',
      'README.md',
      'docs/specs-old.md',
      'docs/pipeline-log-notes.md',
      'docs/specs.md',
      'docs/README.md',
      'notes/docs/specs/x.md',
      'notes/docs/pipeline-log.md',
      '.claude/skills/x/SKILL.md',
    ])('reports a stale reference in %s, naming the file and the script', (path) => {
      const found = problems({ [path]: STALE });
      expect(found).toHaveLength(1);
      expect(found[0]).toContain(path);
      expect(found[0]).toContain('nope');
    });

    it.each(['docs/x.md', 'docs/pipeline-log-notes.md', 'notes/docs/pipeline-log.md'])(
      'reports a stale reference in a table row of %s (only the log skips rows)',
      (path) => {
        const found = problems({ [path]: log(CLEAN_HEADER, STALE_ROW) });
        expect(found).toHaveLength(1);
        expect(found[0]).toContain(path);
      },
    );

    it('reports each stale file once a record holds the same reference', () => {
      const found = problems({
        'docs/specs/x.md': STALE,
        [LOG]: log(CLEAN_HEADER, STALE_ROW),
        'docs/x.md': STALE,
        'README.md': STALE,
      });
      expect(found).toHaveLength(2);
      expect(found.join('\n')).toContain('docs/x.md');
      expect(found.join('\n')).toContain('README.md');
      expect(found.join('\n')).not.toContain('docs/specs/x.md');
      expect(found.join('\n')).not.toContain(LOG);
    });
  });

  it.each(['docs/specs/x.md', 'docs/specs/README.md', LOG, 'docs/x.md', 'README.md'])(
    'passes a valid reference in %s',
    (path) => {
      expect(problems({ [path]: VALID })).toEqual([]);
    },
  );

  it('returns no problems for the real repository', () => {
    expect(slashes(npmRefProblems(resolve('.')))).toEqual([]);
    expect(slashes(npmRefProblems())).toEqual([]);
  });

  it('exits 0 on the real repository, run as a script', () => {
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-npm-script-refs.mjs')],
      { encoding: 'utf8' },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
  });
});
