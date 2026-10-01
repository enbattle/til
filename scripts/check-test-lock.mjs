#!/usr/bin/env node
// Guardrail for /feature's locked-tests rule (.claude/skills/feature/SKILL.md,
// Stages 2, 3, 4a and 5): once the test-writer's red tests pass their gate, no
// later stage may edit, delete or add a test file.
//
// `--snapshot [path...]` records a sha256 of every locked file: every test
// file, everything under src/test/, every vitest snapshot, any extra paths
// given (the content fixtures a test-writer created or changed), and the test
// runner's own configuration: the `test` block of vite.config.ts, the `test*`
// scripts in package.json, and any vitest.config.* file. Weakening the runner
// (excluding a file, skipping setup) weakens every test at once. The Python
// tests (docs/dsa.md) are locked the same way: every `test_*.py` and
// `*_test.py`, every `conftest.py`, and scripts/test-python.mjs, the runner
// `test:py` calls. That runner is the main protection against the tree
// changing what pytest does: `-c <root>/pytest.ini` makes pytest read no other
// config file, and PYTHONSAFEPATH=1 keeps the working directory off sys.path,
// so no root module can shadow one pytest imports. As a second layer, any file
// pytest could read its configuration from (`pytest.toml`, `.pytest.toml`,
// `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini`, `setup.cfg`) and
// any root `pytest.py`, `_pytest.py`, `pytest/` or `_pytest/` path is locked
// too, so one added later counts as a change even if the runner's pinning is
// loosened.
// Files are listed through git, so a path added to an ignore file would drop
// out of the listing unseen (a new ignored `vitest.config.ts` or
// `conftest.py`). What git ignores is pinned instead of ignored files being
// hunted by name: every `.gitignore` in the tree (including one that ignores
// itself, found among git's ignored paths), `.git/info/exclude`, and a
// `core.excludesFile`: its configured value (from any config scope, so
// setting or changing it counts) and, when the file it names resolves inside
// the repository, that file's contents. A file outside the repository, such
// as a global `~/.gitignore` or git's default `$XDG_CONFIG_HOME/git/ignore`,
// is not hashed, so an edit to one is not caught.
// `.gitignore` is matched in any letter case (git honours `.GITIGNORE` with
// core.ignorecase=true).
// `--verify` recomputes them and fails on any difference, including a config
// part the snapshot lacks (reported as `added:`). `--clear` deletes
// the snapshot at the end of a run.
//
// It hashes files instead of reading `git diff` because `git diff` never shows
// untracked files (the new test files a test-writer usually creates are
// untracked until the user commits) and an agent's `git add` would hide an edit
// from it. Files are listed through git (tracked plus untracked, minus
// ignored), so ignored output, nested worktrees and symlink loops are never
// walked. The snapshot lives inside the git directory, so it is never in the
// working tree or the diff.
//
// Not part of `npm run verify` or CI: it compares against a snapshot that only
// exists during a pipeline run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { ROOT } from './lib.mjs';

const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SNAPSHOT_FILE = /(^|\/)__snapshots__\/.+\.snap$/;
const RUNNER_CONFIG_FILE = /^vitest\.(config|workspace)\.[cm]?[jt]s$/;
// The DSA entries' pytest files (docs/dsa.md), and every file pytest can read
// its configuration from, anywhere in the tree: one added later (a
// `conftest.py` that skips collection, a `pyproject.toml` with `addopts`)
// weakens the Python tests just as a vitest config would.
const PYTHON_TEST_FILE = /(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/;
const PYTEST_CONFIG_FILE =
  /(^|\/)(\.?pytest\.toml|\.?pytest\.ini|pyproject\.toml|tox\.ini|setup\.cfg)$/;
// The script `npm run test:py` runs: an early exit in it skips every Python
// test at once.
const PYTHON_RUNNER = 'scripts/test-python.mjs';
// That runner calls `python -m pytest` from the repository root. Without the
// PYTHONSAFEPATH it sets, Python would put the working directory first on
// sys.path, so a root `pytest.py`, `_pytest.py`, or anything under a root
// `pytest/` or `_pytest/` directory would shadow the real pytest; locking
// them is the second layer. Only those root paths: `pytest_helpers.py` or a
// nested `pytest.py` elsewhere is an ordinary module.
const PYTEST_SHADOW = /^_?pytest(\.py$|\/)/;
// Shared test setup can weaken every test at once, so it is locked too.
const TEST_SUPPORT_DIR = 'src/test/';
// Case-insensitive: with core.ignorecase=true (Windows, macOS) git honours a
// `.GITIGNORE` as an ignore file.
const IGNORE_FILE = /(^|\/)\.gitignore$/i;

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function isTestFile(path) {
  return (
    TEST_FILE.test(path) ||
    SNAPSHOT_FILE.test(path) ||
    RUNNER_CONFIG_FILE.test(path) ||
    PYTHON_TEST_FILE.test(path) ||
    PYTEST_CONFIG_FILE.test(path) ||
    path === PYTHON_RUNNER ||
    PYTEST_SHADOW.test(path) ||
    path.startsWith(TEST_SUPPORT_DIR) ||
    IGNORE_FILE.test(path)
  );
}

// Tracked and untracked files, minus ignored ones, with `/` separators.
function repoFiles() {
  return git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
}

// Every file to lock: the test files git lists, plus any `.gitignore` that
// ignores itself (listed among the ignored paths; `--directory` keeps an
// ignored directory such as node_modules to one entry).
function lockedFiles() {
  const ignored = git(['ls-files', '-oi', '--exclude-standard', '--directory', '-z'])
    .split('\0')
    .filter((path) => IGNORE_FILE.test(path));
  return [...new Set([...repoFiles().filter(isTestFile), ...ignored])];
}

const sha = (content) => createHash('sha256').update(content).digest('hex');

function hash(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? sha(readFileSync(full)) : null;
}

// The text from `start`'s match through its matching closing brace, counted by
// depth so nested blocks (coverage: { ... }) stay inside it; null if absent.
function braceBlock(text, start) {
  const match = start.exec(text);
  if (!match) return null;
  let depth = 0;
  for (let i = match.index; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(match.index, i + 1);
  }
  return text.slice(match.index);
}

// Parts of shared files that configure the test runner. Hashing only these
// parts leaves the rest of each file (plugins, dependencies) free to change.
function runnerConfig() {
  const vitePath = join(ROOT, 'vite.config.ts');
  const vite = existsSync(vitePath) ? readFileSync(vitePath, 'utf8') : '';
  const testBlock = braceBlock(vite, /\n\s*test:\s*\{/) ?? vite;
  const { scripts = {} } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const testScripts = Object.entries(scripts).filter(([name]) => name.startsWith('test'));
  const exclude = resolve(ROOT, git(['rev-parse', '--git-path', 'info/exclude']).trim());
  const excludesFile = configuredExcludesFile();
  return {
    'vite.config.ts#test': sha(testBlock),
    'package.json#scripts.test*': sha(JSON.stringify(testScripts)),
    // Outside the working tree, so hashed here; null when there is none.
    '.git/info/exclude': existsSync(exclude) ? sha(readFileSync(exclude)) : null,
    // The configured value itself (null when unset), so setting it after the
    // snapshot, or pointing it elsewhere, counts as a change.
    'git config core.excludesFile': excludesFile,
    // The file it names, resolved against the repository root; null when
    // unset, missing, or outside the repository (not covered).
    'core.excludesFile#contents':
      excludesFile === null ? null : repoFileHash(excludesFile),
  };
}

// The effective `core.excludesFile` (`~` expanded), or null when it is unset:
// `git config --get` exits 1 then.
function configuredExcludesFile() {
  try {
    return git(['config', '--path', '--get', 'core.excludesFile']).trim() || null;
  } catch {
    return null;
  }
}

// sha256 of a configured path when it is a file inside the repository.
function repoFileHash(path) {
  const full = resolve(ROOT, path);
  const rel = relative(ROOT, full);
  if (rel.startsWith('..') || isAbsolute(rel)) return null;
  return existsSync(full) && !statSync(full).isDirectory()
    ? sha(readFileSync(full))
    : null;
}

// A fixture path from the command line, as a repo-relative `/` path. Refuses
// anything that isn't an existing file, so a typo can't silently lock nothing.
function fixturePath(arg) {
  const full = isAbsolute(arg) ? arg : resolve(ROOT, arg);
  const rel = relative(ROOT, full).split('\\').join('/');
  if (rel.startsWith('..') || !existsSync(full) || statSync(full).isDirectory()) {
    console.error(
      `Not a file in this repository: ${arg}. Pass each fixture file; ` +
        '`git status --porcelain -uall` lists them individually.',
    );
    process.exit(2);
  }
  return rel;
}

const manifest = join(
  resolve(ROOT, git(['rev-parse', '--git-dir']).trim()),
  'til-test-lock.json',
);
const [mode, ...extraPaths] = process.argv.slice(2);

if (mode === '--snapshot') {
  const files = new Set(lockedFiles());
  for (const arg of extraPaths) files.add(fixturePath(arg));
  const hashes = {};
  for (const path of [...files].sort()) hashes[path] = hash(path);
  Object.assign(hashes, runnerConfig());
  writeFileSync(manifest, JSON.stringify(hashes, null, 2));
  console.log(
    `Locked ${Object.keys(hashes).length} file(s) and config part(s). Snapshot: ${manifest}`,
  );
  process.exit(0);
}

if (mode === '--verify') {
  if (!existsSync(manifest)) {
    console.error(
      'No test-lock snapshot found. Run `npm run check:test-lock -- --snapshot` at the end of ' +
        "/feature's Stage 2 gate, after the red tests are confirmed.",
    );
    process.exit(1);
  }
  const locked = JSON.parse(readFileSync(manifest, 'utf8'));
  const config = runnerConfig();
  const changed = [];
  for (const [path, lockedHash] of Object.entries(locked)) {
    const now = path in config ? config[path] : hash(path);
    if (now === lockedHash) continue;
    if (lockedHash === null) changed.push(`added:    ${path}`);
    else if (now === null) changed.push(`deleted:  ${path}`);
    else changed.push(`modified: ${path}`);
  }
  // A config part the snapshot lacks (taken by an older script) is reported,
  // not skipped.
  for (const part of Object.keys(config)) {
    if (!(part in locked)) changed.push(`added:    ${part}`);
  }
  for (const path of lockedFiles()) {
    if (!(path in locked)) changed.push(`added:    ${path}`);
  }
  if (changed.length > 0) {
    console.error('Locked files changed since the Stage 2 snapshot — hard stop:\n');
    for (const line of changed) console.error(`  ${line}`);
    console.error(
      '\nLocked files may only change through a fresh test-writer (Stage 2), which ' +
        'takes a new snapshot. Surface this to the user; do not decide yourself whether ' +
        'the edit was reasonable.',
    );
    process.exit(1);
  }
  console.log(
    `All ${Object.keys(locked).length} locked file(s) and config part(s) are unchanged.`,
  );
  process.exit(0);
}

if (mode === '--clear') {
  rmSync(manifest, { force: true });
  console.log('Test-lock snapshot cleared.');
  process.exit(0);
}

console.error(
  'Usage: npm run check:test-lock -- --snapshot [fixture...] | --verify | --clear',
);
process.exit(2);
