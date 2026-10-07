// @vitest-environment node
// Planted-violation tests for scripts/check-eval-premises.mjs
// (docs/specs/drift-and-rewrite-guards.md, criteria 1 to 5). An eval scenario
// declares each real-content premise it relies on as an HTML comment, and the
// check fails when the premise stops holding, instead of the eval quietly
// testing something else.
//
// Interface assumed for scripts/check-eval-premises.mjs:
//
// - It exports `checkEvalPremises(root)`, which checks `root` (a directory in a
//   git repository) and returns (or resolves to) an array of failure lines, one
//   per failure, each starting `<file>:<line>: premise`, where <file> is the
//   scenarios file relative to `root` (forward slashes) and <line> is the line
//   of the failing comment (for a diff block, a line of that block). An empty
//   array means everything holds. Importing the module runs nothing.
// - Run as `node scripts/check-eval-premises.mjs`, it checks the repository, or
//   the directory in the CHECK_EVAL_PREMISES_ROOT environment variable; it
//   prints the failure lines and exits 1 on any failure, else 0.
// - It reads every `evals/*/scenarios.md` under the root, and also checks that
//   each fenced `diff` block in `evals/feature-review/scenarios.md` passes
//   `git apply --check` against the root's working tree.
//
// The script-run and real-repository cases (criterion 5) are in
// check-eval-premises.cli.test.mjs, which doesn't import the module.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, gitInit, tempDir } from '../src/test/guard-helpers.mjs';
import { checkEvalPremises } from './check-eval-premises.mjs';

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

const failuresOf = async (root) =>
  (await checkEvalPremises(root)).map((line) => String(line).split('\\').join('/'));

/** The failure lines for one scenarios file holding `comment`, beside `files`. */
const check = (comment, files = {}) =>
  failuresOf(repo({ ...files, [SCENARIOS]: scenarios(comment) }));

const at = (line, file = SCENARIOS) => `${file}:${line}: premise`;

describe('check-eval-premises', () => {
  describe('the four premise forms (criterion 1)', () => {
    const TARGET = { 'docs/a.md': 'Some text with the phrase hello world in it.\n' };

    it.each([
      [
        'contains, when the file holds the text',
        '<!-- premise: docs/a.md contains "hello world" -->',
      ],
      [
        'lacks, when the file does not hold the text',
        '<!-- premise: docs/a.md lacks "goodbye moon" -->',
      ],
      ['exists, when the file exists', '<!-- premise: docs/a.md exists -->'],
      ['missing, when the file does not exist', '<!-- premise: docs/gone.md missing -->'],
    ])('passes %s', async (_label, comment) => {
      expect(await check(comment, TARGET)).toEqual([]);
    });

    it.each([
      [
        'contains, when the file lacks the text',
        '<!-- premise: docs/a.md contains "goodbye moon" -->',
      ],
      [
        'contains, when the file does not exist',
        '<!-- premise: docs/gone.md contains "hello world" -->',
      ],
      [
        'lacks, when the file holds the text',
        '<!-- premise: docs/a.md lacks "hello world" -->',
      ],
      [
        'lacks, when the file does not exist',
        '<!-- premise: docs/gone.md lacks "hello world" -->',
      ],
      ['exists, when the file does not exist', '<!-- premise: docs/gone.md exists -->'],
      ['missing, when the file exists', '<!-- premise: docs/a.md missing -->'],
    ])('fails %s, naming the file and line', async (_label, comment) => {
      const failures = await check(comment, TARGET);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE));
    });

    it('checks every scenarios file, and names the one that fails', async () => {
      const failures = await failuresOf(
        repo({
          ...TARGET,
          'evals/content-review/scenarios.md': scenarios(
            '<!-- premise: docs/a.md exists -->',
          ),
          'evals/feature-review/scenarios.md': scenarios(
            '<!-- premise: docs/a.md missing -->',
          ),
        }),
      );
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(
        at(PREMISE_LINE, 'evals/feature-review/scenarios.md'),
      );
    });

    it('checks each comment in a block of adjacent comments, naming its own line', async () => {
      const failures = await failuresOf(
        repo({
          ...TARGET,
          [SCENARIOS]: scenarios(
            '<!-- premise: docs/a.md exists -->',
            '<!-- premise: docs/a.md lacks "hello world" -->',
          ),
        }),
      );
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE + 1));
    });

    it('reports every failure, not just the first', async () => {
      const failures = await failuresOf(
        repo({
          ...TARGET,
          [SCENARIOS]: `${scenarios('<!-- premise: docs/gone.md exists -->')}\n<!-- premise: docs/a.md missing -->\n`,
        }),
      );
      expect(failures).toHaveLength(2);
    });

    it('ignores other HTML comments, and a premise shown inside a code block', async () => {
      expect(
        await failuresOf(
          repo({
            ...TARGET,
            [SCENARIOS]: `${scenarios('<!-- note: docs/gone.md exists -->')}\n\`\`\`md\n<!-- premise: docs/gone.md exists -->\n\`\`\`\n`,
          }),
        ),
      ).toEqual([]);
    });

    it('passes a repository with no scenarios files', async () => {
      expect(await failuresOf(repo({ 'README.md': '# x\n' }))).toEqual([]);
    });
  });

  describe('malformed and escaping premises (criterion 2)', () => {
    const TARGET = { 'docs/a.md': 'hello world\n' };

    it.each([
      ['an unknown verb', '<!-- premise: docs/a.md has "hello world" -->'],
      ['contains with unquoted text', '<!-- premise: docs/a.md contains hello world -->'],
      ['a missing path', '<!-- premise: exists -->'],
      ['nothing after the colon', '<!-- premise: -->'],
      ['extra words after the form', '<!-- premise: docs/a.md exists and is fresh -->'],
      // Review decisions, round 1 (finding 3): a near-miss keyword is a premise
      // written wrong, not some other comment.
      ['a capitalized keyword', '<!-- Premise: docs/a.md exists -->'],
      ['a space before the colon', '<!-- premise : docs/a.md exists -->'],
      ['the plural keyword', '<!-- premises: docs/a.md exists -->'],
    ])('fails a premise comment with %s', async (_label, comment) => {
      const failures = await check(comment, TARGET);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE));
    });

    // Re-review finding 4b: a premise comment without the colon is a premise
    // written wrong, not some other comment.
    it.each([
      ['no colon after the keyword', '<!-- premise docs/a.md missing -->'],
      ['a dash in place of the colon', '<!-- premise - docs/a.md missing -->'],
    ])('fails a premise comment with %s', async (_label, comment) => {
      const failures = await check(comment, TARGET);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE));
    });

    it('ignores a comment that only mentions the word premise later on', async () => {
      expect(await check('<!-- note: premise text -->', TARGET)).toEqual([]);
    });

    // Re-review finding 4a: `missing` on a path whose directory doesn't exist
    // is a path mistake, not a premise that holds.
    it('fails missing when the parent directory does not exist', async () => {
      const failures = await check('<!-- premise: doc/a.md missing -->', TARGET);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE));
    });

    it('passes missing when the parent directory exists and the file does not', async () => {
      expect(await check('<!-- premise: docs/b.md missing -->', TARGET)).toEqual([]);
    });

    // Each of these would hold if the path were followed, so only the path
    // rule can fail it.
    it.each([
      ['a path that climbs out of the root', '<!-- premise: ../outside.md missing -->'],
      ['a path with .. in the middle', '<!-- premise: docs/../docs/a.md exists -->'],
      ['an absolute POSIX path', '<!-- premise: /nowhere/a.md missing -->'],
      ['an absolute Windows path', '<!-- premise: C:\\nowhere\\a.md missing -->'],
    ])('fails %s', async (_label, comment) => {
      const failures = await check(comment, TARGET);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(at(PREMISE_LINE));
    });
  });

  describe('whitespace collapsing (criterion 3)', () => {
    it('passes a contains phrase split across a line break in the file', async () => {
      expect(
        await check('<!-- premise: docs/a.md contains "the quick brown fox" -->', {
          'docs/a.md': 'Here is the quick\nbrown fox, wrapped.\n',
        }),
      ).toEqual([]);
    });

    it('passes a contains phrase split across a CRLF line break and indentation', async () => {
      expect(
        await check('<!-- premise: docs/a.md contains "the quick brown fox" -->', {
          'docs/a.md': 'Here is the quick\r\n   brown fox, wrapped.\r\n',
        }),
      ).toEqual([]);
    });

    it('collapses whitespace runs in the quoted phrase too', async () => {
      expect(
        await check('<!-- premise: docs/a.md contains "the  quick   brown fox" -->', {
          'docs/a.md': 'Here is the quick brown fox.\n',
        }),
      ).toEqual([]);
    });

    it('fails a lacks phrase that is present across a line break', async () => {
      const failures = await check(
        '<!-- premise: docs/a.md lacks "the quick brown fox" -->',
        {
          'docs/a.md': 'Here is the quick\nbrown fox, wrapped.\n',
        },
      );
      expect(failures).toHaveLength(1);
    });
  });

  describe('feature-review diff blocks (criterion 4)', () => {
    const FEATURE = 'evals/feature-review/scenarios.md';
    const SOURCE = { 'src/a.ts': 'one\ntwo\nthree\nfour\n' };
    const diff = (context) =>
      [
        '```diff',
        '--- a/src/a.ts',
        '+++ b/src/a.ts',
        '@@ -1,3 +1,4 @@',
        ' one',
        ` ${context}`,
        '+inserted',
        ' three',
        '```',
      ].join('\n');
    const scenarioWith = (block) => `# Scenarios\n\n## FR-01: a scenario\n\n${block}\n`;

    it('passes a diff block that applies', async () => {
      expect(
        await failuresOf(repo({ ...SOURCE, [FEATURE]: scenarioWith(diff('two')) })),
      ).toEqual([]);
    });

    it('fails a diff block whose context line drifted, naming the file', async () => {
      const failures = await failuresOf(
        repo({ ...SOURCE, [FEATURE]: scenarioWith(diff('too')) }),
      );
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatch(/^evals\/feature-review\/scenarios\.md:\d+: premise/);
    });

    it('fails a diff block whose target file is gone', async () => {
      const failures = await failuresOf(repo({ [FEATURE]: scenarioWith(diff('two')) }));
      expect(failures).toHaveLength(1);
    });

    it('checks each diff block on its own', async () => {
      const failures = await failuresOf(
        repo({
          ...SOURCE,
          [FEATURE]: scenarioWith(
            `${diff('two')}\n\n## FR-02: another\n\n${diff('too')}`,
          ),
        }),
      );
      expect(failures).toHaveLength(1);
    });

    it('leaves the working tree unchanged', async () => {
      const root = repo({ ...SOURCE, [FEATURE]: scenarioWith(diff('two')) });
      await checkEvalPremises(root);
      expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe(SOURCE['src/a.ts']);
    });

    it('checks diff blocks only in the feature-review scenarios', async () => {
      expect(
        await failuresOf(repo({ ...SOURCE, [SCENARIOS]: scenarioWith(diff('too')) })),
      ).toEqual([]);
    });

    it('ignores fenced code that is not a diff block', async () => {
      const block = diff('too').replace('```diff', '```ts');
      expect(
        await failuresOf(repo({ ...SOURCE, [FEATURE]: scenarioWith(block) })),
      ).toEqual([]);
    });
  });
});
