#!/usr/bin/env node
// Runs the DSA entries' Python tests (src/dsa/code/**/test_*.py) with pytest,
// as `npm run test:py`, part of `npm run verify` (docs/dsa.md). It finds a
// Python 3.11+ interpreter (`python3`, then `python`, then the Windows
// launcher `py -3`) by running `--version` on each, which also skips the
// Windows Store stub that answers to `python` without being Python. It fails
// with install instructions when there's no Python or no pytest.
//
// The run is pinned so nothing in the tree or the environment can change
// what pytest does (docs/specs/dsa-tab.md, criterion 13):
// - `-c <root>/pytest.ini` and `--rootdir <root>` make pytest read only the
//   locked pytest.ini, never a `.pytest.ini`, `pytest.toml`, `pyproject.toml`,
//   `tox.ini` or `setup.cfg` it would otherwise discover;
// - `PYTHONSAFEPATH=1` (Python 3.11+) keeps the working directory off
//   sys.path, so a root module named like one pytest imports (`iniconfig.py`,
//   `pluggy.py`, `argparse.py`) can't replace it;
// - `PYTEST_ADDOPTS` and `PYTEST_PLUGINS` are removed, so no environment
//   variable adds options or plugins.
//
// Bytecode and pytest's cache are turned off so a run leaves no __pycache__
// or .pytest_cache in the tree.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CANDIDATES = [['python3'], ['python'], ['py', '-3']];
const MIN_MINOR = 11; // PYTHONSAFEPATH needs Python 3.11+
const INSTALL =
  'Install Python 3.11 or later (3.12 is what CI uses), then run:\n' +
  '  python -m pip install -r requirements-dev.txt\n' +
  '(on Windows, `py -m pip install -r requirements-dev.txt`).';

const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1', PYTHONSAFEPATH: '1' };
for (const key of Object.keys(env)) {
  if (/^PYTEST_(ADDOPTS|PLUGINS)$/i.test(key)) delete env[key];
}

function run([command, ...args], extra, options = {}) {
  return spawnSync(command, [...args, ...extra], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    ...options,
  });
}

/** The first candidate whose `--version` really reports Python 3.11+. */
function findPython() {
  for (const candidate of CANDIDATES) {
    const result = run(candidate, ['--version']);
    if (result.error || result.status !== 0) continue;
    const match = /Python 3\.(\d+)/.exec(`${result.stdout}${result.stderr}`);
    if (match && Number(match[1]) >= MIN_MINOR) return candidate;
  }
  return null;
}

const python = findPython();
if (!python) {
  console.error(`test:py: no Python 3.${MIN_MINOR}+ found on the PATH.\n${INSTALL}`);
  process.exit(1);
}

if (run(python, ['-m', 'pytest', '--version']).status !== 0) {
  console.error(
    `test:py: pytest isn't installed for \`${python.join(' ')}\`.\n${INSTALL}`,
  );
  process.exit(1);
}

const result = run(
  python,
  [
    '-m',
    'pytest',
    '-c',
    join(ROOT, 'pytest.ini'),
    '--rootdir',
    ROOT,
    '-q',
    '-p',
    'no:cacheprovider',
    'src/dsa/code',
  ],
  {
    stdio: 'inherit',
  },
);
process.exit(result.status ?? 1);
