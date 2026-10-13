#!/usr/bin/env node
// Guardrail against a doc telling someone to run `npm run <script>` for a
// script that's been renamed or removed from package.json — the same
// "fact owned by code, restated by hand in a doc" drift class as
// check-design-tokens.mjs, applied to every markdown file in the repo.
//
// The records are skipped: every file under `docs/specs/` except
// `docs/specs/README.md` (a live doc), and the table rows of
// `docs/pipeline-log.md` (the lines whose trimmed text starts with `|`, as
// check-pipeline-log.mjs reads them). They are point-in-time records, never
// rewritten, so a script named in one may since have been removed. Everything
// else is checked, including the log's header and any file whose name only
// starts the same (`docs/specs-old.md`).
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isMain, listFiles, ROOT } from './lib.mjs';

const SCRIPT_REF = /npm run ([a-zA-Z0-9:_-]+)/g;
const LOG = 'docs/pipeline-log.md';

/** Whether `path` (relative to the root, with forward slashes) is a spec record. */
function isSpecRecord(path) {
  return path.startsWith('docs/specs/') && path !== 'docs/specs/README.md';
}

/** The text of `content` to check: for the log, every line but its table rows. */
function checkedText(path, content) {
  if (path !== LOG) return content;
  return content
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('|'))
    .join('\n');
}

/**
 * One problem per `npm run <name>` in a markdown file under `root` (listed by
 * git, so ignored files don't count) whose name isn't a script in `root`'s
 * package.json, naming the file (relative to `root`) and the name. The records
 * (spec files and the log's table rows) are skipped. `[]` when every reference resolves.
 */
export function npmRefProblems(root = ROOT) {
  const { scripts = {} } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const validScripts = new Set(Object.keys(scripts));
  const problems = [];
  // An agent worktree (a full repo copy, checked in its own run) is a nested
  // repo, which `git ls-files -o` lists as one directory entry and never walks
  // into.
  for (const file of listFiles({ root, ext: '.md' })) {
    const path = relative(root, file).split('\\').join('/');
    if (isSpecRecord(path)) continue;
    const content = checkedText(path, readFileSync(file, 'utf8'));
    for (const match of content.matchAll(SCRIPT_REF)) {
      if (!validScripts.has(match[1])) problems.push(`${path} — "npm run ${match[1]}"`);
    }
  }
  return problems;
}

if (isMain(import.meta.url)) {
  const problems = npmRefProblems();
  if (problems.length > 0) {
    console.error(
      'Doc(s) reference an npm script that does not exist in package.json:\n',
    );
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log(
    'Every "npm run <script>" reference in the docs matches an actual package.json script.',
  );
}
