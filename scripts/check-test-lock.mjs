#!/usr/bin/env node
// Guardrail for /feature's locked-tests rule (.claude/skills/feature/SKILL.md,
// Stages 2, 3 and 4a): once the test-writer's red tests pass their gate, no
// later stage may edit, delete or add a test file.
//
// `--snapshot` records a sha256 of every test file; `--verify` recomputes them
// and fails on any difference. It hashes files instead of reading `git diff`
// because `git diff` never shows untracked files (the new test files a
// test-writer usually creates are untracked until the user commits) and an
// agent's `git add` would hide an edit from it. The manifest lives inside the
// git directory, so it is never in the working tree or the diff.
//
// Not part of `npm run verify` or CI: it compares against a snapshot that only
// exists during a pipeline run.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.git']);
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
// Shared test setup can weaken every test at once, so it is locked too.
const TEST_SUPPORT_DIR = `src${sep}test${sep}`;

function isLocked(relPath) {
  return TEST_FILE.test(relPath) || relPath.startsWith(TEST_SUPPORT_DIR);
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      walk(path, files);
    } else {
      const rel = relative(ROOT, path);
      if (isLocked(rel)) files.push(rel);
    }
  }
  return files;
}

function hashAll() {
  const hashes = {};
  for (const rel of walk(ROOT).sort()) {
    hashes[rel.split(sep).join('/')] = createHash('sha256')
      .update(readFileSync(join(ROOT, rel)))
      .digest('hex');
  }
  return hashes;
}

function manifestPath() {
  const gitDir = execFileSync('git', ['rev-parse', '--git-dir'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return join(resolve(ROOT, gitDir.trim()), 'til-test-lock.json');
}

const mode = process.argv[2];
const manifest = manifestPath();

if (mode === '--snapshot') {
  const hashes = hashAll();
  writeFileSync(manifest, JSON.stringify(hashes, null, 2));
  console.log(`Locked ${Object.keys(hashes).length} test file(s). Snapshot: ${manifest}`);
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
  const current = hashAll();
  const changed = [];
  for (const [file, hash] of Object.entries(locked)) {
    if (!(file in current)) changed.push(`deleted:  ${file}`);
    else if (current[file] !== hash) changed.push(`modified: ${file}`);
  }
  for (const file of Object.keys(current)) {
    if (!(file in locked)) changed.push(`added:    ${file}`);
  }
  if (changed.length > 0) {
    console.error('Test files changed since the Stage 2 snapshot — hard stop:\n');
    for (const line of changed) console.error(`  ${line}`);
    console.error(
      '\nLocked tests may only change through a fresh test-writer (Stage 2), which ' +
        'takes a new snapshot. Surface this to the user; do not decide yourself whether ' +
        'the edit was reasonable.',
    );
    process.exit(1);
  }
  console.log(`All ${Object.keys(locked).length} locked test file(s) are unchanged.`);
  process.exit(0);
}

console.error('Usage: npm run check:test-lock -- --snapshot | --verify');
process.exit(2);
