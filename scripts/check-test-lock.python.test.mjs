// @vitest-environment node
// Planted-violation tests for scripts/check-test-lock.mjs: the Python tests.
// Split from check-test-lock.test.mjs along its nested `describe` groups so no
// one file sets vitest's wall time.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, SCRIPTS, testLockFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { repo } = testLockFixture;

describe('check-test-lock', () => {
  // docs/specs/dsa-tab.md, criterion 13: pytest files and pytest's own
  // configuration are locked like the vitest ones.
  describe('Python tests (DSA criterion 13)', () => {
    const CODE = 'src/dsa/code/x';

    function pyRepo() {
      const made = repo();
      mkdirSync(join(made.root, CODE), { recursive: true });
      writeFileSync(join(made.root, CODE, 'x.py'), 'def f():\n    return 1\n');
      writeFileSync(
        join(made.root, CODE, 'test_x.py'),
        'from x import f\n\n\ndef test_f():\n    assert f() == 1\n',
      );
      writeFileSync(
        join(made.root, 'pytest.ini'),
        '[pytest]\ntestpaths = src/dsa/code\n',
      );
      return made;
    }

    it('passes when nothing changed', () => {
      const { lock } = pyRepo();
      expect(lock('--snapshot')).toBe(0);
      expect(lock('--verify')).toBe(0);
    });

    it.each([
      [
        'an edited test_x.py',
        (root) =>
          writeFileSync(
            join(root, CODE, 'test_x.py'),
            'def test_f():\n    assert True\n',
          ),
      ],
      ['a deleted test_x.py', (root) => rmSync(join(root, CODE, 'test_x.py'))],
      [
        'an added test_y.py',
        (root) =>
          writeFileSync(join(root, CODE, 'test_y.py'), 'def test_y():\n    pass\n'),
      ],
      [
        'an edited pytest.ini',
        (root) =>
          writeFileSync(join(root, 'pytest.ini'), '[pytest]\ntestpaths = src/none\n'),
      ],
      [
        'an added conftest.py',
        (root) =>
          writeFileSync(join(root, CODE, 'conftest.py'), 'collect_ignore = ["."]\n'),
      ],
      [
        'an added pyproject.toml',
        (root) =>
          writeFileSync(
            join(root, 'pyproject.toml'),
            '[tool.pytest.ini_options]\naddopts = "-k nothing"\n',
          ),
      ],
    ])('fails on %s', (_label, plant) => {
      const { root, lock } = pyRepo();
      expect(lock('--snapshot')).toBe(0);
      plant(root);
      expect(lock('--verify')).toBe(1);
    });

    it('fails on a pytest.ini added after a snapshot taken without one', () => {
      const { root, lock } = repo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, 'pytest.ini'), '[pytest]\naddopts = -k nothing\n');
      expect(lock('--verify')).toBe(1);
    });

    // pytest 9 reads `pytest.toml` and `.pytest.toml` natively, ahead of
    // pytest.ini, so either one added later can deselect tests.
    it.each(['pytest.toml', '.pytest.toml'])('fails on an added %s', (name) => {
      const { root, lock } = pyRepo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, name), '[pytest]\naddopts = ["-k", "not f"]\n');
      expect(lock('--verify')).toBe(1);
    });

    // pytest 9.1 also reads `.pytest.ini`, and searches for it upward from the
    // `src/dsa/code` argument, so one next to the tests is found first.
    it.each(['.pytest.ini', 'src/dsa/code/.pytest.ini'])(
      'fails on an added %s',
      (path) => {
        const { root, lock } = pyRepo();
        expect(lock('--snapshot')).toBe(0);
        writeFileSync(join(root, path), '[pytest]\naddopts = --co\n');
        expect(lock('--verify')).toBe(1);
      },
    );

    // The `test:py` script runs scripts/test-python.mjs, so an edit to the
    // runner (an early `process.exit(0)`) skips every Python test at once.
    it('fails on an edited scripts/test-python.mjs', () => {
      const { root, lock } = pyRepo();
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({
          scripts: {
            'test:run': 'vitest run',
            'test:py': 'node scripts/test-python.mjs',
          },
        }),
      );
      const runner = join(root, 'scripts/test-python.mjs');
      copyFileSync(join(SCRIPTS, 'test-python.mjs'), runner);
      expect(lock('--snapshot')).toBe(0);
      const [shebang, ...rest] = readFileSync(runner, 'utf8').split('\n');
      writeFileSync(runner, [shebang, 'process.exit(0);', ...rest].join('\n'));
      expect(lock('--verify')).toBe(1);
    });

    // scripts/test-python.mjs runs `python -m pytest` from the repository
    // root, and Python puts the working directory first on sys.path, so a root
    // `pytest.py` or `pytest/` package (or the same for `_pytest`) shadows the
    // real pytest and can exit 0 without running a single test.
    it.each([
      ['pytest.py', 'import sys\nsys.exit(0)\n'],
      ['pytest/__main__.py', 'import sys\nsys.exit(0)\n'],
      ['pytest/__init__.py', ''],
      ['_pytest.py', 'import sys\nsys.exit(0)\n'],
      ['_pytest/__init__.py', ''],
    ])('fails on an added root %s that shadows pytest', (path, content) => {
      const { root, lock } = pyRepo();
      expect(lock('--snapshot')).toBe(0);
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
      expect(lock('--verify')).toBe(1);
    });

    it.each([`${CODE}/pytest_helpers.py`, `${CODE}/y.py`])(
      'allows an ordinary module %s added after the snapshot',
      (path) => {
        const { root, lock } = pyRepo();
        expect(lock('--snapshot')).toBe(0);
        writeFileSync(join(root, path), 'def g():\n    return 2\n');
        expect(lock('--verify')).toBe(0);
      },
    );

    it('allows edits to the code under test', () => {
      const { root, lock } = pyRepo();
      expect(lock('--snapshot')).toBe(0);
      writeFileSync(join(root, CODE, 'x.py'), 'def f():\n    return 1 + 0\n');
      expect(lock('--verify')).toBe(0);
    });
  });
});
