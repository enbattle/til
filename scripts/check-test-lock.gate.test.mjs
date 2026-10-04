// @vitest-environment node
// Planted-violation tests for scripts/check-test-lock.mjs: the gate command.
// Split from check-test-lock.test.mjs along its nested `describe` groups so no
// one file sets vitest's wall time.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, testLockFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { repo, lockRun } = testLockFixture;

describe('check-test-lock', () => {
  // Review round 1, finding 4: the gate's own command is locked. Changing the
  // `check:test-lock` script, or removing or reordering the `npm run test*`
  // steps inside `verify`, would stop the tests running (or the lock being
  // checked) without touching a `test*` script. Other `verify` steps stay
  // free to change.
  describe('the gate command (review round 1, finding 4)', () => {
    const SCRIPTS_BEFORE = {
      'test:run': 'vitest run',
      'test:py': 'node scripts/test-python.mjs',
      'check:test-lock': 'node scripts/check-test-lock.mjs',
      verify: 'npm run typecheck && npm run test:run && npm run test:py && npm run build',
    };

    function gateRepo() {
      const made = repo();
      writeFileSync(
        join(made.root, 'package.json'),
        JSON.stringify({ scripts: SCRIPTS_BEFORE }),
      );
      expect(lockRun(made.root, '--snapshot').status).toBe(0);
      const setScripts = (scripts) =>
        writeFileSync(
          join(made.root, 'package.json'),
          JSON.stringify({ scripts: { ...SCRIPTS_BEFORE, ...scripts } }),
        );
      return { ...made, setScripts };
    }

    it.each([
      ['check:test-lock changed to exit 0', { 'check:test-lock': 'exit 0' }],
      [
        'npm run test:run removed from verify',
        { verify: 'npm run typecheck && npm run test:py && npm run build' },
      ],
      [
        'npm run test:py removed from verify',
        { verify: 'npm run typecheck && npm run test:run && npm run build' },
      ],
      [
        'the npm run test* steps in verify reordered',
        {
          verify:
            'npm run typecheck && npm run test:py && npm run test:run && npm run build',
        },
      ],
      // Review round 2, finding 1: locking only the bare `npm run test*` tokens
      // let a step keep its name while its arguments or a shell operator
      // around it stopped it failing the gate.
      [
        'arguments appended to npm run test:run',
        {
          verify:
            "npm run typecheck && npm run test:run -- --exclude 'src/foo.test.ts' && npm run test:py && npm run build",
        },
      ],
      [
        '|| true after npm run test:run',
        {
          verify:
            'npm run typecheck && npm run test:run || true && npm run test:py && npm run build',
        },
      ],
      [
        '|| true at the end of verify',
        {
          verify:
            'npm run typecheck && npm run test:run && npm run test:py && npm run build || true',
        },
      ],
      [
        'a ; between steps',
        {
          verify:
            'npm run typecheck && npm run test:run; npm run test:py && npm run build',
        },
      ],
      // Review round 3: a plain `&&` step that isn't `npm run <script>` (an
      // `exit 0`, an `exec`) ends the shell before the tests run, so every
      // non-`npm run <name>` step is locked as an allowlist.
      [
        'exit 0 inserted before npm run test:run',
        {
          verify:
            'npm run typecheck && exit 0 && npm run test:run && npm run test:py && npm run build',
        },
      ],
      [
        'exec true inserted before npm run test:run',
        {
          verify:
            'npm run typecheck && exec true && npm run test:run && npm run test:py && npm run build',
        },
      ],
      [
        'an argument on a non-test step',
        {
          verify:
            'npm run typecheck && npm run check:foo -- --bail && npm run test:run && npm run test:py && npm run build',
        },
      ],
    ])('fails with %s', (_label, scripts) => {
      const { root, setScripts } = gateRepo();
      setScripts(scripts);
      const result = lockRun(root, '--verify');
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('package.json');
    });

    it('passes an unrelated step added to verify', () => {
      const { root, setScripts } = gateRepo();
      setScripts({
        verify:
          'npm run typecheck && npm run check:foo && npm run test:run && npm run test:py && npm run build',
      });
      const result = lockRun(root, '--verify');
      expect(result.status, result.stderr).toBe(0);
    });

    it('passes an unrelated && step removed from verify', () => {
      const { root, setScripts } = gateRepo();
      setScripts({
        verify: 'npm run test:run && npm run test:py && npm run build',
      });
      const result = lockRun(root, '--verify');
      expect(result.status, result.stderr).toBe(0);
    });
  });
});
