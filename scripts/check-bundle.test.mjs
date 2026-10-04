// @vitest-environment node
// Planted-violation tests for scripts/check-bundle.mjs.
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { bundleRoot, cleanTemps, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

describe('check-bundle covers case-study bodies (criterion 5)', () => {
  // The script finds the repository from its own location, so each case runs a
  // copy of it inside a throwaway directory with a fake build output.
  const TOPIC_LINE =
    'Topic body sentence that is long enough to be checked by the guard.';
  const CASE_LINE =
    'Case study body sentence that is long enough to be checked by the guard too.';

  function check(assets) {
    const root = tempDir();
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    bundleRoot(root);
    write(
      'src/content/alpha/topic.md',
      `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
    );
    write(
      'src/system-design/case-studies/demo.md',
      `---\ntitle: C\nsummary: S.\ndate: 2026-09-28\norder: 1\n---\n\n${CASE_LINE}\n`,
    );
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    }).status;
  }

  it('passes when each body is in its own lazy chunk', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js"); import("./demo-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
        'demo-1.js': `export default ${JSON.stringify(CASE_LINE)};`,
      }),
    ).toBe(0);
  });

  it('fails when a case-study body is inlined in the main chunk', () => {
    expect(
      check({
        'index-abc.js': `const body = ${JSON.stringify(CASE_LINE)}; import("./topic-1.js");`,
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });

  it('fails when a case-study body is in no chunk at all', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });
});

describe('check-bundle covers DSA entry bodies (DSA criterion 4)', () => {
  const TOPIC_LINE =
    'Topic body sentence that is long enough to be checked by the guard.';
  const DSA_LINE =
    'Binary search keeps a half-open range and halves it until one index is left.';

  function check(assets) {
    const root = tempDir();
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    bundleRoot(root);
    write(
      'src/content/alpha/topic.md',
      `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
    );
    write(
      'src/dsa/entries/binary-search.md',
      `---\ntitle: B\nsummary: S.\ndate: 2026-09-30\nkind: algorithm\n---\n\n## Prerequisites\n\n${DSA_LINE}\n`,
    );
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    });
  }

  it('passes when the DSA body is in its own lazy chunk', () => {
    const result = check({
      'index-abc.js': 'import("./topic-1.js"); import("./binary-search-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      'binary-search-1.js': `export default ${JSON.stringify(DSA_LINE)};`,
    });
    expect(result.status, result.stderr).toBe(0);
  });

  it('fails, naming the file, when a DSA body is inlined in the main chunk', () => {
    const result = check({
      'index-abc.js': `const body = ${JSON.stringify(DSA_LINE)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/binary-search\.md/);
  });

  it('fails when a DSA body is in no chunk at all', () => {
    const result = check({
      'index-abc.js': 'import("./topic-1.js");',
      'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/binary-search\.md/);
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

  function check(raw, assets) {
    const root = tempDir();
    bundleRoot(root);
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    write('src/content/alpha/topic.md', raw);
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    });
  }

  const lf = `---\ntitle: T\nsummary: ${SUMMARY}\ndate: 2026-09-30\n---\n\n${BODY_LINE}\n`;
  const bomCrlf = `﻿${lf.replace(/\n/g, '\r\n')}`;

  it.each([
    ['LF frontmatter', lf],
    ['a BOM and CRLF frontmatter', bomCrlf],
  ])('takes the fragment from the body for %s', (_label, raw) => {
    const passes = check(raw, {
      'index-abc.js': `const meta = ${JSON.stringify(SUMMARY)}; import("./topic-1.js");`,
      'topic-1.js': `export default ${JSON.stringify(BODY_LINE)};`,
    });
    expect(passes.status, passes.stderr).toBe(0);

    const inlined = check(raw, {
      'index-abc.js': `const body = ${JSON.stringify(BODY_LINE)};`,
    });
    expect(inlined.status).toBe(1);
    expect(inlined.stderr).toMatch(/topic\.md: body text is inlined in the main chunk/);
  });
});
