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
// (excluding a file, skipping setup) weakens every test at once. The gate's
// own command is locked as well: package.json's `check:test-lock` script
// string; each whole `&&`-separated `verify` step that starts with
// `npm run test`, in order, arguments included (dropping, reordering or adding
// `--exclude` to one weakens the tests without touching a `test*` script); and
// the ordered list of every other shell control operator in `verify` (`||`,
// `;`, `&`, `|`, newline), since one `|| true` anywhere swallows every
// failure; and the ordered list of every other `&&` step that isn't exactly
// `npm run <name>` with no arguments, since an `exit 0` or `exec` step ends the
// shell before the tests run. A plain `&& npm run check:x` step stays free to
// add, remove or change. The Python
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
// setting or changing it counts) and the contents of the file it names,
// wherever it lives. Only while core.excludesFile is unset (git reads its
// default global ignore file only then), every location that default could
// resolve to is hashed together: `$XDG_CONFIG_HOME/git/ignore`, and
// `<home>/.config/git/ignore` for each candidate home (HOME, USERPROFILE,
// HOMEDRIVE+HOMEPATH and os.homedir(); Git for Windows can fall back to any of
// them). Only the candidates that exist are hashed, keyed by real path, so
// the same files under a different environment hash alike; the part is null
// when none exists.
// Those are machine files, so editing your own global gitignore during a run
// trips the lock too. A missing file records null.
// Known, fail-safe limitation: Claude Code's runtime itself appends entries to
// `~/.config/git/ignore` (and to `.git/info/exclude`), so a permission grant
// in the middle of a run can trip `--verify` with nothing weakened. That
// fails closed: surface it to the user like any other change.
// A nested git repository (or agent worktree) is one entry in git's listing,
// and git never walks into it, yet pytest would still collect a `conftest.py`
// inside it. An untracked one is listed as `dir/`; one staged in this
// repository as a submodule gitlink is listed as `dir` with no trailing
// slash. Either way, any listed directory holding a `.git` is locked as a
// whole under the key `dir/`: a new one is `added: <dir>/`, and one present
// at both times is compared by a hash of its own `git ls-files -co` listing
// and every listed file's contents. One git can't list (a worktree whose
// gitdir was pruned) fails closed: `--verify` reports `unreadable: <dir>/` and
// `--snapshot` refuses to run. Agent worktrees live under `.claude/worktrees/`,
// which `.gitignore` ignores, so they are not nested repos here.
// The lock locks itself: this script and scripts/lib.mjs, which it imports,
// so a later stage can't weaken the lock and then pass it.
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
// ignored), so ignored output and symlink loops are never walked, and a nested
// repository is read only through its own git listing. The snapshot lives
// inside the git directory, so it is never in the working tree or the diff.
//
// Not part of `npm run verify` or CI: it compares against a snapshot that only
// exists during a pipeline run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
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
// The lock script and the helpers it imports: editing either could weaken the
// lock itself.
const LOCK_SCRIPTS = new Set(['scripts/check-test-lock.mjs', 'scripts/lib.mjs']);

function git(args, cwd = ROOT) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    // git's own error stays out of the output; callers report it.
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isTestFile(path) {
  return (
    TEST_FILE.test(path) ||
    SNAPSHOT_FILE.test(path) ||
    RUNNER_CONFIG_FILE.test(path) ||
    PYTHON_TEST_FILE.test(path) ||
    PYTEST_CONFIG_FILE.test(path) ||
    path === PYTHON_RUNNER ||
    LOCK_SCRIPTS.has(path) ||
    PYTEST_SHADOW.test(path) ||
    path.startsWith(TEST_SUPPORT_DIR) ||
    IGNORE_FILE.test(path)
  );
}

// Tracked and untracked files, minus ignored ones, with `/` separators.
function repoFiles() {
  return git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
}

// An entry in a git listing that is a directory holding a `.git` (a
// directory, or the file a worktree checkout has): a nested repository. An
// untracked one is listed as `dir/`, a staged submodule gitlink as `dir`.
function isRepoDir(full) {
  return (
    existsSync(full) && statSync(full).isDirectory() && existsSync(join(full, '.git'))
  );
}

function isNestedRepo(path) {
  return isRepoDir(join(ROOT, path));
}

// The key a nested repository is locked under: always `dir/`.
const repoKey = (path) => (path.endsWith('/') ? path : `${path}/`);

// Every file to lock: the test files and nested repositories git lists, plus
// any `.gitignore` that ignores itself (listed among the ignored paths;
// `--directory` keeps an ignored directory such as node_modules to one entry).
function lockedFiles() {
  const ignored = git(['ls-files', '-oi', '--exclude-standard', '--directory', '-z'])
    .split('\0')
    .filter((path) => IGNORE_FILE.test(path));
  const listed = repoFiles().flatMap((path) =>
    isNestedRepo(path) ? [repoKey(path)] : isTestFile(path) ? [path] : [],
  );
  return [...new Set([...listed, ...ignored])];
}

const sha = (content) => createHash('sha256').update(content).digest('hex');

// The hash recorded for a nested repository git can't list (a worktree whose
// gitdir was pruned): never a match, so it fails closed.
const UNREADABLE = 'unreadable';

// A locked path's hash: a nested repository's (a `dir/` key) or a file's.
function hash(path) {
  if (path.endsWith('/')) {
    if (!isNestedRepo(path)) return null;
    try {
      return nestedRepoHash(join(ROOT, path));
    } catch {
      return UNREADABLE;
    }
  }
  return fileHash(join(ROOT, path));
}

// sha256 of a file's contents, or null when it is missing or not a file.
function fileHash(full) {
  return existsSync(full) && !statSync(full).isDirectory()
    ? sha(readFileSync(full))
    : null;
}

// One hash over a nested repository's own listing (tracked and untracked,
// ignored files included, so its own ignore rules can't hide anything) and
// each listed file's contents. A repository nested inside it is hashed the
// same way.
function nestedRepoHash(dir) {
  const entries = git(['ls-files', '-co', '-z'], dir)
    .split('\0')
    .filter(Boolean)
    .sort()
    .map((path) => {
      const full = join(dir, path);
      const nested = isRepoDir(full);
      return `${path}\0${nested ? nestedRepoHash(full) : fileHash(full)}`;
    });
  return sha(entries.join('\0'));
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
  const verify = String(scripts.verify ?? '');
  // Each whole `&&`-separated step of `verify` that runs `npm run test*`, in
  // order, arguments included; other `&&` steps stay free.
  const verifyTestSteps = verify
    .split('&&')
    .map((step) => step.trim())
    .filter((step) => step.startsWith('npm run test'));
  // Every other `&&` step that isn't exactly `npm run <name>` with no
  // arguments, in order: an allowlist, so an `exit 0`, `exec`, `cd` or an
  // argument on a step is a change, while a plain `npm run check:x` step
  // stays free. The test steps are left out; the part above locks them.
  const verifyOtherSteps = verify
    .split('&&')
    .map((step) => step.trim())
    .filter(
      (step) => !step.startsWith('npm run test') && !/^npm run [\w:.-]+$/.test(step),
    );
  // Every shell control operator in `verify` other than `&&`, in order: one
  // `|| true` or `;` anywhere would let a failing step pass the gate.
  const verifyOperators = verify.replaceAll('&&', ' ').match(/\|\||\r?\n|[;&|]/g) ?? [];
  const exclude = resolve(ROOT, git(['rev-parse', '--git-path', 'info/exclude']).trim());
  const excludesFile = configuredExcludesFile();
  return {
    'vite.config.ts#test': sha(testBlock),
    'package.json#scripts.test*': sha(JSON.stringify(testScripts)),
    'package.json#scripts.check:test-lock': sha(
      JSON.stringify(scripts['check:test-lock'] ?? null),
    ),
    'package.json#scripts.verify test steps': sha(JSON.stringify(verifyTestSteps)),
    'package.json#scripts.verify non-npm steps': sha(JSON.stringify(verifyOtherSteps)),
    'package.json#scripts.verify operators': sha(JSON.stringify(verifyOperators)),
    // Outside the working tree, so hashed here; null when there is none.
    '.git/info/exclude': existsSync(exclude) ? sha(readFileSync(exclude)) : null,
    // The configured value itself (null when unset), so setting it after the
    // snapshot, or pointing it elsewhere, counts as a change.
    'git config core.excludesFile': excludesFile,
    // The file it names, resolved against the repository root, wherever it
    // lives; null when unset or missing.
    'core.excludesFile#contents':
      excludesFile === null ? null : fileHash(resolve(ROOT, excludesFile)),
    // Git's default global ignore file, which git reads only while
    // core.excludesFile is unset: every candidate location's contents, hashed
    // together; null when core.excludesFile is set or every candidate is
    // missing.
    'default global ignore#contents':
      excludesFile === null ? defaultGlobalIgnoreHash() : null,
  };
}

// Every location git's default global ignore file could resolve to:
// `$XDG_CONFIG_HOME/git/ignore`, and `<home>/.config/git/ignore` for each
// home git might use (HOME, USERPROFILE, HOMEDRIVE+HOMEPATH, os.homedir()),
// de-duplicated.
function defaultGlobalIgnores() {
  const { XDG_CONFIG_HOME, HOME, USERPROFILE, HOMEDRIVE, HOMEPATH } = process.env;
  const homes = [
    HOME,
    USERPROFILE,
    HOMEDRIVE && HOMEPATH ? HOMEDRIVE + HOMEPATH : undefined,
    homedir(),
  ].filter(Boolean);
  const paths = [
    ...(XDG_CONFIG_HOME ? [join(XDG_CONFIG_HOME, 'git', 'ignore')] : []),
    ...homes.map((home) => join(home, '.config', 'git', 'ignore')),
  ].map((path) => resolve(path));
  return [...new Set(paths)].sort();
}

// One hash over each existing candidate's real path and contents; null when
// none exists. Missing candidates are left out, so the same files read under a
// different environment (HOME set in one shell, unset in another) hash alike.
function defaultGlobalIgnoreHash() {
  const entries = new Map();
  for (const path of defaultGlobalIgnores()) {
    const contents = fileHash(path);
    if (contents !== null) entries.set(realpathSync.native(path), contents);
  }
  return entries.size > 0 ? sha(JSON.stringify([...entries].sort())) : null;
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
  const unreadable = Object.keys(hashes).filter((path) => hashes[path] === UNREADABLE);
  if (unreadable.length > 0) {
    console.error(
      `git can't list these nested repositories, so they can't be locked:\n\n` +
        unreadable.map((path) => `  ${path}`).join('\n') +
        '\n\nRepair or remove them, then take the snapshot again.',
    );
    process.exit(1);
  }
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
    if (now === UNREADABLE) changed.push(`unreadable: ${path}`);
    else if (now === lockedHash) continue;
    else if (lockedHash === null) changed.push(`added:    ${path}`);
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
