// @vitest-environment node
// scripts/check-eval-premises.mjs run as a script, on planted repositories and
// on the real one (docs/specs/drift-and-rewrite-guards.md, criteria 1 and 5).
// Kept apart from check-eval-premises.test.mjs, which imports the module, so
// these cases spawn the script and fail for their own reasons. The interface
// assumed is described at the top of that file: the script checks the
// repository, or the directory in CHECK_EVAL_PREMISES_ROOT, prints one
// `<file>:<line>: premise …` line per failure and exits 1 on any failure.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, gitInit, run, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

function write(root, path, content) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** A throwaway git repository holding `files` ({ path: content }). */
function repo(files = {}) {
  const root = tempDir();
  gitInit(root);
  for (const [path, content] of Object.entries(files)) write(root, path, content);
  return root;
}

const SCENARIOS = 'evals/skill-routing/scenarios.md';
// A scenarios file whose premise comment (or comments) start on line 5.
const scenarios = (...comments) =>
  `# Scenarios\n\n## SR-01: a scenario\n\n${comments.join('\n')}\n\nThe prompt.\n`;
const PREMISE_LINE = 5;
const at = (line, file = SCENARIOS) => `${file}:${line}: premise`;

const check = (root) =>
  run('check-eval-premises.mjs', [], { CHECK_EVAL_PREMISES_ROOT: root });

/** The failure lines a run printed, with forward slashes. */
const failureLines = ({ stdout, stderr }) =>
  `${stdout}${stderr}`
    .split('\\')
    .join('/')
    .split(/\r?\n/)
    .filter((line) => line.includes(': premise'));

describe('check-eval-premises, run as a script', () => {
  it('exits 0 when every premise holds', () => {
    const root = repo({
      'docs/a.md': 'hello world\n',
      [SCENARIOS]: scenarios('<!-- premise: docs/a.md contains "hello world" -->'),
    });
    const { status, stdout, stderr } = check(root);
    expect(status, `${stdout}${stderr}`).toBe(0);
  });

  it('exits 0 on a repository with no scenarios files', () => {
    expect(check(repo({ 'README.md': '# x\n' })).status).toBe(0);
  });

  it('exits 1 and prints one line per failure, naming the file and line', () => {
    const root = repo({
      'docs/a.md': 'hello world\n',
      [SCENARIOS]: `${scenarios('<!-- premise: docs/a.md missing -->')}\n<!-- premise: docs/a.md lacks "hello" -->\n`,
    });
    const result = check(root);
    expect(result.status).toBe(1);
    const lines = failureLines(result);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(at(PREMISE_LINE));
  });

  it('exits 1 on a malformed premise comment', () => {
    const root = repo({ [SCENARIOS]: scenarios('<!-- premise: docs/a.md has "x" -->') });
    const result = check(root);
    expect(result.status).toBe(1);
    expect(failureLines(result)[0]).toContain(at(PREMISE_LINE));
  });
});

describe('check-eval-premises on the real repository (criterion 5)', () => {
  it('passes, with the seeded premises', () => {
    const { status, stdout, stderr } = run('check-eval-premises.mjs');
    expect(status, `${stdout}${stderr}`).toBe(0);
  });

  it('has the premises the spec seeds', () => {
    const routing = readFileSync(resolve('evals/skill-routing/scenarios.md'), 'utf8');
    const feature = readFileSync(resolve('evals/feature-review/scenarios.md'), 'utf8');
    // SR-18 relies on there being no LRU cache entry yet.
    expect(routing).toContain('<!-- premise: src/dsa/entries/lru-cache.md missing -->');
    // SR-06 relies on a sentence in caching.md.
    expect(routing).toMatch(
      /<!-- premise: src\/content\/systems-and-infrastructure\/caching\.md contains "[^"]+" -->/,
    );
    // FR-06 relies on titles containing "vs.".
    expect(feature).toMatch(/<!-- premise: \S+ contains "[^"]*vs\.[^"]*" -->/);
  });

  it('fails once a premise names a sentence that was removed', () => {
    const PATH = 'src/content/systems-and-infrastructure/caching.md';
    const real = readFileSync(resolve(PATH), 'utf8');
    // The first sentence of the body, after the frontmatter, as one line.
    const body = real
      .replace(/^---[\s\S]*?\n---\r?\n/, '')
      .replace(/\s+/g, ' ')
      .trim();
    const sentence = /^[^.]+\./.exec(body)[0];
    const scenario = scenarios(`<!-- premise: ${PATH} contains "${sentence}" -->`);

    const before = check(repo({ [PATH]: real, [SCENARIOS]: scenario }));
    expect(before.status, `${before.stdout}${before.stderr}`).toBe(0);

    const after = check(
      repo({ [PATH]: body.replace(sentence, ''), [SCENARIOS]: scenario }),
    );
    expect(after.status).toBe(1);
    const lines = failureLines(after);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(at(PREMISE_LINE));
  });
});
