// @vitest-environment node
// Planted-violation tests for scripts/check-hex-colors.mjs, called in-process
// through its exported `hexColorProblems(root)` (docs/specs/
// in-process-checks.md): it scans the app code under `root`'s src/ and
// returns a problem for each raw hex color, naming its file; `[]` when there
// are none. Importing it runs nothing.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, repoWith, slashes } from '../src/test/guard-helpers.mjs';
import { hexColorProblems } from './check-hex-colors.mjs';

afterEach(cleanTemps);

const INDEX_CSS = { 'src/index.css': ':root {\n  --color-accent: #92400e;\n}\n' };
const problems = (files) =>
  slashes(hexColorProblems(repoWith({ ...INDEX_CSS, ...files })));

// docs/specs/dedupe-app-scripts-tests.md, criterion 6: the walking scripts list
// their files through scripts/lib.mjs's `listFiles` (`git ls-files -co
// --exclude-standard`), which respects .gitignore instead of a hand-kept
// skip list.
describe('check-hex-colors skips .gitignored files (dedupe criterion 6)', () => {
  const FILES = {
    'src/components/Ok.tsx': 'export const ok = "text-accent";\n',
    'src/generated/palette.ts': "export const red = '#ff0000';\n",
  };

  it('reports the hex colour when the file is not ignored (the planted file is scanned)', () => {
    expect(problems(FILES).join('\n')).toMatch(/src\/generated\/palette\.ts/);
  });

  it('does not report a hex colour in a .gitignored .ts file', () => {
    expect(problems({ ...FILES, '.gitignore': 'src/generated/\n' })).toEqual([]);
  });
});

// docs/specs/tooling-gaps.md, criterion 3: `.mjs` under src/ (such as
// src/lib/markdown.mjs, which ships to the browser) is scanned for hex colours.
describe('check-hex-colors scans .mjs under src/ (tooling-gaps criterion 3)', () => {
  it('reports a hex colour in a planted src/x.mjs', () => {
    expect(
      problems({ 'src/x.mjs': "export const red = '#ff0000';\n" }).join('\n'),
    ).toMatch(/src\/x\.mjs/);
  });

  it('passes a src/index.css that defines the tokens', () => {
    expect(problems({})).toEqual([]);
  });
});

describe('check-hex-colors on the real repository', () => {
  it('returns no problems', () => {
    expect(slashes(hexColorProblems(resolve('.')))).toEqual([]);
    expect(slashes(hexColorProblems())).toEqual([]);
  });

  // docs/specs/in-process-checks.md, criterion 2: the one run as a script.
  it('exits 0 with its success message, run as a script', () => {
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-hex-colors.mjs')],
      {
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/No raw hex colors found/);
  });
});
