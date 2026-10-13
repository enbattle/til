// @vitest-environment node
// Planted-violation tests for scripts/check-bundle.mjs, called in-process
// through its exported `bundleProblems(root)` (docs/specs/
// in-process-checks.md): it checks `root`'s markdown bodies against its
// dist/assets build output and returns its problems as strings, each naming
// the file at fault; `[]` when every body is in its own lazy chunk. Importing
// it runs nothing.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, repoWith, slashes } from '../src/test/guard-helpers.mjs';
import { bundleProblems } from './check-bundle.mjs';

afterEach(cleanTemps);

/** The problems for a throwaway repository holding `files` and a fake build
 * output of `assets` ({ name: text } under dist/assets/). */
function problems(files, assets) {
  const root = repoWith({
    ...files,
    ...Object.fromEntries(
      Object.entries(assets).map(([name, text]) => [`dist/assets/${name}`, text]),
    ),
  });
  return slashes(bundleProblems(root));
}

const TOPIC_LINE = 'Topic body sentence that is long enough to be checked by the guard.';
const TOPIC = {
  'src/content/alpha/topic.md': `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
};

describe('check-bundle covers case-study bodies (criterion 5)', () => {
  const CASE_LINE =
    'Case study body sentence that is long enough to be checked by the guard too.';
  const files = {
    ...TOPIC,
    'src/system-design/case-studies/demo.md': `---\ntitle: C\nsummary: S.\ndate: 2026-09-28\norder: 1\n---\n\n${CASE_LINE}\n`,
  };

  it('passes when each body is in its own lazy chunk', () => {
    expect(
      problems(files, {
        'index-abc.js': 'import("./topic-1.js"); import("./demo-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
        'demo-1.js': `export default ${JSON.stringify(CASE_LINE)};`,
      }),
    ).toEqual([]);
  });

  it('fails, naming the file, when a case-study body is inlined in the main chunk', () => {
    const found = problems(files, {
      'index-abc.js': `const body = ${JSON.stringify(CASE_LINE)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(found.join('\n')).toMatch(/demo\.md/);
  });

  it('fails, naming the file, when a case-study body is in no chunk at all', () => {
    const found = problems(files, {
      'index-abc.js': 'import("./topic-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(found.join('\n')).toMatch(/demo\.md/);
  });
});

describe('check-bundle covers DSA entry bodies (DSA criterion 4)', () => {
  const DSA_LINE =
    'Binary search keeps a half-open range and halves it until one index is left.';
  const files = {
    ...TOPIC,
    'src/dsa/entries/binary-search.md': `---\ntitle: B\nsummary: S.\ndate: 2026-09-30\nkind: algorithm\n---\n\n## Prerequisites\n\n${DSA_LINE}\n`,
  };

  it('passes when the DSA body is in its own lazy chunk', () => {
    expect(
      problems(files, {
        'index-abc.js': 'import("./topic-1.js"); import("./binary-search-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
        'binary-search-1.js': `export default ${JSON.stringify(DSA_LINE)};`,
      }),
    ).toEqual([]);
  });

  it('fails, naming the file, when a DSA body is inlined in the main chunk', () => {
    const found = problems(files, {
      'index-abc.js': `const body = ${JSON.stringify(DSA_LINE)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(found.join('\n')).toMatch(/binary-search\.md/);
  });

  it('fails, naming the file, when a DSA body is in no chunk at all', () => {
    const found = problems(files, {
      'index-abc.js': 'import("./topic-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(found.join('\n')).toMatch(/binary-search\.md/);
  });
});

describe('check-bundle reads frontmatter with parseFrontmatter (dedupe criterion 6)', () => {
  // A summary long enough to qualify as a fragment: if the frontmatter were
  // not stripped, it would be picked instead of the body line and found in no
  // body chunk, so the check would fail.
  const SUMMARY =
    'A summary line that is long enough to be picked as the fragment by mistake.';
  const BODY_LINE =
    'Topic body sentence that is long enough to be checked by the guard here.';
  const lf = `---\ntitle: T\nsummary: ${SUMMARY}\ndate: 2026-09-30\n---\n\n${BODY_LINE}\n`;
  const bomCrlf = `﻿${lf.replace(/\n/g, '\r\n')}`;

  it.each([
    ['LF frontmatter', lf],
    ['a BOM and CRLF frontmatter', bomCrlf],
  ])('takes the fragment from the body for %s', (_label, raw) => {
    const files = { 'src/content/alpha/topic.md': raw };
    expect(
      problems(files, {
        'index-abc.js': `const meta = ${JSON.stringify(SUMMARY)}; import("./topic-1.js");`,
        'topic-1.js': `export default ${JSON.stringify(BODY_LINE)};`,
      }),
    ).toEqual([]);
    expect(
      problems(files, { 'index-abc.js': `const body = ${JSON.stringify(BODY_LINE)};` }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/topic\.md: body text is inlined in the main chunk/),
      ]),
    );
  });
});

it('fails, saying so, when there is no build output', () => {
  const root = repoWith(TOPIC);
  expect(slashes(bundleProblems(root)).join('\n')).toMatch(/dist\/assets/);
});

// The real repository is checked only when it has been built: `verify` runs
// the tests before `npm run build`, and CI's checkout has no dist/.
describe.skipIf(!existsSync(resolve('dist/assets')))(
  'check-bundle on the built repository',
  () => {
    it('returns no problems', () => {
      expect(slashes(bundleProblems(resolve('.')))).toEqual([]);
    });

    // docs/specs/in-process-checks.md, criterion 2: the one run as a script.
    it('exits 0 with its success message, run as a script', () => {
      const result = spawnSync(process.execPath, [resolve('scripts/check-bundle.mjs')], {
        encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toMatch(/outside the main chunk/);
    });
  },
);
