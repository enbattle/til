// @vitest-environment node
// Planted-violation tests for scripts/check-raw-html.mjs (NON_NEGOTIABLES #6).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, gitInit, run, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

describe('check-raw-html', () => {
  function repo(files) {
    const root = tempDir();
    gitInit(root);
    mkdirSync(join(root, 'src/components'), { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify(files.pkg ?? { dependencies: {} }),
    );
    for (const [path, content] of Object.entries(files.src ?? {})) {
      writeFileSync(join(root, 'src', path), content);
    }
    return run('check-raw-html.mjs', [], { CHECK_RAW_HTML_ROOT: root }).status;
  }

  it('passes clean code and the allowed CodeBlock usage', () => {
    expect(
      repo({
        src: { 'components/CodeBlock.tsx': 'dangerouslySetInnerHTML={{ __html }}' },
      }),
    ).toBe(0);
  });

  it.each([
    ['rehype-raw installed', { pkg: { dependencies: { 'rehype-raw': '^7' } } }],
    [
      'dangerouslySetInnerHTML elsewhere',
      { src: { 'components/Bad.tsx': 'dangerouslySetInnerHTML={{}}' } },
    ],
    ['an innerHTML write', { src: { 'components/Bad.tsx': 'el.innerHTML = html;' } }],
    [
      'insertAdjacentHTML',
      { src: { 'components/Bad.tsx': "el.insertAdjacentHTML('beforeend', s)" } },
    ],
    ['document.write', { src: { 'components/Bad.tsx': 'document.write(s)' } }],
  ])('fails on %s', (_label, files) => {
    expect(repo(files)).toBe(1);
  });

  // docs/specs/tooling-gaps.md, criterion 3: src/lib/markdown.mjs ships to the
  // browser, so `.mjs` under src/ is app code too.
  it('fails on an innerHTML write in a planted src/x.mjs (tooling-gaps criterion 3)', () => {
    expect(
      repo({ src: { 'x.mjs': 'export const f = (el, s) => { el.innerHTML = s; };\n' } }),
    ).toBe(1);
  });

  it('passes the real repository', () => {
    const result = run('check-raw-html.mjs');
    expect(result.status, result.stderr).toBe(0);
  });
});
