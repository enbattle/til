// @vitest-environment node
// scripts/lib.mjs, the helpers the scripts share: ROOT, listFiles and
// escapeRegExp (docs/specs/dedupe-app-scripts-tests.md, criterion 6), and
// isMain, the guard each script's command-line part runs behind
// (docs/specs/in-process-checks.md).
import { spawnSync } from 'node:child_process';
import { symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, tempDir } from '../src/test/guard-helpers.mjs';
import { escapeRegExp, isMain, listFiles, ROOT } from './lib.mjs';

afterEach(cleanTemps);

describe('scripts/lib.mjs', () => {
  it('exports ROOT (the repository root), listFiles and escapeRegExp', () => {
    expect(resolve(ROOT)).toBe(resolve('.'));
    expect(typeof listFiles).toBe('function');
    const text = 'index-a.b+c(1).js';
    expect(new RegExp(`^${escapeRegExp(text)}$`).test(text)).toBe(true);
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false);
  });

  describe('isMain', () => {
    const argv = process.argv[1];
    afterEach(() => {
      process.argv[1] = argv;
    });

    // The started script must exist: isMain resolves it to its real path.
    it('is true for the script Node was started with', () => {
      process.argv[1] = resolve('scripts/check-raw-html.mjs');
      expect(isMain(pathToFileURL(resolve('scripts/check-raw-html.mjs')).href)).toBe(
        true,
      );
    });

    it('is false for a module that was only imported', () => {
      process.argv[1] = resolve('scripts/check-raw-html.mjs');
      expect(isMain(pathToFileURL(resolve('scripts/lib.mjs')).href)).toBe(false);
      expect(isMain(import.meta.url)).toBe(false);
    });

    it('is false when Node was started with no script', () => {
      process.argv[1] = undefined;
      expect(isMain(import.meta.url)).toBe(false);
    });

    it('is false, without throwing, when the started script does not exist', () => {
      process.argv[1] = resolve('scripts/no-such-script.mjs');
      expect(() => isMain(import.meta.url)).not.toThrow();
      expect(isMain(import.meta.url)).toBe(false);
    });

    // Run for real: a tiny script that prints a marker when isMain says it
    // is the entry point, started by its plain path, through a directory
    // link, and imported from a `node -e` script.
    describe('run as a real script', () => {
      const LIB = pathToFileURL(resolve('scripts/lib.mjs')).href;
      const MARKER = 'IS-MAIN-MARKER';
      const node = (args) =>
        spawnSync(process.execPath, args, { encoding: 'utf8', cwd: ROOT });
      function scriptDir() {
        const dir = tempDir();
        writeFileSync(
          join(dir, 'script.mjs'),
          `import { isMain } from ${JSON.stringify(LIB)};\n` +
            `if (isMain(import.meta.url)) console.log(${JSON.stringify(MARKER)});\n`,
        );
        return dir;
      }

      it('is true for the plain path', () => {
        const run = node([join(scriptDir(), 'script.mjs')]);
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toContain(MARKER);
      });

      // Review finding M1: Node resolves the entry to its real path for
      // import.meta.url but leaves process.argv[1] as typed, so a script
      // started through a junction or symlink skipped its CLI part.
      it('is true when started through a directory link (junction or symlink)', () => {
        const target = scriptDir();
        const link = join(tempDir(), 'linked');
        // 'junction' needs no admin on Windows; elsewhere it's a symlink.
        symlinkSync(target, link, 'junction');
        const run = node([join(link, 'script.mjs')]);
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toContain(MARKER);
      });

      it('is false, without throwing, when imported from a node -e script', () => {
        const script = pathToFileURL(join(scriptDir(), 'script.mjs')).href;
        const run = node([
          '--input-type=module',
          '-e',
          `await import(${JSON.stringify(script)}); console.log('done');`,
        ]);
        expect(run.status, run.stderr).toBe(0);
        expect(run.stdout).toContain('done');
        expect(run.stdout).not.toContain(MARKER);
      });
    });
  });
});
