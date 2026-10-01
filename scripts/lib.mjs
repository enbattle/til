// Helpers shared by the check and build scripts.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The files under `root/under` (default: all of `root`) whose names end with
 * `ext` (a suffix, or a list of them; default: any), as absolute paths in
 * path order. Listed by `git ls-files -co --exclude-standard`, so tracked and
 * untracked files count but anything `.gitignore`d (node_modules, dist,
 * caches) doesn't, and a tracked file deleted from disk is dropped. A nested
 * repo or agent worktree is listed as one directory entry and never walked
 * into, so its files don't count either.
 * `root` must be inside a git repository.
 */
export function listFiles({ root = ROOT, under = '.', ext = '' } = {}) {
  const suffixes = [ext].flat();
  return execFileSync(
    'git',
    ['ls-files', '-co', '--exclude-standard', '-z', '--', under.split('\\').join('/')],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
    .split('\0')
    .filter((path) => path && suffixes.some((suffix) => path.endsWith(suffix)))
    .sort()
    .map((path) => join(root, path))
    .filter((path) => existsSync(path));
}

/** `text` with every RegExp metacharacter escaped, to match it literally. */
export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
