// @vitest-environment node
// docs/specs/dedupe-app-scripts-tests.md, criterion 6: the walking scripts list
// their files through scripts/lib.mjs's `listFiles` (`git ls-files -co
// --exclude-standard`), which respects .gitignore instead of a hand-kept
// skip list.
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SCRIPTS } from '../src/test/guard-helpers.mjs';

describe('scripts/lib.mjs (dedupe criterion 6)', () => {
  // Run under plain Node, as the scripts are: under Vitest a module's
  // import.meta.url isn't a file URL.
  it('exports ROOT (the repository root), listFiles and escapeRegExp', () => {
    const probe = [
      `const lib = await import(${JSON.stringify(pathToFileURL(join(SCRIPTS, 'lib.mjs')).href)});`,
      "const text = 'index-a.b+c(1).js';",
      'console.log(JSON.stringify({',
      '  root: lib.ROOT,',
      '  listFiles: typeof lib.listFiles,',
      '  literal: new RegExp(`^${lib.escapeRegExp(text)}$`).test(text),',
      "  dotIsLiteral: !new RegExp(lib.escapeRegExp('a.b')).test('axb'),",
      '}));',
    ].join('\n');
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', probe], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    const out = JSON.parse(result.stdout);
    expect(resolve(out.root)).toBe(resolve('.'));
    expect(out).toMatchObject({
      listFiles: 'function',
      literal: true,
      dotIsLiteral: true,
    });
  });
});
