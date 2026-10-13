// @vitest-environment node
// Tests for scripts/check-test-lock.mjs, the guard for /feature's locked-tests
// rule (NON_NEGOTIABLES #9), in its slim form (docs/specs/
// in-process-checks.md, criteria 2 and 5).
//
// Interface assumed:
//
// - `snapshotLock(root, fixtures = [])` hashes every locked file and config
//   part under `root` (a git repository; default: this one) and writes the
//   snapshot inside its git directory. Each fixture is a path relative to
//   `root`; one that isn't an existing file throws.
// - `verifyLock(root)` returns the change lines since the snapshot, each
//   `modified: <key>`, `added: <key>` or `deleted: <key>` (padding after the
//   colon allowed), `[]` when nothing changed. A file's key is its path
//   relative to `root` with `/`; a config part's key names the file it is
//   part of (`vite.config.ts`, `package.json`, `.git/info/exclude`), and the
//   `verify` part's key also contains "verify". With no snapshot it throws.
// - `clearLock(root)` deletes the snapshot.
// - Importing the module runs nothing. Run as a script it takes `--snapshot
//   [fixture...]`, `--verify` or `--clear`, and exits 2 with the usage line on
//   anything else.
//
// Every case runs in a throwaway repository, so no test touches this
// repository's own snapshot.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanTemps,
  repoWith,
  slashes,
  tempDir,
  write,
} from '../src/test/guard-helpers.mjs';
import { clearLock, snapshotLock, verifyLock } from './check-test-lock.mjs';

afterEach(cleanTemps);

const VITE = `export default {
  plugins: [],
  test: {
    coverage: { enabled: false },
    include: ['src/**'],
  },
};
`;
const SCRIPTS = {
  build: 'vite build',
  'check:colors': 'node scripts/check-hex-colors.mjs',
  'test:run': 'vitest run',
  'check:test-lock': 'node scripts/check-test-lock.mjs',
  verify: 'npm run typecheck && npm run lint && npm run test:run && npm run build',
};
const pkg = (scripts = {}, extra = {}) =>
  `${JSON.stringify({ scripts: { ...SCRIPTS, ...scripts }, dependencies: {}, ...extra }, null, 2)}\n`;

/** A throwaway repository holding one of each kind of locked file, plus app
 * files that aren't locked. */
function repo() {
  return repoWith({
    'package.json': pkg(),
    'vite.config.ts': VITE,
    '.gitignore': 'node_modules\ndist\n',
    'src/lib/a.ts': 'export const a = 1;\n',
    'src/lib/a.test.ts': 'it("a", () => {});\n',
    'src/lib/__snapshots__/a.test.ts.snap': 'exports[`a 1`] = `"a"`;\n',
    'src/test/setup.ts': 'export {};\n',
    'src/content/s/topic.md': '# A topic\n',
    'scripts/check-test-lock.mjs': '// the lock\n',
    'scripts/lib.mjs': '// shared helpers\n',
    'README.md': '# notes\n',
  });
}

// Most cases start from the same snapshotted repository, so one is built and
// snapshotted once and each case works on its own copy: a git call costs tens
// of milliseconds on Windows, and a fresh repository and snapshot take several.
let base;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'til-lock-base-'));
  cpSync(repo(), base, { recursive: true });
  snapshotLock(base);
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** A copy of the snapshotted base repository. */
function snapshotted() {
  const root = tempDir();
  cpSync(base, root, { recursive: true });
  return root;
}

const append = (root, path, text = '\n// weakened\n') =>
  write(root, path, `${readFileSync(join(root, path), 'utf8')}${text}`);

const changes = (root) => slashes(verifyLock(root));

/** A regexp for one change line: `<kind>: <key>`, the key matching `key`. */
const line = (kind, key) => new RegExp(`^${kind}:\\s+${key}`);

describe('check-test-lock', () => {
  it('reports nothing when nothing changed', () => {
    const root = snapshotted();
    expect(changes(root)).toEqual([]);
  });

  it('keeps its snapshot out of the working tree', () => {
    const root = repo();
    const before = execFileSync('git', ['status', '--porcelain', '-uall'], {
      cwd: root,
      encoding: 'utf8',
    });
    snapshotLock(root);
    expect(
      execFileSync('git', ['status', '--porcelain', '-uall'], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).toBe(before);
  });

  it('throws on verify with no snapshot, and after clearLock', () => {
    const root = repo();
    expect(() => verifyLock(root)).toThrow();
    snapshotLock(root);
    expect(changes(root)).toEqual([]);
    clearLock(root);
    expect(() => verifyLock(root)).toThrow();
  });

  describe('reports a change to each locked kind (criterion 5)', () => {
    it.each([
      [
        'an edited test file',
        (root) => append(root, 'src/lib/a.test.ts'),
        line('modified', 'src/lib/a\\.test\\.ts'),
      ],
      [
        'an added spec file',
        (root) => write(root, 'src/lib/b.spec.ts', 'x\n'),
        line('added', 'src/lib/b\\.spec\\.ts'),
      ],
      [
        'a deleted test file',
        (root) => rmSync(join(root, 'src/lib/a.test.ts')),
        line('deleted', 'src/lib/a\\.test\\.ts'),
      ],
      [
        'an edited file under src/test/',
        (root) => append(root, 'src/test/setup.ts'),
        line('modified', 'src/test/setup\\.ts'),
      ],
      [
        'an added file under src/test/',
        (root) => write(root, 'src/test/fixture.json', '{}\n'),
        line('added', 'src/test/fixture\\.json'),
      ],
      [
        'an edited vitest snapshot',
        (root) => append(root, 'src/lib/__snapshots__/a.test.ts.snap', '\n'),
        line('modified', 'src/lib/__snapshots__/a\\.test\\.ts\\.snap'),
      ],
      [
        'an added vitest.config.ts',
        (root) => write(root, 'vitest.config.ts', 'export default {};\n'),
        line('added', 'vitest\\.config\\.ts'),
      ],
      [
        "a narrowed include in vite.config.ts's test block",
        (root) => write(root, 'vite.config.ts', VITE.replace('src/**', 'src/none/**')),
        line('modified', 'vite\\.config\\.ts'),
      ],
      [
        'a changed test* script',
        (root) => write(root, 'package.json', pkg({ 'test:run': 'vitest run --bail 1' })),
        line('modified', 'package\\.json'),
      ],
      [
        'an added test* script',
        (root) => write(root, 'package.json', pkg({ 'test:e2e': 'echo none' })),
        line('modified', 'package\\.json'),
      ],
      [
        'a changed check:test-lock script',
        (root) => write(root, 'package.json', pkg({ 'check:test-lock': 'exit 0' })),
        line('modified', 'package\\.json'),
      ],
      [
        '.git/info/exclude edited',
        (root) => {
          const path = '.git/info/exclude';
          const old = existsSync(join(root, path))
            ? readFileSync(join(root, path), 'utf8')
            : '';
          write(root, path, `${old}vitest.config.ts\n`);
        },
        line('(modified|added)', '.*info/exclude'),
      ],
      [
        'an edited root .gitignore',
        (root) => append(root, '.gitignore', 'vitest.config.ts\n'),
        line('modified', '\\.gitignore'),
      ],
      [
        'an added nested .gitignore',
        (root) => write(root, 'src/lib/.gitignore', 'b.test.ts\n'),
        line('added', 'src/lib/\\.gitignore'),
      ],
      [
        'an added nested .gitignore that ignores itself',
        (root) => write(root, 'src/lib/.gitignore', '.gitignore\n'),
        line('added', 'src/lib/\\.gitignore'),
      ],
      [
        'an edited scripts/check-test-lock.mjs',
        (root) => append(root, 'scripts/check-test-lock.mjs'),
        line('modified', 'scripts/check-test-lock\\.mjs'),
      ],
      [
        'an edited scripts/lib.mjs',
        (root) => append(root, 'scripts/lib.mjs'),
        line('modified', 'scripts/lib\\.mjs'),
      ],
    ])('%s', (_label, plant, expected) => {
      const root = snapshotted();
      plant(root);
      expect(changes(root)).toEqual([expect.stringMatching(expected)]);
    });

    it('reports a fixture path given at snapshot, and only once it changes', () => {
      const root = repo();
      snapshotLock(root, ['src/content/s/topic.md']);
      expect(changes(root)).toEqual([]);
      append(root, 'src/content/s/topic.md', 'More.\n');
      expect(changes(root)).toEqual([
        expect.stringMatching(line('modified', 'src/content/s/topic\\.md')),
      ]);
    });
  });

  // The whole `verify` string is one hash: any edit to it counts, including
  // a plain step appended at the end.
  describe('any edit to verify (criterion 5)', () => {
    it.each([
      ['a plain step appended', `${SCRIPTS.verify} && npm run check:x`],
      [
        'a plain step inserted',
        'npm run typecheck && npm run check:x && npm run lint && npm run test:run && npm run build',
      ],
      ['a step removed', 'npm run typecheck && npm run lint && npm run test:run'],
      [
        'the test steps reordered',
        'npm run typecheck && npm run test:run && npm run lint && npm run build',
      ],
      ['|| true appended', `${SCRIPTS.verify} || true`],
      ['whitespace changed', SCRIPTS.verify.replace(' && ', '  &&  ')],
    ])('reports %s', (_label, verify) => {
      const root = snapshotted();
      write(root, 'package.json', pkg({ verify }));
      expect(changes(root)).toEqual([
        expect.stringMatching(line('modified', 'package\\.json.*verify')),
      ]);
    });
  });

  // npm runs `pre<name>` and `post<name>` around `npm run <name>`, so one
  // added beside a test script or verify runs inside the gate.
  describe('npm lifecycle scripts around the test scripts and verify', () => {
    it.each(['pretest:run', 'posttest:run', 'pretest', 'preverify', 'postverify'])(
      'reports an added %s',
      (name) => {
        const root = snapshotted();
        write(root, 'package.json', pkg({ [name]: 'node -e "0"' }));
        expect(changes(root)).toEqual([
          expect.stringMatching(line('modified', 'package\\.json')),
        ]);
      },
    );

    it('reports nothing for a lifecycle script around another script', () => {
      const root = snapshotted();
      write(root, 'package.json', pkg({ prebuild: 'node -e "0"' }));
      expect(changes(root)).toEqual([]);
    });
  });

  describe('reports nothing outside the lock (criterion 5)', () => {
    it.each([
      [
        'an edited app file',
        (root) => append(root, 'src/lib/a.ts', 'export const b = 2;\n'),
      ],
      ['an added app file', (root) => write(root, 'src/lib/b.ts', 'export {};\n')],
      ['an edited README', (root) => append(root, 'README.md', 'More.\n')],
      [
        'an edit to vite.config.ts outside the test block',
        (root) =>
          write(root, 'vite.config.ts', VITE.replace('plugins: []', 'plugins: [x()]')),
      ],
      [
        'a changed non-test script in package.json',
        (root) => write(root, 'package.json', pkg({ 'check:colors': 'node x.mjs' })),
      ],
      [
        'an added dependency in package.json',
        (root) =>
          write(root, 'package.json', pkg({}, { dependencies: { react: '^19.0.0' } })),
      ],
    ])('%s', (_label, plant) => {
      const root = snapshotted();
      plant(root);
      expect(changes(root)).toEqual([]);
    });
  });

  it('reports a config part the snapshot lacks as added (criterion 5)', () => {
    const root = snapshotted();
    // The snapshot is a JSON file inside the git directory, keyed by path or
    // config part; drop the `verify` part, as a snapshot taken by an older
    // script would lack it.
    const gitDir = join(root, '.git');
    const [name] = readdirSync(gitDir).filter((file) => {
      if (!file.endsWith('.json')) return false;
      try {
        return Object.keys(JSON.parse(readFileSync(join(gitDir, file), 'utf8'))).some(
          (key) => /verify/.test(key),
        );
      } catch {
        return false;
      }
    });
    expect(name, 'a JSON snapshot in the git directory with a verify part').toBeTruthy();
    const snapshot = JSON.parse(readFileSync(join(gitDir, name), 'utf8'));
    const part = Object.keys(snapshot).find((key) => /verify/.test(key));
    delete snapshot[part];
    write(gitDir, name, JSON.stringify(snapshot, null, 2));
    expect(changes(root)).toEqual([expect.stringMatching(line('added', '.*verify'))]);
  });

  it.each([
    ['a missing file', 'src/content/s/nope.md'],
    ['a directory', 'src/content/s'],
  ])('rejects %s given as a fixture (criterion 5)', (_label, fixture) => {
    const root = repo();
    expect(() => snapshotLock(root, [fixture])).toThrow();
  });

  // The global-ignore layer is gone: the user's own machine files, and git's
  // core.excludesFile, are not part of the lock (criterion 5).
  describe('does not read the global ignore setup', () => {
    const VARS = ['HOME', 'USERPROFILE', 'XDG_CONFIG_HOME'];
    const saved = Object.fromEntries(VARS.map((name) => [name, process.env[name]]));
    afterEach(() => {
      for (const name of VARS) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    });

    /** A home directory whose git global ignore file holds `ignore`. */
    function home(ignore) {
      const dir = tempDir();
      write(dir, '.config/git/ignore', ignore);
      write(dir, 'git/ignore', ignore);
      return dir;
    }

    it('reports nothing when HOME, USERPROFILE and XDG_CONFIG_HOME change', () => {
      const root = repo();
      const first = home('unrelated-a.txt\n');
      for (const name of VARS) process.env[name] = first;
      snapshotLock(root);
      const second = home('unrelated-b.txt\n');
      for (const name of VARS) process.env[name] = second;
      expect(changes(root)).toEqual([]);
    });

    it("reports nothing when core.excludesFile, or the file's contents, change", () => {
      const root = repo();
      write(root, '.hide', 'unrelated-a.txt\n');
      write(root, '.hide2', 'unrelated-b.txt\n');
      snapshotLock(root);
      execFileSync('git', ['config', 'core.excludesFile', '.hide'], { cwd: root });
      expect(changes(root)).toEqual([]);
      write(root, '.hide', 'unrelated-c.txt\n');
      expect(changes(root)).toEqual([]);
      execFileSync('git', ['config', 'core.excludesFile', '.hide2'], { cwd: root });
      expect(changes(root)).toEqual([]);
    });
  });

  // Criterion 2: the one spawn test. An unknown mode never reads or writes a
  // snapshot, so this one touches nothing.
  it('exits 2 with the usage line on an unknown mode, run as a script', () => {
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-test-lock.mjs'), '--bogus'],
      { encoding: 'utf8' },
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/usage/i);
    expect(result.stderr).toMatch(/--snapshot[\s\S]*--verify[\s\S]*--clear/);
  });
});
