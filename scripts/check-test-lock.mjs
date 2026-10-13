#!/usr/bin/env node
// Guardrail for /feature's locked-tests rule (.claude/skills/feature/SKILL.md,
// Stages 2, 3, 4a and 5; NON_NEGOTIABLES #9): once the test-writer's red tests
// pass their gate, no later stage may edit, delete or add a locked file.
//
// `--snapshot [fixture...]` records a sha256 of every locked file and config
// part; `--verify` recomputes them and fails on any difference, including a
// config part the snapshot lacks (reported as `added:`); `--clear` deletes the
// snapshot at the end of a run. Locked:
//
// - every test file (`*.test.*`, `*.spec.*`), vitest snapshot and
//   `vitest.config|workspace.*`, and everything under src/test/;
// - the `test` block of vite.config.ts, package.json's `test*` scripts, the
//   `pre`/`post` scripts npm runs around them and around `verify`, and its
//   `check:test-lock` script string;
// - the whole `verify` script string, as one hash: any edit to it counts, so
//   a new `verify` step belongs to the Stage 2 test-writer;
// - every `.gitignore` (any depth, including one that ignores itself) and
//   `.git/info/exclude`, since a path ignored after the snapshot would drop
//   out of git's listing unseen;
// - pytest's test files (`test_*.py`, `*_test.py`, `conftest.py`) and config
//   files, and scripts/test-python.mjs, the runner `test:py` calls;
// - this script and scripts/lib.mjs, which it imports, so a later stage can't
//   weaken the lock and then pass it;
// - the fixture paths given to `--snapshot`.
//
// It hashes files instead of reading `git diff` because `git diff` never shows
// untracked files and an agent's `git add` would hide an edit from it. Files
// are listed through git (tracked plus untracked, minus ignored). The snapshot
// lives inside the git directory, so it is never in the working tree or the
// diff. Not part of `npm run verify` or CI: it compares against a snapshot
// that only exists during a pipeline run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isMain, ROOT } from './lib.mjs';

const LOCKED = [
  /\.(test|spec)\.[cm]?[jt]sx?$/,
  /(^|\/)__snapshots__\/.+\.snap$/,
  /^vitest\.(config|workspace)\.[cm]?[jt]s$/,
  /^src\/test\//,
  /(^|\/)\.gitignore$/,
  /(^|\/)(test_[^/]*|[^/]*_test|conftest)\.py$/,
  /(^|\/)(\.?pytest\.toml|\.?pytest\.ini|pyproject\.toml|tox\.ini|setup\.cfg)$/,
  /^scripts\/(test-python|check-test-lock|lib)\.mjs$/,
];

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const list = (root, args) =>
  git(root, [...args, '-z'])
    .split('\0')
    .filter(Boolean);
const sha = (content) => createHash('sha256').update(content).digest('hex');

// The snapshot's path (inside the git directory) and .git/info/exclude's, in
// one git call.
function gitPaths(root) {
  const [gitDir, exclude] = git(root, [
    'rev-parse',
    '--git-dir',
    '--git-path',
    'info/exclude',
  ])
    .trim()
    .split(/\r?\n/);
  return {
    snapshot: join(resolve(root, gitDir), 'til-test-lock.json'),
    exclude: resolve(root, exclude),
  };
}

// sha256 of a file's contents, or null when it is missing or not a file.
function fileHash(full) {
  return existsSync(full) && !statSync(full).isDirectory()
    ? sha(readFileSync(full))
    : null;
}

// The locked files git lists, plus any `.gitignore` that ignores itself
// (found among the ignored paths; `--directory` keeps an ignored directory
// such as node_modules to one entry).
function lockedFiles(root) {
  const listed = list(root, ['ls-files', '-co', '--exclude-standard']);
  const ignored = list(root, ['ls-files', '-oi', '--exclude-standard', '--directory']);
  return [
    ...new Set([
      ...listed.filter((path) => LOCKED.some((pattern) => pattern.test(path))),
      ...ignored.filter((path) => /(^|\/)\.gitignore$/.test(path)),
    ]),
  ];
}

// The text from `start`'s match through its matching closing brace, counted by
// depth so nested blocks stay inside it; null if absent.
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

// The parts of shared files that configure the test runner or the gate.
function configParts(root, exclude) {
  const vitePath = join(root, 'vite.config.ts');
  const vite = existsSync(vitePath) ? readFileSync(vitePath, 'utf8') : '';
  const pkgPath = join(root, 'package.json');
  const { scripts = {} } = existsSync(pkgPath)
    ? JSON.parse(readFileSync(pkgPath, 'utf8'))
    : {};
  // `pre`/`post` too: npm runs them around `npm run <name>`.
  const testScripts = Object.entries(scripts).filter(([name]) =>
    /^(?:pre|post)?test|^(?:pre|post)verify$/.test(name),
  );
  return {
    'vite.config.ts#test': sha(braceBlock(vite, /\n\s*test:\s*\{/) ?? vite),
    'package.json#scripts.test*': sha(JSON.stringify(testScripts)),
    'package.json#scripts.check:test-lock': sha(
      JSON.stringify(scripts['check:test-lock'] ?? null),
    ),
    'package.json#scripts.verify': sha(JSON.stringify(scripts.verify ?? null)),
    '.git/info/exclude': fileHash(exclude),
  };
}

// A fixture path as a root-relative `/` path; anything that isn't an existing
// file in the repository throws, so a typo can't silently lock nothing.
function fixturePath(root, arg) {
  const full = isAbsolute(arg) ? arg : resolve(root, arg);
  const rel = relative(root, full).split('\\').join('/');
  if (rel.startsWith('..') || isAbsolute(rel) || fileHash(full) === null) {
    throw new Error(
      `Not a file in this repository: ${arg}. Pass each fixture file; ` +
        '`git status --porcelain -uall` lists them individually.',
    );
  }
  return rel;
}

/** Hash every locked file and config part under `root` (plus `fixtures`) and
 * write the snapshot inside its git directory. Returns the number locked. */
export function snapshotLock(root = ROOT, fixtures = []) {
  const files = new Set(lockedFiles(root));
  for (const arg of fixtures) files.add(fixturePath(root, arg));
  const hashes = {};
  for (const path of [...files].sort()) hashes[path] = fileHash(join(root, path));
  const paths = gitPaths(root);
  Object.assign(hashes, configParts(root, paths.exclude));
  writeFileSync(paths.snapshot, JSON.stringify(hashes, null, 2));
  return Object.keys(hashes).length;
}

/** The change lines since the snapshot (`modified:`, `added:`, `deleted:`);
 * `[]` when nothing changed. Throws when there is no snapshot. */
export function verifyLock(root = ROOT) {
  const paths = gitPaths(root);
  if (!existsSync(paths.snapshot)) {
    throw new Error(
      'No test-lock snapshot found. Run `npm run check:test-lock -- --snapshot` at the end of ' +
        "/feature's Stage 2 gate, after the red tests are confirmed.",
    );
  }
  const locked = JSON.parse(readFileSync(paths.snapshot, 'utf8'));
  const config = configParts(root, paths.exclude);
  const changed = [];
  for (const [key, then] of Object.entries(locked)) {
    const now = key in config ? config[key] : fileHash(join(root, key));
    if (now === then) continue;
    if (then === null) changed.push(`added:    ${key}`);
    else if (now === null) changed.push(`deleted:  ${key}`);
    else changed.push(`modified: ${key}`);
  }
  for (const key of [...Object.keys(config), ...lockedFiles(root)]) {
    if (!(key in locked)) changed.push(`added:    ${key}`);
  }
  return changed;
}

/** Delete the snapshot, if any. */
export function clearLock(root = ROOT) {
  rmSync(gitPaths(root).snapshot, { force: true });
}

if (isMain(import.meta.url)) {
  const [mode, ...fixtures] = process.argv.slice(2);
  try {
    if (mode === '--snapshot') {
      const count = snapshotLock(ROOT, fixtures);
      console.log(`Locked ${count} file(s) and config part(s).`);
    } else if (mode === '--verify') {
      const changed = verifyLock(ROOT);
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
      console.log('All locked files and config parts are unchanged.');
    } else if (mode === '--clear') {
      clearLock(ROOT);
      console.log('Test-lock snapshot cleared.');
    } else {
      console.error(
        'Usage: npm run check:test-lock -- --snapshot [fixture...] | --verify | --clear',
      );
      process.exit(2);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(mode === '--snapshot' ? 2 : 1);
  }
}
