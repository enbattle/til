// @vitest-environment node
// Planted-violation tests for scripts/check-test-lock.mjs: the basics, ignore
// files and the self-lock. The other nested groups are in
// check-test-lock.python.test.mjs, check-test-lock.nested.test.mjs (nested
// repositories and global ignore files) and check-test-lock.gate.test.mjs,
// split along their `describe` boundaries so no one file sets vitest's wall
// time.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, testLockFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { repo, lockRun } = testLockFixture;

describe('check-test-lock', () => {
  it('passes when nothing changed, and fails with no snapshot', () => {
    const { lock } = repo();
    expect(lock('--verify')).toBe(1);
    expect(lock('--snapshot')).toBe(0);
    expect(lock('--verify')).toBe(0);
  });

  it.each([
    [
      'an edited untracked test',
      (root) => writeFileSync(join(root, 'src/lib/a.test.ts'), 'weakened\n'),
    ],
    [
      'an added spec file',
      (root) => writeFileSync(join(root, 'src/lib/b.spec.ts'), 'x\n'),
    ],
    [
      'a narrowed include after a nested block',
      (root) => {
        const path = join(root, 'vite.config.ts');
        writeFileSync(
          path,
          readFileSync(path, 'utf8').replace(
            "include: ['src/**']",
            "include: ['src/none/**']",
          ),
        );
      },
    ],
    [
      'a changed test script',
      (root) =>
        writeFileSync(
          join(root, 'package.json'),
          JSON.stringify({ scripts: { 'test:run': 'vitest run --passWithNoTests' } }),
        ),
    ],
    [
      'a new vitest.config',
      (root) => writeFileSync(join(root, 'vitest.config.ts'), 'export default {};\n'),
    ],
  ])('fails on %s', (_label, plant) => {
    const { root, lock } = repo();
    expect(lock('--snapshot')).toBe(0);
    plant(root);
    expect(lock('--verify')).toBe(1);
  });

  it('allows edits to vite.config.ts outside the test block', () => {
    const { root, lock } = repo();
    expect(lock('--snapshot')).toBe(0);
    const path = join(root, 'vite.config.ts');
    writeFileSync(path, `// a plugin change\n${readFileSync(path, 'utf8')}`);
    expect(lock('--verify')).toBe(0);
  });

  // docs/specs/dedupe-app-scripts-tests.md, criterion 7: the lock lists files
  // through git, so a path added to an ignore file after the snapshot would be
  // invisible to it (a new ignored vitest.config.ts or conftest.py). Every
  // .gitignore in the tree and .git/info/exclude are locked instead: the
  // exclusion list is pinned, rather than ignored files hunted by name.
  describe('ignore files (dedupe criterion 7)', () => {
    function ignoreRepo() {
      const made = repo();
      writeFileSync(join(made.root, '.gitignore'), 'node_modules\ndist\n');
      writeFileSync(join(made.root, 'src/lib/a.ts'), 'export const a = 1;\n');
      const exclude = join(made.root, '.git/info/exclude');
      mkdirSync(dirname(exclude), { recursive: true });
      if (!existsSync(exclude))
        writeFileSync(exclude, '# git ls-files --exclude-standard\n');
      return { ...made, exclude };
    }

    it('passes when nothing changed', () => {
      const { lock } = ignoreRepo();
      expect(lock('--snapshot')).toBe(0);
      expect(lock('--verify')).toBe(0);
    });

    it.each([
      [
        'an edited root .gitignore that hides a new vitest.config.ts',
        ({ root }) => {
          writeFileSync(
            join(root, '.gitignore'),
            'node_modules\ndist\nvitest.config.ts\n',
          );
          writeFileSync(
            join(root, 'vitest.config.ts'),
            "export default { test: { include: ['none/**'] } };\n",
          );
        },
      ],
      [
        'an edited root .gitignore alone',
        ({ root }) =>
          writeFileSync(join(root, '.gitignore'), 'node_modules\ndist\nconftest.py\n'),
      ],
      [
        'an added nested src/.gitignore that hides a new test',
        ({ root }) => {
          writeFileSync(join(root, 'src/.gitignore'), 'lib/b.test.ts\n');
          writeFileSync(join(root, 'src/lib/b.test.ts'), 'it.skip("b", () => {});\n');
        },
      ],
      [
        'an added nested src/.gitignore alone',
        ({ root }) => writeFileSync(join(root, 'src/.gitignore'), 'conftest.py\n'),
      ],
      [
        'an edited .git/info/exclude',
        ({ exclude }) =>
          writeFileSync(
            exclude,
            `${readFileSync(exclude, 'utf8')}vitest.config.ts\nconftest.py\n`,
          ),
      ],
    ])('fails on %s', (_label, plant) => {
      const made = ignoreRepo();
      expect(made.lock('--snapshot')).toBe(0);
      plant(made);
      expect(made.lock('--verify')).toBe(1);
    });

    it('fails on a .gitignore added where there was none', () => {
      const { root, lock } = repo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, '.gitignore'), 'vitest.config.ts\n');
      expect(lock('--verify')).toBe(1);
    });

    // A .gitignore that lists itself drops out of `git ls-files -co
    // --exclude-standard`, so it must still be locked (review finding H1, A).
    it('fails on an added .gitignore that ignores itself and hides a new test', () => {
      const { root, lock } = ignoreRepo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, 'src/.gitignore'), '.gitignore\nlib/b.test.ts\n');
      writeFileSync(join(root, 'src/lib/b.test.ts'), 'it.skip("b", () => {});\n');
      expect(lock('--verify')).toBe(1);
    });

    // A repo-local core.excludesFile is a third source of ignore rules,
    // outside .gitignore and .git/info/exclude (review finding H1, C).
    const gitConfig = (root, ...args) =>
      execFileSync('git', ['config', ...args], { cwd: root });

    it('fails on a repo-local core.excludesFile set after the snapshot', () => {
      const { root, lock } = ignoreRepo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, '.hide'), 'vitest.config.ts\n');
      gitConfig(root, 'core.excludesFile', '.hide');
      writeFileSync(
        join(root, 'vitest.config.ts'),
        "export default { test: { include: ['none/**'] } };\n",
      );
      expect(lock('--verify')).toBe(1);
    });

    it("fails on a change to an already-set core.excludesFile's contents", () => {
      const { root, lock } = ignoreRepo();
      writeFileSync(join(root, '.hide'), 'conftest.py\n');
      gitConfig(root, 'core.excludesFile', '.hide');
      expect(lock('--snapshot')).toBe(0);
      expect(lock('--verify')).toBe(0);
      writeFileSync(join(root, '.hide'), 'conftest.py\nvitest.config.ts\n');
      expect(lock('--verify')).toBe(1);
    });

    // With core.ignorecase=true git honours `.GITIGNORE`, so the ignore-file
    // match must be case-insensitive too (review round 2, finding 2).
    it('fails on a differently-cased .GITIGNORE that hides a new conftest.py', () => {
      const { root, lock } = ignoreRepo();
      gitConfig(root, 'core.ignorecase', 'true');
      expect(lock('--snapshot')).toBe(0);
      mkdirSync(join(root, 'src/dsa/code/heap'), { recursive: true });
      writeFileSync(
        join(root, 'src/dsa/code/heap/.GITIGNORE'),
        '.GITIGNORE\nconftest.py\n',
      );
      writeFileSync(
        join(root, 'src/dsa/code/heap/conftest.py'),
        'collect_ignore = ["*"]\n',
      );
      expect(lock('--verify')).toBe(1);
    });

    // A snapshot taken by an older script lacks a config part that
    // runnerConfig() now produces; --verify must report it, not skip it
    // (review round 2, finding 3).
    it('fails on a config part the snapshot lacks, naming it as added', () => {
      const { root, lock } = ignoreRepo();
      expect(lock('--snapshot')).toBe(0);
      const manifest = join(root, '.git/til-test-lock.json');
      const locked = JSON.parse(readFileSync(manifest, 'utf8'));
      const part = 'package.json#scripts.test*';
      expect(part in locked).toBe(true);
      delete locked[part];
      writeFileSync(manifest, JSON.stringify(locked, null, 2));
      const result = spawnSync(
        process.execPath,
        [join(root, 'scripts/check-test-lock.mjs'), '--verify'],
        { encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/added:\s+package\.json#scripts\.test\*/);
    });

    it('allows an unrelated edit to a file that is not locked', () => {
      const { root, lock } = ignoreRepo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, 'src/lib/a.ts'), 'export const a = 2;\n');
      writeFileSync(join(root, 'README.md'), '# notes\n');
      expect(lock('--verify')).toBe(0);
    });
  });

  // docs/specs/tooling-gaps.md, criterion 2: the lock script, and the
  // scripts/lib.mjs it imports, are locked too, so a later stage can't weaken
  // the lock and then pass it.
  describe('self-lock (tooling-gaps criterion 2)', () => {
    it('locks scripts/check-test-lock.mjs and scripts/lib.mjs', () => {
      const { root } = repo();
      expect(lockRun(root, '--snapshot').status).toBe(0);
      const locked = JSON.parse(
        readFileSync(join(root, '.git/til-test-lock.json'), 'utf8'),
      );
      expect(Object.keys(locked)).toEqual(
        expect.arrayContaining(['scripts/check-test-lock.mjs', 'scripts/lib.mjs']),
      );
    });

    it.each(['scripts/check-test-lock.mjs', 'scripts/lib.mjs'])(
      'fails on an edited %s',
      (path) => {
        const { root } = repo();
        expect(lockRun(root, '--snapshot').status).toBe(0);
        const full = join(root, path);
        writeFileSync(full, `${readFileSync(full, 'utf8')}\n// weakened\n`);
        const result = lockRun(root, '--verify');
        expect(result.status).toBe(1);
        expect(result.stderr).toContain(path);
      },
    );
  });
});
