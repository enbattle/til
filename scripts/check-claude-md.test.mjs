// @vitest-environment node
// Planted-violation tests for scripts/check-claude-md.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, run, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

describe('check-claude-md', () => {
  function root(claude, files = {}) {
    const dir = tempDir();
    writeFileSync(join(dir, 'CLAUDE.md'), claude);
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), body);
    }
    return dir;
  }
  const check = (dir) => run('check-claude-md.mjs', [], { CHECK_CLAUDE_MD_ROOT: dir });

  it('passes on the repository itself', () => {
    expect(run('check-claude-md.mjs').status).toBe(0);
  });

  it('passes a short file whose links resolve', () => {
    const dir = root(
      '# CLAUDE.md\n\nSee [docs](docs/a.md) and [site](https://example.com).\n',
      {
        'docs/a.md': 'x',
      },
    );
    expect(check(dir).status).toBe(0);
  });

  it('fails when CLAUDE.md passes 150 lines', () => {
    const dir = root(
      Array.from({ length: 151 }, (_, i) => `line ${i}`).join('\n') + '\n',
    );
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/151 lines/);
  });

  it('fails on a relative link to a missing file', () => {
    const dir = root('# CLAUDE.md\n\nSee [gone](docs/missing.md#part).\n');
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/docs\/missing\.md/);
  });
});
