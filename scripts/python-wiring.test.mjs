// @vitest-environment node
// docs/specs/dsa-tab.md, criteria 12 and 15, as slimmed by
// docs/specs/in-process-checks.md (criterion 8): pytest runs as part of
// `npm run verify` through scripts/test-python.mjs, which passes a clean tree,
// fails a failing test, leaves nothing behind, and says how to install
// Python 3.11+ when there is none. The config files' own text isn't asserted
// here; a wrong pin or path fails loudly when pytest runs.
import { spawn, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

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

  // Each case runs the real runner in a throwaway copy of the repository
  // holding one test. The cases run concurrently (each owns its own copy),
  // since each one waits on a pytest run.
  describe.concurrent('against a scratch tree', () => {
    function copy(fixed = false) {
      const root = mkdtempSync(join(tmpdir(), 'til-runner-'));
      const code = join(root, 'src/dsa/code/x');
      mkdirSync(join(root, 'scripts'));
      mkdirSync(code, { recursive: true });
      copyFileSync(
        join(ROOT, 'scripts/test-python.mjs'),
        join(root, 'scripts/test-python.mjs'),
      );
      // The runner's shared helpers (scripts/lib.mjs), when it imports them.
      if (existsSync(join(ROOT, 'scripts/lib.mjs'))) {
        copyFileSync(join(ROOT, 'scripts/lib.mjs'), join(root, 'scripts/lib.mjs'));
      }
      copyFileSync(join(ROOT, 'pytest.ini'), join(root, 'pytest.ini'));
      writeFileSync(join(code, 'x.py'), `def f():\n    return ${fixed ? 1 : 2}\n`);
      writeFileSync(
        join(code, 'test_x.py'),
        'from x import f\n\n\ndef test_f():\n    assert f() == 1\n',
      );
      return root;
    }

    // Asynchronous, so the concurrent cases' pytest runs overlap.
    function runner(root) {
      return new Promise((done, fail) => {
        const child = spawn(process.execPath, [join(root, 'scripts/test-python.mjs')], {
          cwd: root,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8').on('data', (chunk) => (stdout += chunk));
        child.stderr.setEncoding('utf8').on('data', (chunk) => (stderr += chunk));
        child.on('error', fail);
        child.on('close', (status) => done({ status, stdout, stderr }));
      });
    }

    async function withCopy(fixed, body) {
      const root = copy(fixed);
      try {
        await body(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }

    // One run of the runner on a copy whose code is right, shared by the two
    // tests that only assert different things about it (its exit status, and
    // what it leaves behind).
    let fixed;
    beforeAll(async () => {
      await withCopy(true, async (root) => {
        const result = await runner(root);
        const left = readdirSync(root, { recursive: true }).filter((path) =>
          /(^|[\\/])(__pycache__|\.pytest_cache)$/.test(String(path)),
        );
        fixed = { result, left };
      });
      // A real pytest run: vitest's default 10 s hook timeout is too tight
      // on a loaded machine.
    }, 60_000);

    it('passes when the code is right', () => {
      const { result } = fixed;
      expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
    });

    it('fails when a test fails', async () => {
      await withCopy(false, async (root) =>
        expect((await runner(root)).status).not.toBe(0),
      );
    });

    it('leaves no __pycache__ or .pytest_cache behind', () => {
      const { result, left } = fixed;
      expect(result.status).toBe(0);
      expect(left).toEqual([]);
    });
  });
});
