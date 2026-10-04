// @vitest-environment node
// Planted-violation tests for scripts/check-hex-colors.mjs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanTemps,
  copyScripts,
  gitInit,
  run,
  tempDir,
} from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

// docs/specs/dedupe-app-scripts-tests.md, criterion 6: the walking scripts list
// their files through scripts/lib.mjs's `listFiles` (`git ls-files -co
// --exclude-standard`), which respects .gitignore instead of a hand-kept
// skip list.
describe('check-hex-colors skips .gitignored files (dedupe criterion 6)', () => {
  function colors({ ignore }) {
    const root = tempDir();
    gitInit(root);
    copyScripts(root, 'check-hex-colors.mjs');
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    write('src/index.css', ':root {\n  --color-accent: #92400e;\n}\n');
    write('src/components/Ok.tsx', 'export const ok = "text-accent";\n');
    write('src/generated/palette.ts', "export const red = '#ff0000';\n");
    if (ignore) write('.gitignore', 'src/generated/\n');
    return spawnSync(process.execPath, [join(root, 'scripts/check-hex-colors.mjs')], {
      encoding: 'utf8',
    });
  }

  it('reports the hex colour when the file is not ignored (the planted file is scanned)', () => {
    const result = colors({ ignore: false });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/palette\.ts/);
  });

  it('does not report a hex colour in a .gitignored .ts file', () => {
    const result = colors({ ignore: true });
    expect(result.stderr).not.toMatch(/palette\.ts/);
    expect(result.status, result.stderr).toBe(0);
  });
});

// docs/specs/tooling-gaps.md, criterion 3: `.mjs` under src/ (such as
// src/lib/markdown.mjs, which ships to the browser) is scanned for hex colours.
describe('check-hex-colors scans .mjs under src/ (tooling-gaps criterion 3)', () => {
  it('reports a hex colour in a planted src/x.mjs', () => {
    const root = tempDir();
    gitInit(root);
    copyScripts(root, 'check-hex-colors.mjs');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(
      join(root, 'src/index.css'),
      ':root {\n  --color-accent: #92400e;\n}\n',
    );
    writeFileSync(join(root, 'src/x.mjs'), "export const red = '#ff0000';\n");
    const result = spawnSync(
      process.execPath,
      [join(root, 'scripts/check-hex-colors.mjs')],
      {
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/x\.mjs/);
  });

  it('passes the real repository', () => {
    const result = run('check-hex-colors.mjs');
    expect(result.status, result.stderr).toBe(0);
  });
});
