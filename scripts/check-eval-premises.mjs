#!/usr/bin/env node
// Checks that the eval scenarios still test what they say they test
// (docs/specs/drift-and-rewrite-guards.md). A scenario that relies on real
// content states that premise as an HTML comment in its scenarios file, in
// exactly one of these forms:
//
//   <!-- premise: <path> contains "<text>" -->
//   <!-- premise: <path> lacks "<text>" -->
//   <!-- premise: <path> exists -->
//   <!-- premise: <path> missing -->
//
// <path> is relative to the repository root (no absolute path, no `..`).
// `contains` and `lacks` collapse whitespace runs in the file and in <text>,
// so a phrase may cross a line break. Any other `premise:` comment is an
// error, never skipped, and so is a near-miss keyword (a comment starting
// with the word `premise` or `premises` in any case, with a missing or
// misplaced colon). A `missing` premise also fails when the path's directory
// doesn't exist, since that's likelier a mistyped path. Every fenced
// `diff` block in evals/feature-review/scenarios.md must also pass
// `git apply --check` against the working tree.
//
// Each `evals/*/scenarios.md` is parsed with the site's markdown parser, so a
// premise shown inside a code block isn't checked. Prints one
// `<file>:<line>: premise …` line per failure and exits 1 on any failure.
// The root is the repository, or CHECK_EVAL_PREMISES_ROOT. The file listing
// respects ignore rules; premise targets and `git apply` read the working
// tree directly.
//
// Known gaps (the spec's Review decisions, judged theoretical):
// - an empty or whitespace-only `contains` phrase always holds;
// - a diff fenced as anything but `diff` (```patch, no language, nested in a
//   longer fence) isn't applied; every feature-review diff uses `diff`;
// - a premise indented four spaces is a code block, so it isn't checked.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { markdownParser } from '../src/lib/markdown.mjs';
import { listFiles, ROOT as REPO_ROOT } from './lib.mjs';

const FEATURE_REVIEW = 'evals/feature-review/scenarios.md';
const SCENARIOS = /^evals\/[^/]+\/scenarios\.md$/;
const COMMENT = /<!--([\s\S]*?)-->/g;
const TEXT_FORM = /^(\S+)\s+(contains|lacks)\s+"(.*)"$/s;
const FILE_FORM = /^(\S+)\s+(exists|missing)$/;

const collapse = (text) => text.replace(/\s+/g, ' ');

/** Why `path` can't be a premise path, or null when it can. */
function badPath(path) {
  if (/^[\\/]/.test(path) || /^[A-Za-z]:/.test(path)) return 'is absolute';
  if (path.split(/[\\/]/).includes('..')) return 'climbs with ..';
  return null;
}

/** Whether `full` is an existing file. */
const isFile = (full) => existsSync(full) && statSync(full).isFile();

/** The failure for one premise comment's text (after `premise:`), or null. */
function checkPremise(root, premise) {
  const text = TEXT_FORM.exec(premise);
  const file = text ? null : FILE_FORM.exec(premise);
  if (!text && !file) {
    return `"${premise}" matches no form (<path> contains|lacks "<text>", <path> exists|missing)`;
  }
  const [, path, verb] = text ?? file;
  const bad = badPath(path);
  if (bad) return `path ${path} ${bad}`;
  const full = join(root, path);
  if (verb === 'exists') return isFile(full) ? null : `${path} does not exist`;
  if (verb === 'missing') {
    if (isFile(full)) return `${path} exists`;
    // A directory that doesn't exist is more likely a mistyped path than a
    // premise that holds.
    const parent = dirname(full);
    if (!existsSync(parent) || !statSync(parent).isDirectory()) {
      return `${path}'s directory does not exist (a mistyped path?)`;
    }
    return null;
  }
  if (!isFile(full)) return `${path} does not exist`;
  const phrase = collapse(text[3]).trim();
  const holds = collapse(readFileSync(full, 'utf8')).includes(phrase);
  if (verb === 'contains') return holds ? null : `${path} no longer contains "${phrase}"`;
  return holds ? `${path} contains "${phrase}"` : null;
}

/** Visits every node of a markdown tree. */
function walk(node, visit) {
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}

/** Why a diff doesn't apply to the working tree under `root`, or null. */
function diffFailure(root, diff) {
  const dir = mkdtempSync(join(tmpdir(), 'til-premise-'));
  try {
    const patch = join(dir, 'scenario.diff');
    writeFileSync(patch, `${diff}\n`);
    const result = spawnSync('git', ['apply', '--check', patch], {
      cwd: root,
      encoding: 'utf8',
    });
    if (result.status === 0) return null;
    const reason = `${result.stderr ?? ''}`.trim().split(/\r?\n/)[0] || 'does not apply';
    return `diff block no longer applies (${reason})`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Every failing premise under `root`, as `<file>:<line>: premise …` lines
 * (<file> relative to `root`, with forward slashes). Empty when all hold.
 */
export function checkEvalPremises(root = REPO_ROOT) {
  const failures = [];
  const files = listFiles({ root, under: 'evals', ext: 'scenarios.md' })
    .map((full) => ({ full, rel: relative(root, full).split('\\').join('/') }))
    .filter(({ rel }) => SCENARIOS.test(rel));
  for (const { full, rel } of files) {
    const tree = markdownParser().parse(readFileSync(full, 'utf8'));
    walk(tree, (node) => {
      if (node.type === 'html') {
        for (const match of node.value.matchAll(COMMENT)) {
          const body = match[1].trim();
          // A near miss (`Premise:`, `premise :`, `premises:`) is a premise
          // written wrong, so it fails as malformed rather than being skipped.
          // A missing colon (`premise docs/a.md missing`, `premise - …`) too.
          if (!/^premises?\b/i.test(body)) continue;
          const failure = body.startsWith('premise:')
            ? checkPremise(root, body.slice('premise:'.length).trim())
            : `"${body}" is malformed: the keyword must be exactly "premise:"`;
          if (!failure) continue;
          const offset = node.value.slice(0, match.index).split('\n').length - 1;
          failures.push(
            `${rel}:${node.position.start.line + offset}: premise ${failure}`,
          );
        }
      } else if (rel === FEATURE_REVIEW && node.type === 'code' && node.lang === 'diff') {
        const failure = diffFailure(root, node.value);
        if (failure)
          failures.push(`${rel}:${node.position.start.line}: premise ${failure}`);
      }
    });
  }
  return failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const failures = checkEvalPremises(process.env.CHECK_EVAL_PREMISES_ROOT ?? REPO_ROOT);
  if (failures.length > 0) {
    console.error('Eval premises that no longer hold:\n');
    for (const failure of failures) console.error(failure);
    process.exit(1);
  }
  console.log('Every eval premise holds.');
}
