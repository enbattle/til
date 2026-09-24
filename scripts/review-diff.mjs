#!/usr/bin/env node
// Prints the full diff of the working tree against HEAD, including new
// untracked files, for /feature's Stage 4 reviewer
// (.claude/skills/feature/SKILL.md).
//
// Plain `git diff HEAD` leaves out every untracked file, so a reviewer given
// it never sees the new files a change adds. `git add -N .` fixes that but
// writes intent-to-add entries into the real index, and a later
// `git commit -a` then commits stray untracked files. This does the same
// thing against a throwaway copy of the index, so the user's index is never
// touched. Ignored files stay out, as they would in a commit.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const gitDir = resolve(
  ROOT,
  execFileSync('git', ['rev-parse', '--git-dir'], { cwd: ROOT, encoding: 'utf8' }).trim(),
);
const realIndex = join(gitDir, 'index');
const reviewIndex = join(gitDir, 'til-review-index');
const env = { ...process.env, GIT_INDEX_FILE: reviewIndex };

try {
  if (existsSync(realIndex)) copyFileSync(realIndex, reviewIndex);
  execFileSync('git', ['add', '-N', '.'], { cwd: ROOT, env });
  const diff = execFileSync('git', ['diff', 'HEAD', ...process.argv.slice(2)], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  process.stdout.write(diff);
} finally {
  rmSync(reviewIndex, { force: true });
}
