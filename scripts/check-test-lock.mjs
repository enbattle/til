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
// (excluding a file, skipping setup) weakens every test at once.
// `--verify` recomputes them and fails on any difference. `--clear` deletes
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
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const SNAPSHOT_FILE = /(^|\/)__snapshots__\/.+\.snap$/;
const RUNNER_CONFIG_FILE = /^vitest\.(config|workspace)\.[cm]?[jt]s$/;
// Shared test setup can weaken every test at once, so it is locked too.
const TEST_SUPPORT_DIR = 'src/test/';

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function isTestFile(path) {
  return (
    TEST_FILE.test(path) ||
    SNAPSHOT_FILE.test(path) ||
    RUNNER_CONFIG_FILE.test(path) ||
    path.startsWith(TEST_SUPPORT_DIR)
  );
}

// Tracked and untracked files, minus ignored ones, with `/` separators.
function repoFiles() {
  return git(['ls-files', '-co', '--exclude-standard', '-z']).split('\0').filter(Boolean);
}

const sha = (content) => createHash('sha256').update(content).digest('hex');

function hash(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? sha(readFileSync(full)) : null;
}

// Parts of shared files that configure the test runner. Hashing only these
// parts leaves the rest of each file (plugins, dependencies) free to change.
function runnerConfig() {
  const vitePath = join(ROOT, 'vite.config.ts');
  const vite = existsSync(vitePath) ? readFileSync(vitePath, 'utf8') : '';
  const testBlock = /\n\s*test:\s*\{[\s\S]*?\n\s*\},?/.exec(vite)?.[0] ?? vite;
  const { scripts = {} } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const testScripts = Object.entries(scripts).filter(([name]) => name.startsWith('test'));
  return {
    'vite.config.ts#test': sha(testBlock),
    'package.json#scripts.test*': sha(JSON.stringify(testScripts)),
  };
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
  const files = new Set(repoFiles().filter(isTestFile));
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
  for (const path of repoFiles().filter(isTestFile)) {
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
