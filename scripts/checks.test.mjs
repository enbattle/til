// Planted-violation tests for the guard scripts under scripts/. A guard that
// has only ever passed hasn't been tested (feature/SKILL.md, Stage 3), so each
// case plants the violation the script exists to catch and asserts it fails,
// plus a clean case that must pass. These used to be run by hand and recorded
// only in commit messages; here `verify` runs them.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { diagramTokens, svgProblems } from './diagram-manifest.mjs';

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

// A guard script copied into a throwaway root runs there as it would in the
// repository, so it needs the shared helpers it imports beside it
// (scripts/lib.mjs, docs/specs/dedupe-app-scripts-tests.md criterion 6).
function copyScripts(root, ...names) {
  mkdirSync(join(root, 'scripts'), { recursive: true });
  for (const name of [...names, 'lib.mjs']) {
    if (existsSync(join(SCRIPTS, name))) {
      copyFileSync(join(SCRIPTS, name), join(root, 'scripts', name));
    }
  }
}

// The scripts list their inputs through `git ls-files` (so .gitignore is
// respected), so a throwaway root must be a git repository.
function gitInit(root) {
  execFileSync('git', ['init', '-q'], { cwd: root });
}

// check-bundle, copied with what it imports: scripts/lib.mjs and
// src/lib/frontmatter.ts (run by Node with its types stripped).
function bundleRoot(root) {
  gitInit(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
  copyScripts(root, 'check-bundle.mjs');
  mkdirSync(join(root, 'src/lib'), { recursive: true });
  copyFileSync(resolve('src/lib/frontmatter.ts'), join(root, 'src/lib/frontmatter.ts'));
}

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
    {
      gates = '0',
      findings = '0/0/0',
      rounds = '0',
      agents = '3',
      run = '/feature docs/specs/x.md',
    } = {},
  ) =>
    `|  2026-09-23  | ${run} | ${gates} | ${findings} | ${rounds} | ${agents} |  ${retro}  |  |`;
  function check(...rows) {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${rows.join('\n')}\n`);
    return run('check-pipeline-log.mjs', [file]).status;
  }

  it('passes the real log and well-formed (padded) rows', () => {
    expect(run('check-pipeline-log.mjs').status).toBe(0);
    expect(check(row('nothing to change'))).toBe(0);
    expect(
      check(
        row('fixed in 4a; no gap', {
          findings: '0/1/0, pre:2',
          rounds: '3 (user-authorized)',
        }),
      ),
    ).toBe(0);
    expect(
      check(
        row('n/a', {
          run: 'add-case-study src/system-design/case-studies/x.md',
          agents: '—',
        }),
      ),
    ).toBe(0);
  });

  it.each([
    [
      'a bare retro after gate failures',
      row('nothing to change', { gates: '1 test-lock' }),
    ],
    ['a bare retro after findings', row('Nothing to change.', { findings: '0/1/0' })],
    ['an empty retro', row('')],
    ['a bad date', row('ok').replace('2026-09-23', '26-9-23')],
    ['a run with no path', row('n/a', { run: 'add-topic' })],
    ['a bad findings cell', row('ok', { findings: '1 high' })],
    ['a fix round past the cap without authorization', row('ok', { rounds: '3' })],
    ['an Agents cell that is not a count', row('ok', { agents: '0' })],
    ['a wrong cell count', '| 2026-09-23 | /feature x | 0 |'],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });
});

describe('check-raw-html', () => {
  function repo(files) {
    const root = tempDir();
    gitInit(root);
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
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    copyScripts(root, 'check-test-lock.mjs');
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

describe('check-diagrams', () => {
  // Interface assumed for scripts/check-diagrams.mjs (spec: "Diagrams (D2)"):
  //
  // - Run as `node scripts/check-diagrams.mjs` with no arguments. The root it
  //   checks is the repository by default, or the directory in the
  //   CHECK_DIAGRAMS_ROOT environment variable (like CHECK_RAW_HTML_ROOT).
  // - Under that root it reads:
  //     src/system-design/diagrams/<case>/<name>.d2          (sources)
  //     public/diagrams/<case>/<name>.light.svg / .dark.svg  (rendered)
  //     public/diagrams/manifest.json                        (lock file)
  //     src/system-design/case-studies/*.md                  (references)
  //     src/index.css                                        (color tokens)
  // - A case study references a diagram as `/diagrams/<case>/<name>.svg` in a
  //   markdown image; that reference exists when both themed SVGs exist.
  // - Exit 0 when clean, non-zero on any violation.
  //
  // Manifest shape (the lock file; `npm run diagrams` writes it, this checks it).
  // It extends the original shape: every source entry keeps `sha256` (and the
  // optional `width`/`height` the app reads), gains `svgs`, and one reserved
  // top-level key, `$tokens`, records the colors the SVGs were rendered with:
  //
  //   {
  //     "$tokens": {
  //       "light": { "<token>": "#rrggbb", ... },   // from src/index.css `:root {`
  //       "dark":  { "<token>": "#rrggbb", ... }    // from src/index.css `.dark {`
  //     },
  //     "<case>/<name>.d2": {
  //       "sha256": "<hex SHA-256 of the .d2, CRLF normalized to LF>",
  //       "width": 811, "height": 1113,             // optional here
  //       "svgs": {
  //         "light": "<hex SHA-256 of <name>.light.svg, CRLF normalized to LF>",
  //         "dark":  "<hex SHA-256 of <name>.dark.svg, CRLF normalized to LF>"
  //       }
  //     }
  //   }
  //
  // - `$tokens` keys are the token names without the `--color-` prefix
  //   (`text-primary`, `accent-soft`, ...) with lowercase `#rrggbb` values, for
  //   the tokens render-diagrams.mjs maps into the D2 theme (its SLOTS table).
  //   The fixture's src/index.css defines exactly those nine tokens per block,
  //   so recording every `--color-*` declaration in the block is equivalent here.
  //   All SVG and token hashes use the same CRLF->LF normalization as `sha256`
  //   (i.e. `sourceHash` from scripts/diagram-manifest.mjs), so a Windows
  //   checkout with autocrlf and CI agree.
  // - check-diagrams fails when `$tokens` is missing, when a recorded token
  //   value differs from (or is missing in) src/index.css, when an entry has no
  //   `svgs` or an SVG's bytes don't hash to its recorded value, and when the
  //   tokens in src/index.css would put D2 text below WCAG AA (4.5:1) on a fill,
  //   using render-diagrams.mjs's TEXT_ON pairs. `$tokens` is not a source, so
  //   it is never reported as "lists a source that no longer exists".
  // - It also rejects any `.d2` source that names a color, by any syntax (the
  //   render script's own guard only runs where d2 is installed; CI runs this).
  const SOURCE = 'direction: right\nclient -> api: POST /urls\napi -> db: insert\n';
  const SVG = (extra = '') =>
    `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50" width="100" height="50"><defs><marker id="arrow"><path d="M0 0L10 5"/></marker></defs><rect width="10" height="10"/><use href="#arrow"/><use xlink:href="#arrow"/>${extra}</svg>\n`;
  const sha256 = (text) =>
    createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
  const CASE_STUDY = (extra = '') =>
    `---\ntitle: Design a Demo\nsummary: A demo.\ndate: 2026-09-28\norder: 1\n---\n\n## High-level architecture\n\n![The request flow](/diagrams/demo/flow.svg)\n${extra}`;

  // The nine tokens render-diagrams.mjs maps into the D2 theme, with the
  // site's current values (all pairs in its TEXT_ON table pass 4.5:1).
  const TOKENS = {
    light: {
      'bg-primary': '#faf6f0',
      'bg-secondary': '#f2ebe0',
      'bg-tertiary': '#ece2d3',
      'text-primary': '#2b2420',
      'text-secondary': '#5c5147',
      'text-tertiary': '#6e6356',
      border: '#ddd1bf',
      accent: '#92400e',
      'accent-soft': '#f3e3c8',
    },
    dark: {
      'bg-primary': '#201a14',
      'bg-secondary': '#2a231b',
      'bg-tertiary': '#342c22',
      'text-primary': '#f2e9dc',
      'text-secondary': '#c9bba6',
      'text-tertiary': '#a39683',
      border: '#3d3428',
      accent: '#f0a83c',
      'accent-soft': '#3d2f16',
    },
  };
  const CSS = (tokens = TOKENS) => {
    const block = (selector, values) =>
      `${selector} {\n${Object.entries(values)
        .map(([name, hex]) => `  --color-${name}: ${hex};`)
        .join('\n')}\n}\n`;
    return `@import 'tailwindcss';\n\n${block(':root', tokens.light)}\n${block('.dark', tokens.dark)}`;
  };

  function write(root, path, content) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  /** Every file under `dir` (recursively) ending in `suffix`, relative, with `/`. */
  function list(dir, suffix, base = dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) list(path, suffix, base, files);
      else if (entry.endsWith(suffix))
        files.push(relative(base, path).split('\\').join('/'));
    }
    return files;
  }

  /** The `--color-*` values in one src/index.css block, as render-diagrams reads them. */
  function cssTokens(css, selector) {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf('}', start));
    const values = {};
    for (const [, name, hex] of block.matchAll(
      /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g,
    )) {
      values[name] = hex.toLowerCase();
    }
    return values;
  }

  /** What `npm run diagrams` would record for the fixture as it is on disk now
   * (without re-rendering): the manifest in the shape documented above. */
  function lock(root) {
    const sources = join(root, 'src/system-design/diagrams');
    const rendered = join(root, 'public/diagrams');
    const css = readFileSync(join(root, 'src/index.css'), 'utf8');
    const manifest = {
      $tokens: { light: cssTokens(css, ':root'), dark: cssTokens(css, '.dark') },
    };
    for (const source of list(sources, '.d2').sort()) {
      const name = source.replace(/\.d2$/, '');
      const svgs = {};
      let size = {};
      for (const theme of ['light', 'dark']) {
        const path = join(rendered, `${name}.${theme}.svg`);
        if (!existsSync(path)) continue;
        const svg = readFileSync(path, 'utf8');
        svgs[theme] = sha256(svg);
        const viewBox = /<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(
          svg,
        );
        if (viewBox) {
          size = {
            width: Math.round(Number(viewBox[1])),
            height: Math.round(Number(viewBox[2])),
          };
        }
      }
      manifest[source] = {
        sha256: sha256(readFileSync(join(sources, source), 'utf8')),
        ...size,
        svgs,
      };
    }
    write(
      root,
      'public/diagrams/manifest.json',
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  function editManifest(root, edit) {
    const path = join(root, 'public/diagrams/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    edit(manifest);
    writeFileSync(path, JSON.stringify(manifest, null, 2));
  }

  /** A clean fixture: one case study referencing one diagram, rendered and locked. */
  function repo() {
    const root = tempDir();
    gitInit(root);
    write(root, 'src/index.css', CSS());
    write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE);
    write(root, 'public/diagrams/demo/flow.light.svg', SVG());
    write(root, 'public/diagrams/demo/flow.dark.svg', SVG());
    write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY());
    lock(root);
    const result = () => run('check-diagrams.mjs', [], { CHECK_DIAGRAMS_ROOT: root });
    const check = () => result().status;
    return { root, check, result };
  }

  /** Replace the fixture's SVG and re-lock, so only its content is under test
   * (not the SVG-hash lock). */
  const plantSvg = (path, svg) => (root) => {
    write(root, path, svg);
    lock(root);
  };
  /** Replace the fixture's `.d2` source and re-lock, so only its content is
   * under test (not the staleness check). */
  const plantSource = (source) => (root) => {
    write(root, 'src/system-design/diagrams/demo/flow.d2', source);
    lock(root);
  };

  it('passes on the repository itself', () => {
    expect(run('check-diagrams.mjs').status).toBe(0);
  });

  it('passes a clean fixture (internal #fragment hrefs and xmlns URLs are fine)', () => {
    const { result } = repo();
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('passes a clean fixture whose source has CRLF line endings', () => {
    const { root, check } = repo();
    write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE.replace(/\n/g, '\r\n'));
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose SVGs have CRLF line endings (autocrlf checkout)', () => {
    const { root, check } = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', SVG().replace(/\n/g, '\r\n'));
    write(root, 'public/diagrams/demo/flow.dark.svg', SVG().replace(/\n/g, '\r\n'));
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose SVG text has escaped characters in text content', () => {
    // D2 escapes `&`, `<` and quotes in labels; entity references are only
    // suspicious inside attribute values.
    const { root, check } = repo();
    plantSvg(
      'public/diagrams/demo/flow.light.svg',
      SVG(
        '<g><text x="1" y="1">reads &amp; writes &lt; 1 ms, &#34;hot&#34; keys</text></g>',
      ),
    )(root);
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose source uses non-color styles', () => {
    const { root, check } = repo();
    plantSource(
      `${SOURCE}db.shape: cylinder\napi: API {\n  style.multiple: true\n  style.stroke-dash: 3\n  style.bold: true\n}\n`,
    )(root);
    expect(check()).toBe(0);
  });

  // Review L7: `#` followed by a number or word in a label or comment is not a
  // color. check-diagrams is the only hex guard over `.d2` files.
  it.each([
    ['a label with an issue number', `${SOURCE}x: "Issue #123"\n`],
    ['a comment', `# add a node\n${SOURCE}`],
    ['a trailing comment', `${SOURCE}x: Cache # add a node later\n`],
  ])('passes a .d2 with # that is not a color: %s', (_label, source) => {
    const { root, result } = repo();
    plantSource(source)(root);
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('passes a copy of a real committed D2 v0.9 diagram (url-shortener/architecture)', () => {
    // Keeps the SVG allowlist honest: whatever check-diagrams permits must
    // include everything real d2 output uses (nested <svg>, <style> with a
    // data: font URL, <g>, <mask>, <marker>, <polygon>, ...).
    const repoRoot = resolve('.');
    const root = tempDir();
    gitInit(root);
    write(root, 'src/index.css', CSS());
    for (const [from, to] of [
      [
        'src/system-design/diagrams/url-shortener/architecture.d2',
        'src/system-design/diagrams/url-shortener/architecture.d2',
      ],
      [
        'public/diagrams/url-shortener/architecture.light.svg',
        'public/diagrams/url-shortener/architecture.light.svg',
      ],
      [
        'public/diagrams/url-shortener/architecture.dark.svg',
        'public/diagrams/url-shortener/architecture.dark.svg',
      ],
    ]) {
      mkdirSync(dirname(join(root, to)), { recursive: true });
      copyFileSync(join(repoRoot, from), join(root, to));
    }
    write(
      root,
      'src/system-design/case-studies/url-shortener.md',
      '---\ntitle: Design a URL Shortener\nsummary: A demo.\ndate: 2026-09-28\norder: 1\n---\n\n## High-level architecture\n\n![The architecture](/diagrams/url-shortener/architecture.svg)\n',
    );
    lock(root);
    const { status, stderr } = run('check-diagrams.mjs', [], {
      CHECK_DIAGRAMS_ROOT: root,
    });
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  // A diagram wider than 960 px scales below 0.75 in the ~720 px column
  // (add-case-study checklist item 5), so its recorded width fails the check.
  const wideSvg = (width) =>
    SVG().replace(
      'viewBox="0 0 100 50" width="100"',
      `viewBox="0 0 ${width} 50" width="${width}"`,
    );
  it.each([
    [960, 0],
    [961, 1],
  ])('checks the recorded width: %i px exits %i', (width, expected) => {
    const { root, result } = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', wideSvg(width));
    plantSvg('public/diagrams/demo/flow.dark.svg', wideSvg(width))(root);
    const { status, stderr } = result();
    expect(status).toBe(expected);
    if (expected) expect(stderr).toMatch(/demo\/flow\.d2: .*961 px wide.*960/);
    else expect(stderr).toBe('');
  });

  it.each([
    [
      'an edited .d2 without re-render',
      (root) =>
        write(
          root,
          'src/system-design/diagrams/demo/flow.d2',
          `${SOURCE}db -> cache: warm\n`,
        ),
    ],
    [
      'a .d2 with no manifest entry',
      (root) => {
        write(root, 'src/system-design/diagrams/demo/extra.d2', SOURCE);
        write(root, 'public/diagrams/demo/extra.light.svg', SVG());
        write(root, 'public/diagrams/demo/extra.dark.svg', SVG());
      },
    ],
    [
      'a missing .dark.svg',
      (root) => rmSync(join(root, 'public/diagrams/demo/flow.dark.svg')),
    ],
    [
      'a missing .light.svg',
      (root) => rmSync(join(root, 'public/diagrams/demo/flow.light.svg')),
    ],
    [
      'an orphan SVG with no source',
      (root) => write(root, 'public/diagrams/demo/ghost.light.svg', SVG()),
    ],
    [
      'an SVG containing <script>',
      plantSvg('public/diagrams/demo/flow.dark.svg', SVG('<script>alert(1)</script>')),
    ],
    [
      'an SVG with an onload= attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<rect onload="alert(1)" width="1" height="1"/>'),
      ),
    ],
    [
      'an SVG with an external href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a href="https://evil.example/"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with an external xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<image xlink:href="http://evil.example/x.png" width="1" height="1"/>'),
      ),
    ],
    [
      'a case study referencing a nonexistent diagram',
      (root) =>
        write(
          root,
          'src/system-design/case-studies/demo.md',
          CASE_STUDY('\n![Missing](/diagrams/demo/missing.svg)\n'),
        ),
    ],

    // --- M2: SVG content that runs script or loads content some other way.
    // Each plant re-locks the manifest, so only the content is under test.
    [
      'an SVG with a <foreignObject>',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
        ),
      ),
    ],
    [
      'an SVG with an <iframe>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<iframe src="#arrow" width="1" height="1"></iframe>'),
      ),
    ],
    [
      'an SVG with a srcdoc= attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<g srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"><text>x</text></g>'),
      ),
    ],
    [
      'an SVG with <set> rewriting an href to javascript:',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with <animate> rewriting an href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          '<a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a>',
        ),
      ),
    ],
    [
      'an SVG with a decimal character reference in an href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a href="&#106;avascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a hex character reference in an href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<a href="&#x6A;avascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a character reference in an xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a xlink:href="&#x6a;&#x61;vascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a character reference in any attribute value',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<rect width="&#49;0" height="10"/>'),
      ),
    ],
    [
      'an SVG with <use href="data:...">',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>'),
      ),
    ],
    [
      'an SVG with a data: URL in an xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          '<image xlink:href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" width="1" height="1"/>',
        ),
      ),
    ],
    [
      'an SVG with an element outside the allowlist (<embed>)',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<embed src="#arrow" width="1" height="1"/>'),
      ),
    ],

    // --- M3: the lock covers the rendered SVG bytes and the color tokens.
    [
      'a committed SVG edited without re-render (one color changed)',
      (root) =>
        write(
          root,
          'public/diagrams/demo/flow.light.svg',
          SVG().replace(
            '<rect width="10" height="10"/>',
            '<rect width="10" height="10" fill="red"/>',
          ),
        ),
    ],
    [
      'a manifest entry with no svgs hashes',
      (root) => editManifest(root, (manifest) => delete manifest['demo/flow.d2'].svgs),
    ],
    [
      'a manifest with no $tokens',
      (root) => editManifest(root, (manifest) => delete manifest.$tokens),
    ],
    [
      'a --color-* token in src/index.css changed without re-render',
      (root) =>
        write(
          root,
          'src/index.css',
          CSS({ ...TOKENS, light: { ...TOKENS.light, accent: '#1d4ed8' } }),
        ),
    ],
    [
      'a dark --color-* token in src/index.css changed without re-render',
      (root) =>
        write(
          root,
          'src/index.css',
          CSS({ ...TOKENS, dark: { ...TOKENS.dark, 'bg-secondary': '#2b231b' } }),
        ),
    ],

    // --- L5: a .d2 source naming a color by any syntax, not just hex. Each
    // plant re-locks, so only the color guard can fail it.
    ['a .d2 with x.style.fill: red', plantSource(`${SOURCE}api.style.fill: red\n`)],
    [
      'a .d2 with an inline {style.fill: red}',
      plantSource(`${SOURCE}cache: Cache {style.fill: red}\n`),
    ],
    [
      'a .d2 with style.font-color: green',
      plantSource(`${SOURCE}db: DB {\n  style.font-color: green\n}\n`),
    ],
    [
      'a .d2 with a nested style map setting fill',
      plantSource(`${SOURCE}api: API {\n  style: {\n    fill: red\n  }\n}\n`),
    ],
    [
      'a .d2 with a connection style.stroke',
      plantSource(`${SOURCE}(client -> api)[0].style.stroke: blue\n`),
    ],

    // --- Review M1: CSS that loads an external resource without a literal
    // `url(`. Each plant re-locks, so only the SVG allowlist can fail it.
    [
      'an SVG with image-set() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          `<rect width="1" height="1" style="mask-image:image-set('http://x.example/a.png' 1x)"/>`,
        ),
      ),
    ],
    [
      'an SVG with -webkit-image-set() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          `<rect width="1" height="1" style="-webkit-mask-image:-webkit-image-set('http://x.example/a.png' 1x)"/>`,
        ),
      ),
    ],
    [
      'an SVG with a CSS-escaped url() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<rect width="1" height="1" style="mask-image:u\\72l(http://x.example/a.png)"/>',
        ),
      ),
    ],
    [
      'an SVG with a backslash in an attribute value',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<rect width="1" height="1" class="a\\62 c"/>'),
      ),
    ],
    [
      'an SVG whose root <svg> has an image-set() background',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG().replace(
          '<svg xmlns=',
          `<svg style="background-image:image-set('http://x.example/a.png' 1x)" xmlns=`,
        ),
      ),
    ],
    [
      'an SVG with image-set() inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<style>.x{background:image-set("http://x.example/a.png" 1x)}</style>'),
      ),
    ],
    [
      'an SVG with cross-fade() inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<style>.x{background:cross-fade("http://x.example/a.png" 50%, "http://x.example/b.png")}</style>',
        ),
      ),
    ],
    [
      'an SVG with a bare-string @import inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<style>@import "http://x.example/a.css";</style>'),
      ),
    ],

    // --- Review L3: D2 imports pull in files outside the source hash and the
    // color guard. Each plant re-locks, so only an import check can fail it.
    ['a .d2 spreading an import (...@other)', plantSource(`${SOURCE}...@other\n`)],
    ['a .d2 importing as a value (x: @../other)', plantSource(`${SOURCE}x: @../other\n`)],
    [
      'a .d2 importing inside a block',
      plantSource(`${SOURCE}api: API {\n  ...@shared\n}\n`),
    ],

    // --- Review L7: a real hex color is still caught.
    [
      'a .d2 with style.fill: "#ff0000"',
      plantSource(`${SOURCE}x.style.fill: "#ff0000"\n`),
    ],
    [
      'a .d2 with a hex color as a whole quoted value',
      plantSource(`${SOURCE}vars: {\n  brand: "#ff0000"\n}\n`),
    ],
  ])('fails on %s', (_label, plant) => {
    const { root, check } = repo();
    expect(check()).toBe(0);
    plant(root);
    expect(check()).not.toBe(0);
  });

  it('names the stale SVG when its bytes no longer match the manifest', () => {
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(
      root,
      'public/diagrams/demo/flow.dark.svg',
      SVG('<rect width="1" height="1"/>'),
    );
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/flow\.dark\.svg/);
  });

  it('names the tokens when src/index.css no longer matches the manifest', () => {
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(
      root,
      'src/index.css',
      CSS({ ...TOKENS, light: { ...TOKENS.light, accent: '#1d4ed8' } }),
    );
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/accent|index\.css|token/i);
  });

  // --- M3 contrast: CI enforces what render-diagrams checks before rendering.
  // The tokens and manifest agree (as if re-rendered), so only contrast fails.
  it.each([
    [
      'dark text-secondary (connection labels) on the dark accent-soft fill',
      { ...TOKENS, dark: { ...TOKENS.dark, 'text-secondary': '#5a4a35' } },
    ],
    [
      'light text-primary (labels) on the light bg-tertiary fill',
      { ...TOKENS, light: { ...TOKENS.light, 'text-primary': '#a89c8c' } },
    ],
  ])('fails when tokens put diagram text below 4.5:1: %s', (_label, tokens) => {
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(root, 'src/index.css', CSS(tokens));
    lock(root);
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/4\.5|contrast/i);
  });

  // --- Review M2: "referenced" means exactly "would render as a diagram", so
  // the reference check parses the case study with the site's markdown stack
  // (remark-parse + remark-gfm) instead of matching one line at a time. Every
  // markdown image syntax that renders a `/diagrams/...svg` image counts, and
  // an example shown as code doesn't.
  const IMAGE_SYNTAXES = (path) => [
    [
      'an image whose alt text wraps onto a second line',
      `![A long alt text that\nwraps onto the next line](${path})`,
    ],
    [
      'an image whose alt text wraps across three lines',
      `![A long alt text that\nwraps onto the next line\nand onto a third](${path})`,
    ],
    ['a reference-style image', `![x][miss]\n\n[miss]: ${path}`],
    ['an image with an angle-bracket destination', `![x](<${path}>)`],
    ['an image with a title', `![x](${path} "Title")`],
  ];

  it.each(IMAGE_SYNTAXES('/diagrams/demo/nope.svg'))(
    'fails, naming the case study and the path, on a missing diagram referenced by %s',
    (_label, markdown) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toMatch(/demo\.md/);
      expect(stderr).toMatch(/demo\/nope/);
    },
  );

  it.each(IMAGE_SYNTAXES('/diagrams/demo/flow.svg'))(
    'passes an existing diagram referenced by %s',
    (_label, markdown) => {
      const { root, result } = repo();
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      const { status, stderr } = result();
      expect(stderr).toBe('');
      expect(status).toBe(0);
    },
  );

  it.each([
    ['a fenced code block', '```md\n![x](/diagrams/demo/nope.svg)\n```'],
    ['a tilde-fenced code block', '~~~\n![x](/diagrams/demo/nope.svg)\n~~~'],
    ['inline code', 'Write `![x](/diagrams/demo/nope.svg)` on its own line.'],
    ['an indented code block', '    ![x](/diagrams/demo/nope.svg)'],
  ])('passes a missing diagram path shown only inside %s', (_label, markdown) => {
    const { root, result } = repo();
    write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY(`\n${markdown}\n`));
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  // --- Review L1: public/diagrams/ holds only `<case>/<name>.light.svg`,
  // `<case>/<name>.dark.svg` and the root manifest.json. Anything else fails
  // and is named, even when its extension isn't a lowercase `.svg`.
  it.each([
    ['an uppercase .SVG extension', 'public/diagrams/demo/extra.light.SVG', SVG()],
    ['an .xml file', 'public/diagrams/demo/extra.xml', SVG()],
    ['an .html page', 'public/diagrams/demo/page.html', '<!doctype html><p>x</p>\n'],
    ['a stray notes.txt', 'public/diagrams/demo/notes.txt', 'notes\n'],
    ['a stray file at the root', 'public/diagrams/notes.txt', 'notes\n'],
  ])(
    'fails on an unexpected file under public/diagrams/: %s',
    (_label, path, content) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      write(root, path, content);
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toContain(path.replace('public/diagrams/', ''));
    },
  );

  /** Plant a complete, locked diagram (source and both SVGs) at `name`, so only
   * the path rules can fail it. */
  function plantDiagram(root, name) {
    write(root, `src/system-design/diagrams/${name}.d2`, SOURCE);
    write(root, `public/diagrams/${name}.light.svg`, SVG());
    write(root, `public/diagrams/${name}.dark.svg`, SVG());
    lock(root);
  }

  it('fails on rendered SVGs nested deeper than public/diagrams/<case>/', () => {
    const { root, check } = repo();
    expect(check()).toBe(0);
    plantDiagram(root, 'demo/sub/deep');
    expect(check()).not.toBe(0);
  });

  // --- Review L3: sources follow render-diagrams.mjs's naming rule,
  // /^[a-z0-9-]+\/[a-z0-9-]+\.d2$/ (lowercase kebab-case `<case>/<name>.d2`,
  // one level deep). check-diagrams enforces it without d2, naming the source.
  it.each([
    ['an uppercase name', 'url-shortener/Architecture', 'Architecture.d2'],
    [
      'an uppercase, underscored case folder',
      'URL_Shortener/arch',
      'URL_Shortener/arch.d2',
    ],
    ['a source with no case folder', 'top', 'top.d2'],
    ['a source nested two levels deep', 'demo/sub/deep', 'demo/sub/deep.d2'],
  ])(
    'fails on a .d2 source path that breaks the naming rule: %s',
    (_label, name, shown) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      plantDiagram(root, name);
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toContain(shown);
    },
  );
});

describe('check-bundle covers case-study bodies (criterion 5)', () => {
  // The script finds the repository from its own location, so each case runs a
  // copy of it inside a throwaway directory with a fake build output.
  const TOPIC_LINE =
    'Topic body sentence that is long enough to be checked by the guard.';
  const CASE_LINE =
    'Case study body sentence that is long enough to be checked by the guard too.';

  function check(assets) {
    const root = tempDir();
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    bundleRoot(root);
    write(
      'src/content/alpha/topic.md',
      `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
    );
    write(
      'src/system-design/case-studies/demo.md',
      `---\ntitle: C\nsummary: S.\ndate: 2026-09-28\norder: 1\n---\n\n${CASE_LINE}\n`,
    );
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    }).status;
  }

  it('passes when each body is in its own lazy chunk', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js"); import("./demo-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
        'demo-1.js': `export default ${JSON.stringify(CASE_LINE)};`,
      }),
    ).toBe(0);
  });

  it('fails when a case-study body is inlined in the main chunk', () => {
    expect(
      check({
        'index-abc.js': `const body = ${JSON.stringify(CASE_LINE)}; import("./topic-1.js");`,
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });

  it('fails when a case-study body is in no chunk at all', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });
});

describe('check-bundle covers DSA entry bodies (DSA criterion 4)', () => {
  const TOPIC_LINE =
    'Topic body sentence that is long enough to be checked by the guard.';
  const DSA_LINE =
    'Binary search keeps a half-open range and halves it until one index is left.';

  function check(assets) {
    const root = tempDir();
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    bundleRoot(root);
    write(
      'src/content/alpha/topic.md',
      `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
    );
    write(
      'src/dsa/entries/binary-search.md',
      `---\ntitle: B\nsummary: S.\ndate: 2026-09-30\nkind: algorithm\n---\n\n## Prerequisites\n\n${DSA_LINE}\n`,
    );
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    });
  }

  it('passes when the DSA body is in its own lazy chunk', () => {
    const result = check({
      'index-abc.js': 'import("./topic-1.js"); import("./binary-search-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      'binary-search-1.js': `export default ${JSON.stringify(DSA_LINE)};`,
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it('fails, naming the file, when a DSA body is inlined in the main chunk', () => {
    const result = check({
      'index-abc.js': `const body = ${JSON.stringify(DSA_LINE)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/binary-search\.md/);
  });

  it('fails when a DSA body is in no chunk at all', () => {
    const result = check({
      'index-abc.js': 'import("./topic-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/binary-search\.md/);
  });
});

describe('svgProblems rejects fetch and script vectors (retro regression guard)', () => {
  // Each vector is injected into a copy of a real committed SVG, so the only
  // thing wrong with it is the vector. Most go inside d2's inner <svg> (right
  // after its opening tag), some into the root tag, the <style> CDATA, the
  // @font-face, or the prolog. The URLs are placeholders that can't resolve.
  // (encoding="utf-7" was in the original probe too; it lives in the next
  // describe, since it is the one vector the allowlist accepted.)
  const base = readFileSync(
    resolve('public/diagrams/url-shortener/architecture.light.svg'),
    'utf8',
  );
  const innerOpen = base.indexOf('<svg', base.indexOf('<svg') + 4);
  const firstInner = base.indexOf('>', innerOpen) + 1;
  const at = (s) => base.slice(0, firstInner) + s + base.slice(firstInner);
  const root = (attr) => base.replace('<svg ', `<svg ${attr} `);
  const inStyle = (css) => base.replace('<![CDATA[', `<![CDATA[\n${css}\n`);
  const U = (n) => `http://example.invalid/${n}`;

  const VECTORS = {
    image: at(`<image href="${U('image')}" width="1" height="1"/>`),
    imageXlink: at(`<image xlink:href="${U('imagex')}" width="1" height="1"/>`),
    use: at(`<use href="${U('use')}#a"/>`),
    feImage: at(`<filter id="f"><feImage href="${U('feimage')}"/></filter>`),
    aHref: at(`<a href="${U('a')}"><rect width="1" height="1"/></a>`),
    styleAttrUrl: at(`<rect width="1" height="1" style="fill:url(${U('sattr')})"/>`),
    styleAttrUrlNoQuote: at(
      `<rect width="1" height="1" style="mask:url(${U('smask')})"/>`,
    ),
    styleAttrImageSet: at(
      `<rect width="1" height="1" style="mask-image:image-set(${U('iset')} 1x)"/>`,
    ),
    fillAttrUrl: at(`<rect width="1" height="1" fill="url(${U('fillurl')})"/>`),
    fillAttrUrlUpper: at(`<rect width="1" height="1" fill="URL(${U('fillurlup')})"/>`),
    markerAttr: at(`<path d="M0 0L1 1" marker-end="url(${U('marker')}#m)"/>`),
    maskAttrSpaced: at(`<rect width="1" height="1" mask="url( ${U('maskspace')} )"/>`),
    styleImport: inStyle(`@import url(${U('import')});`),
    styleImportBare: inStyle(`@import '${U('importbare')}';`),
    styleBg: inStyle(`.x{background:url(${U('stylebg')})}`),
    styleBgUpper: inStyle(`.x{background:URL(${U('stylebgup')})}`),
    styleEscape: inStyle(`.x{background:\\75rl(${U('esc')})}`),
    styleFontFaceExtra: base.replace(
      'src: url("data:',
      `src: url(${U('ff')}), url("data:`,
    ),
    xmlStylesheet: base.replace('?>', `?><?xml-stylesheet href="${U('xss')}"?>`),
    doctypeEntity: base.replace(
      '?>',
      `?><!DOCTYPE svg [<!ENTITY e SYSTEM "${U('ent')}">]>`,
    ),
    nsPrefix: at(`<x:image xmlns:x="http://www.w3.org/2000/svg" href="${U('ns')}"/>`),
    attrCase: at(`<image HREF="${U('case')}" width="1" height="1"/>`),
    tabWhitespace: at(`<image\thref="${U('tab')}"\twidth="1"\theight="1"/>`),
    cdataSplit: base.replace(
      '<![CDATA[',
      `<![CDATA[ .x{background:url(${U('cdata')})} ]]><![CDATA[`,
    ),
    onload: root(`onload="fetch('${U('onload')}')"`),
    script: at(`<script>fetch('${U('script')}')</script>`),
    foreignObject: at(
      `<foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="${U('fo')}"/></foreignObject>`,
    ),
    animate: at(
      `<a><animate attributeName="href" to="${U('anim')}"/><rect width="1" height="1"/></a>`,
    ),
    cursor: at(`<rect width="1" height="1" cursor="url(${U('cursor')}),auto"/>`),
    clipPath: at(`<rect width="1" height="1" clip-path="url(${U('clip')}#c)"/>`),
    filterAttr: at(`<rect width="1" height="1" filter="url(${U('filt')}#f)"/>`),
    fontFamilyUrl: inStyle(`.x{font-family:"a";src:url(${U('ffsrc')})}`),
  };

  it('accepts the unmodified committed SVG', () => {
    expect(svgProblems(base)).toEqual([]);
  });

  it('injects every vector (each one changes the file)', () => {
    for (const svg of Object.values(VECTORS)) expect(svg).not.toBe(base);
  });

  it.each(Object.entries(VECTORS))('rejects %s', (_name, svg) => {
    expect(svgProblems(svg).length).toBeGreaterThan(0);
  });
});

describe('svgProblems accepts only a UTF-8 XML declaration (retro)', () => {
  // A declared encoding other than UTF-8 makes the parser decode the bytes
  // differently from how the allowlist read them (UTF-7 can spell `<script>`
  // as `+ADw-script+AD4-`), so the allowlist only means anything for UTF-8.
  const svg = (decl) =>
    `${decl}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="1" height="1"/></svg>\n`;

  it.each([
    ['encoding="utf-8"', '<?xml version="1.0" encoding="utf-8"?>'],
    ['encoding="UTF-8"', '<?xml version="1.0" encoding="UTF-8"?>'],
    ['no encoding attribute', '<?xml version="1.0"?>'],
    ['no XML declaration', ''],
  ])('accepts %s', (_label, decl) => {
    expect(svgProblems(svg(decl))).toEqual([]);
  });

  it.each([
    ['utf-7', '<?xml version="1.0" encoding="utf-7"?>'],
    ['UTF-7', '<?xml version="1.0" encoding="UTF-7"?>'],
    ['ISO-8859-1', '<?xml version="1.0" encoding="ISO-8859-1"?>'],
    ['utf-16', '<?xml version="1.0" encoding="utf-16"?>'],
    ['windows-1252', '<?xml version="1.0" encoding="windows-1252"?>'],
  ])('rejects encoding="%s"', (_label, decl) => {
    expect(svgProblems(svg(decl)).length).toBeGreaterThan(0);
  });

  // Retro: the declaration is an allowlist of its own. The only accepted shape
  // is `<?xml version="1.0"` then optionally ` encoding="utf-8"` (any case)
  // then optionally ` standalone="yes|no"`, in that order, each at most once,
  // single spaces, double quotes, then `?>`. Anything else, including a
  // duplicate encoding whose second value a parser might honor, is rejected.
  it.each([
    ['encoding="Utf-8"', '<?xml version="1.0" encoding="Utf-8"?>'],
    ['standalone="yes"', '<?xml version="1.0" standalone="yes"?>'],
    ['standalone="no"', '<?xml version="1.0" standalone="no"?>'],
    [
      'encoding then standalone',
      '<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
    ],
  ])('accepts %s', (_label, decl) => {
    expect(svgProblems(svg(decl))).toEqual([]);
  });

  it.each([
    [
      'a duplicate encoding (utf-8 then utf-7)',
      '<?xml version="1.0" encoding="utf-8" encoding="utf-7"?>',
    ],
    [
      'a duplicate encoding (utf-8 twice)',
      '<?xml version="1.0" encoding="utf-8" encoding="utf-8"?>',
    ],
    ['a duplicate version', '<?xml version="1.0" version="1.0"?>'],
    ['a duplicate standalone', '<?xml version="1.0" standalone="yes" standalone="no"?>'],
    ['encoding before version', '<?xml encoding="utf-8" version="1.0"?>'],
    [
      'standalone before encoding',
      '<?xml version="1.0" standalone="yes" encoding="utf-8"?>',
    ],
    ['no version', '<?xml encoding="utf-8"?>'],
    ['an empty declaration', '<?xml?>'],
    ['version 1.1', '<?xml version="1.1"?>'],
    ['an unknown attribute', '<?xml version="1.0" foo="bar"?>'],
    [
      'an unknown attribute after encoding',
      '<?xml version="1.0" encoding="utf-8" x="y"?>',
    ],
    ['standalone="maybe"', '<?xml version="1.0" standalone="maybe"?>'],
    ['single quotes', "<?xml version='1.0' encoding='utf-8'?>"],
    ['a double space', '<?xml version="1.0"  encoding="utf-8"?>'],
    ['a tab separator', '<?xml version="1.0"\tencoding="utf-8"?>'],
    ['a newline separator', '<?xml version="1.0"\nencoding="utf-8"?>'],
    ['a space before ?>', '<?xml version="1.0" ?>'],
    ['an uppercase XML target', '<?XML version="1.0"?>'],
    ['encoding="utf8"', '<?xml version="1.0" encoding="utf8"?>'],
  ])('rejects %s', (_label, decl) => {
    expect(svgProblems(svg(decl)).length).toBeGreaterThan(0);
  });

  it('accepts the exact declaration the committed SVGs use', () => {
    const base = readFileSync(
      resolve('public/diagrams/url-shortener/architecture.light.svg'),
      'utf8',
    );
    expect(base.startsWith('<?xml version="1.0" encoding="utf-8"?><svg ')).toBe(true);
    expect(svgProblems(base)).toEqual([]);
  });

  it('rejects utf-7 in a copy of the committed SVG (the probe vector)', () => {
    const base = readFileSync(
      resolve('public/diagrams/url-shortener/architecture.light.svg'),
      'utf8',
    );
    expect(base).toContain('encoding="utf-8"');
    expect(
      svgProblems(base.replace('encoding="utf-8"', 'encoding="utf-7"')).length,
    ).toBeGreaterThan(0);
  });
});

// The token parsing itself is tested once, in css-tokens.test.mjs. Each
// consumer below gets one test that it reads the real tokens through it.
describe('the token consumers read the real src/index.css', () => {
  const realCss = readFileSync(resolve('src/index.css'), 'utf8');
  const lightText = /(--color-text-primary:\s*)#[0-9a-f]{6}/;
  // check-contrast and check-design-tokens have no root override, so each runs
  // as a copy (with the shared reader) beside its own src/index.css and docs.
  function copyRun(script, css) {
    const root = tempDir();
    for (const dir of ['src', 'docs']) mkdirSync(join(root, dir));
    copyScripts(root, 'css-tokens.mjs', script);
    writeFileSync(join(root, 'src/index.css'), css);
    copyFileSync(resolve('docs/DESIGN.md'), join(root, 'docs/DESIGN.md'));
    return spawnSync(process.execPath, [join(root, 'scripts', script)], {
      encoding: 'utf8',
    });
  }

  it('diagramTokens records the real light and dark values', () => {
    const { tokens, problems } = diagramTokens(realCss);
    expect(problems).toEqual([]);
    expect(tokens.light['text-primary']).toBe(lightText.exec(realCss)[0].slice(-7));
    expect(tokens.light['bg-primary']).not.toBe(tokens.dark['bg-primary']);
  });

  it('check-contrast passes the real palette and fails a planted low-contrast token', () => {
    expect(copyRun('check-contrast.mjs', realCss).status).toBe(0);
    const { status, stderr } = copyRun(
      'check-contrast.mjs',
      realCss.replace(lightText, '$1#d0d0d0'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/light: text-primary \(#d0d0d0\)/);
  });

  it('check-design-tokens passes the real table and fails a token it no longer matches', () => {
    expect(copyRun('check-design-tokens.mjs', realCss).status).toBe(0);
    const { status, stderr } = copyRun(
      'check-design-tokens.mjs',
      realCss.replace(lightText, '$1#111111'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/text-primary[\s\S]*#111111/);
  });
});

describe('check-claude-md', () => {
  function root(claude, files = {}) {
    const dir = tempDir();
    writeFileSync(join(dir, 'CLAUDE.md'), claude);
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), body);
    }
    return dir;
  }
  const check = (dir) => run('check-claude-md.mjs', [], { CHECK_CLAUDE_MD_ROOT: dir });

  it('passes on the repository itself', () => {
    expect(run('check-claude-md.mjs').status).toBe(0);
  });

  it('passes a short file whose links resolve', () => {
    const dir = root(
      '# CLAUDE.md\n\nSee [docs](docs/a.md) and [site](https://example.com).\n',
      {
        'docs/a.md': 'x',
      },
    );
    expect(check(dir).status).toBe(0);
  });

  it('fails when CLAUDE.md passes 150 lines', () => {
    const dir = root(
      Array.from({ length: 151 }, (_, i) => `line ${i}`).join('\n') + '\n',
    );
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/151 lines/);
  });

  it('fails on a relative link to a missing file', () => {
    const dir = root('# CLAUDE.md\n\nSee [gone](docs/missing.md#part).\n');
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/docs\/missing\.md/);
  });
});

// docs/specs/dedupe-app-scripts-tests.md, criterion 6: the walking scripts list
// their files through scripts/lib.mjs's `listFiles` (`git ls-files -co
// --exclude-standard`), which respects .gitignore instead of a hand-kept
// skip list.
describe('scripts/lib.mjs (dedupe criterion 6)', () => {
  // Run under plain Node, as the scripts are: under Vitest a module's
  // import.meta.url isn't a file URL.
  it('exports ROOT (the repository root), listFiles and escapeRegExp', () => {
    const probe = [
      `const lib = await import(${JSON.stringify(pathToFileURL(join(SCRIPTS, 'lib.mjs')).href)});`,
      "const text = 'index-a.b+c(1).js';",
      'console.log(JSON.stringify({',
      '  root: lib.ROOT,',
      '  listFiles: typeof lib.listFiles,',
      '  literal: new RegExp(`^${lib.escapeRegExp(text)}$`).test(text),',
      "  dotIsLiteral: !new RegExp(lib.escapeRegExp('a.b')).test('axb'),",
      '}));',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(resolve(out.root)).toBe(resolve('.'));
    expect(out).toMatchObject({
      listFiles: 'function',
      literal: true,
      dotIsLiteral: true,
    });
  });
});

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

describe('check-bundle reads frontmatter with parseFrontmatter (dedupe criterion 6)', () => {
  // A summary long enough to qualify as a fragment: if the frontmatter were
  // not stripped, it would be picked instead of the body line and found in no
  // body chunk, so the check would fail.
  const SUMMARY =
    'A summary line that is long enough to be picked as the fragment by mistake.';
  const BODY_LINE =
    'Topic body sentence that is long enough to be checked by the guard here.';

  function check(raw, assets) {
    const root = tempDir();
    bundleRoot(root);
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    write('src/content/alpha/topic.md', raw);
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    });
  }

  const lf = `---\ntitle: T\nsummary: ${SUMMARY}\ndate: 2026-09-30\n---\n\n${BODY_LINE}\n`;
  const bomCrlf = `﻿${lf.replace(/\n/g, '\r\n')}`;

  it.each([
    ['LF frontmatter', lf],
    ['a BOM and CRLF frontmatter', bomCrlf],
  ])('takes the fragment from the body for %s', (_label, raw) => {
    const passes = check(raw, {
      'index-abc.js': `const meta = ${JSON.stringify(SUMMARY)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(BODY_LINE)};`,
    });
    expect(passes.status, passes.stderr).toBe(0);

    const inlined = check(raw, {
      'index-abc.js': `const body = ${JSON.stringify(BODY_LINE)};`,
    });
    expect(inlined.status).toBe(1);
    expect(inlined.stderr).toMatch(/topic\.md: body text is inlined in the main chunk/);
  });
});
