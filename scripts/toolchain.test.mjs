// @vitest-environment node
// docs/specs/remove-dsa-tab.md, criterion 9: the repository has no Python
// toolchain. No file configures or runs pytest, no npm script or `verify`
// step runs Python, CI and the deploy install no Python, Dependabot watches
// no pip packages, and .gitignore keeps no Python block.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Vitest runs from the repository root.
const ROOT = resolve('.');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

describe('no Python toolchain (criterion 9)', () => {
  it.each(['pytest.ini', 'requirements-dev.txt', 'scripts/test-python.mjs'])(
    '%s does not exist',
    (path) => {
      expect(existsSync(join(ROOT, path))).toBe(false);
    },
  );

  it('has no test:py script and no Python step in verify', () => {
    const { scripts } = JSON.parse(read('package.json'));
    expect(scripts).not.toHaveProperty('test:py');
    expect(scripts.verify).not.toMatch(/test:py|python|pytest/i);
  });

  it.each(['.github/workflows/ci.yml', '.github/workflows/deploy.yml'])(
    '%s sets up no Python and installs no pip packages',
    (path) => {
      const text = read(path);
      expect(text).not.toMatch(/setup-python/);
      expect(text).not.toMatch(/\bpip\b/);
      expect(text).not.toMatch(/requirements-dev/);
    },
  );

  it('has Dependabot watch no pip ecosystem', () => {
    expect(read('.github/dependabot.yml')).not.toMatch(/package-ecosystem:\s*pip\b/);
  });

  it('keeps no Python block in .gitignore', () => {
    expect(read('.gitignore')).not.toMatch(/__pycache__|\.pytest_cache|pytest/);
  });
});
