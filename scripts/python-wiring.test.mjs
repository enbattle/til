// docs/specs/dsa-tab.md, criteria 12 and 15: pytest runs as part of
// `npm run verify` (and so in CI and the deploy), from a pinned
// requirements-dev.txt, on a Python that the workflows set up.
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root.
const ROOT = resolve('.');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const scripts = () => JSON.parse(read('package.json')).scripts;

describe('npm scripts', () => {
  it('has test:py running scripts/test-python.mjs', () => {
    expect(scripts()['test:py']).toBe('node scripts/test-python.mjs');
  });

  it('runs test:py in verify, right after test:run', () => {
    const steps = scripts()
      .verify.split('&&')
      .map((step) => step.trim());
    const at = steps.indexOf('npm run test:run');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(steps[at + 1]).toBe('npm run test:py');
  });
});

describe('requirements-dev.txt', () => {
  it('pins pytest to an exact version', () => {
    expect(read('requirements-dev.txt')).toMatch(/^pytest==\d+\.\d+(\.\d+)?\s*$/m);
  });
});

describe('pytest.ini', () => {
  it('points pytest at src/dsa/code', () => {
    expect(read('pytest.ini')).toMatch(/^\s*testpaths\s*=\s*src\/dsa\/code\s*$/m);
  });
});

describe.each(['.github/workflows/ci.yml', '.github/workflows/deploy.yml'])(
  '%s',
  (workflow) => {
    it('sets up Python 3.12 with a SHA-pinned setup-python, then installs requirements-dev.txt, before verify', () => {
      const text = read(workflow);
      const setup = text.search(/uses:\s*actions\/setup-python@[0-9a-f]{40}\b/);
      const install = text.search(/pip install -r requirements-dev\.txt/);
      const verify = text.search(/run:\s*npm run verify/);
      expect(setup, 'setup-python pinned by SHA').toBeGreaterThanOrEqual(0);
      expect(install, 'pip install -r requirements-dev.txt').toBeGreaterThan(setup);
      expect(verify).toBeGreaterThan(install);
      expect(text.slice(setup, install)).toMatch(/python-version:\s*['"]?3\.12['"]?/);
    });
  },
);

describe('dependabot', () => {
  it('watches the pip ecosystem', () => {
    expect(read('.github/dependabot.yml')).toMatch(/package-ecosystem:\s*pip\b/);
  });
});

describe('scripts/test-python.mjs', () => {
  it('fails with install instructions when no Python is on the PATH', () => {
    const empty = mkdtempSync(join(tmpdir(), 'til-no-python-'));
    try {
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !/^path$/i.test(key)),
      );
      const result = spawnSync(
        process.execPath,
        [join(ROOT, 'scripts/test-python.mjs')],
        { cwd: ROOT, encoding: 'utf8', env: { ...env, PATH: empty } },
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}${result.stderr}`).toMatch(
        /pip install -r requirements-dev\.txt/,
      );
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('requires Python 3.11+ (PYTHONSAFEPATH) and says so in its install text', () => {
    const text = read('scripts/test-python.mjs');
    expect(text).toMatch(/MIN_MINOR = 11\b/);
    expect(text).toMatch(/Install Python 3\.11 or later/);
    expect(text).not.toMatch(/3\.10/);
  });

  // docs/specs/dsa-tab.md, criterion 13: nothing outside the locked files can
  // make the runner pass a failing test. Each case runs the real runner in a
  // throwaway copy of the repository whose only test fails, plants one way
  // to hijack pytest, and asserts the run still fails.
  describe('against a failing test', () => {
    function copy(fixed = false) {
      const root = mkdtempSync(join(tmpdir(), 'til-runner-'));
      const code = join(root, 'src/dsa/code/x');
      mkdirSync(join(root, 'scripts'));
      mkdirSync(code, { recursive: true });
      copyFileSync(
        join(ROOT, 'scripts/test-python.mjs'),
        join(root, 'scripts/test-python.mjs'),
      );
      copyFileSync(join(ROOT, 'pytest.ini'), join(root, 'pytest.ini'));
      writeFileSync(join(code, 'x.py'), `def f():\n    return ${fixed ? 1 : 2}\n`);
      writeFileSync(
        join(code, 'test_x.py'),
        'from x import f\n\n\ndef test_f():\n    assert f() == 1\n',
      );
      return root;
    }

    function runner(root, env = {}) {
      return spawnSync(process.execPath, [join(root, 'scripts/test-python.mjs')], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, ...env },
      });
    }

    function withCopy(fixed, body) {
      const root = copy(fixed);
      try {
        body(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    it('passes when the code is right', () => {
      withCopy(true, (root) => {
        const result = runner(root);
        expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
      });
    });

    it('fails when a test fails', () => {
      withCopy(false, (root) => expect(runner(root).status).not.toBe(0));
    });

    it.each([
      ['a root iniconfig.py that exits 0', 'iniconfig.py', 'raise SystemExit(0)\n'],
      ['a root pluggy.py that exits 0', 'pluggy.py', 'raise SystemExit(0)\n'],
      [
        'a .pytest.ini next to the tests that only collects',
        'src/dsa/code/.pytest.ini',
        '[pytest]\naddopts = --co\n',
      ],
      [
        'a root .pytest.ini that only collects',
        '.pytest.ini',
        '[pytest]\naddopts = --co\n',
      ],
      [
        'a tox.ini next to the tests that only collects',
        'src/dsa/code/tox.ini',
        '[pytest]\naddopts = --co\n',
      ],
      [
        'a pyproject.toml next to the tests that only collects',
        'src/dsa/code/pyproject.toml',
        '[tool.pytest.ini_options]\naddopts = "--co"\n',
      ],
    ])('still fails with %s', (_label, path, content) => {
      withCopy(false, (root) => {
        writeFileSync(join(root, path), content);
        expect(runner(root).status).not.toBe(0);
      });
    });

    it.each([
      ['PYTEST_ADDOPTS=--co', { PYTEST_ADDOPTS: '--co' }],
      ['PYTEST_PLUGINS set to a plugin that exits 0', { PYTEST_PLUGINS: 'exitzero' }],
    ])('still fails with %s in the environment', (_label, env) => {
      withCopy(false, (root) => {
        // A plugin importable from the working directory; the runner must
        // neither load it via PYTEST_PLUGINS nor let the directory onto sys.path.
        writeFileSync(join(root, 'exitzero.py'), 'raise SystemExit(0)\n');
        expect(runner(root, env).status).not.toBe(0);
      });
    });

    it('leaves no __pycache__ or .pytest_cache behind', () => {
      withCopy(true, (root) => {
        expect(runner(root).status).toBe(0);
        const left = readdirSync(root, { recursive: true }).filter((path) =>
          /(^|[\\/])(__pycache__|\.pytest_cache)$/.test(String(path)),
        );
        expect(left).toEqual([]);
      });
    });
  });
});
