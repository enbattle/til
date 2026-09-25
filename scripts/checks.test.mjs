// Planted-violation tests for the guard scripts under scripts/. A guard that
// has only ever passed hasn't been tested (feature/SKILL.md, Stage 3), so each
// case plants the violation the script exists to catch and asserts it fails,
// plus a clean case that must pass. These used to be run by hand and recorded
// only in commit messages; here `verify` runs them.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Vitest runs from the repository root; import.meta.url isn't a file URL under jsdom.
const SCRIPTS = resolve('scripts');
const temps = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'til-checks-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('check-pipeline-log', () => {
  const header = readFileSync(join(SCRIPTS, '../docs/pipeline-log.md'), 'utf8');
  const row = (
    retro,
    { gates = '0', findings = '0/0/0', run = '/feature docs/specs/x.md' } = {},
  ) => `| 2026-09-23 | ${run} | ${gates} | ${findings} | 0 | ${retro} |  |`;
  function check(...rows) {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${rows.join('\n')}\n`);
    return run('check-pipeline-log.mjs', [file]).status;
  }

  it('passes the real, empty log and a well-formed row', () => {
    expect(check()).toBe(0);
    expect(check(row('nothing to change'))).toBe(0);
    expect(check(row('fixed in 4a; no process gap', { findings: '0/1/0, pre:2' }))).toBe(
      0,
    );
  });

  it('passes a row whose columns were padded (Prettier re-pads the table)', () => {
    expect(
      check('|  2026-09-23  |  /feature docs/specs/x.md  | 0 | 0/0/0 | 0 |  ok  |    |'),
    ).toBe(0);
  });

  it.each([
    ['a bare retro after friction', row('nothing to change', { gates: '1 test-lock' })],
    [
      'a retro with punctuation after friction',
      row('Nothing to change.', { findings: '0/1/0' }),
    ],
    ['an empty retro', row('')],
    ['n/a on a /feature row', row('n/a', { findings: '0/1/0' })],
    ['a placeholder retro', row('none')],
    ['an impossible date', row('ok').replace('2026-09-23', '2026-99-99')],
    ['a wrong cell count', '| 2026-09-23 | /feature x | 0 |'],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });

  it('allows n/a only on an add-topic row', () => {
    expect(check(row('n/a', { run: 'add-topic src/content/a/b.md' }))).toBe(0);
  });

  it('fails a row placed after the table ended', () => {
    expect(check(row('ok'), '', row('nothing to change', { gates: '1 x' }))).toBe(1);
  });
});

describe('check-raw-html', () => {
  function repo(files) {
    const root = tempDir();
    mkdirSync(join(root, 'src/components'), { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify(files.pkg ?? { dependencies: {} }),
    );
    for (const [path, content] of Object.entries(files.src ?? {})) {
      writeFileSync(join(root, 'src', path), content);
    }
    return run('check-raw-html.mjs', [], { CHECK_RAW_HTML_ROOT: root }).status;
  }

  it('passes clean code and the allowed CodeBlock usage', () => {
    expect(
      repo({
        src: { 'components/CodeBlock.tsx': 'dangerouslySetInnerHTML={{ __html }}' },
      }),
    ).toBe(0);
  });

  it.each([
    ['rehype-raw installed', { pkg: { dependencies: { 'rehype-raw': '^7' } } }],
    [
      'dangerouslySetInnerHTML elsewhere',
      { src: { 'components/Bad.tsx': 'dangerouslySetInnerHTML={{}}' } },
    ],
    ['an innerHTML write', { src: { 'components/Bad.tsx': 'el.innerHTML = html;' } }],
    [
      'insertAdjacentHTML',
      { src: { 'components/Bad.tsx': "el.insertAdjacentHTML('beforeend', s)" } },
    ],
    ['document.write', { src: { 'components/Bad.tsx': 'document.write(s)' } }],
  ])('fails on %s', (_label, files) => {
    expect(repo(files)).toBe(1);
  });
});

describe('check-test-lock', () => {
  // The script finds the repository from its own location, so each case runs
  // a copy of it inside a throwaway git repository.
  function repo() {
    const root = tempDir();
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    copyFileSync(
      join(SCRIPTS, 'check-test-lock.mjs'),
      join(root, 'scripts/check-test-lock.mjs'),
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { 'test:run': 'vitest run' } }),
    );
    writeFileSync(
      join(root, 'vite.config.ts'),
      "export default {\n  test: {\n    coverage: { enabled: false },\n    include: ['src/**'],\n  },\n};\n",
    );
    writeFileSync(join(root, 'src/lib/a.test.ts'), 'it("a", () => {});\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
    const lock = (mode) =>
      spawnSync(process.execPath, [join(root, 'scripts/check-test-lock.mjs'), mode], {
        encoding: 'utf8',
      }).status;
    return { root, lock };
  }

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
});
