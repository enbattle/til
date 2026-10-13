// Helpers shared by the check and build scripts.
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root. */
export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Whether the module whose `import.meta.url` is passed is the script Node was
 * started with (`node scripts/x.mjs`), rather than one imported by another
 * module or a test. A script runs its command-line part only then:
 * `if (isMain(import.meta.url)) { ... }`. Node gives `import.meta.url` the
 * entry's real path, so `process.argv[1]` is resolved the same way (the JS
 * realpathSync, as Node uses; `.native` differs in drive-letter case and 8.3
 * names) and a script started through a junction or symlink still counts. No
 * script, or one that doesn't exist (`node -e`), is false.
 */
export function isMain(importMetaUrl) {
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(importMetaUrl);
  } catch {
    return false;
  }
}

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
