#!/usr/bin/env node
// Keeps CLAUDE.md a short router. It is loaded into every session and every
// subagent on every turn, so each line costs tokens across all work in the
// repo; detail belongs in the doc or skill that needs it (CLAUDE.md, "Keeping
// context small"). Fails if CLAUDE.md is longer than MAX_LINES or if a relative
// link in it points at a file that doesn't exist (a router with a dead link
// sends an agent nowhere). CHECK_CLAUDE_MD_ROOT points it at another directory
// (used by the planted-violation tests).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT as REPO_ROOT } from './lib.mjs';

const MAX_LINES = 150;
const ROOT = process.env.CHECK_CLAUDE_MD_ROOT ?? REPO_ROOT;
const file = join(ROOT, 'CLAUDE.md');
const text = readFileSync(file, 'utf8');
const problems = [];

const lines = text.replace(/\n$/, '').split(/\r?\n/).length;
if (lines > MAX_LINES) {
  problems.push(
    `CLAUDE.md is ${lines} lines; the limit is ${MAX_LINES}. Move task-specific detail into the doc or skill the routing table points to.`,
  );
}

for (const match of text.matchAll(/\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
  const target = match[1];
  if (/^[a-z]+:/i.test(target) || target.startsWith('/')) continue;
  if (!existsSync(join(ROOT, target)))
    problems.push(`CLAUDE.md links to ${target}, which does not exist.`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`CLAUDE.md is ${lines} lines (limit ${MAX_LINES}) and every link resolves.`);
