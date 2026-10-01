import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LocationDisplay, escapeRegExp, renderAt } from './render';

// docs/specs/dedupe-app-scripts-tests.md, criterion 8: the test helpers that
// were copied from file to file live once, under src/test/. Mechanically: no
// test file outside src/test/ defines its own copy.

const ROOT = resolve('.');

function testFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) testFiles(path, files);
    else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(entry)) files.push(path);
  }
  return files;
}

const TESTS = [...testFiles(join(ROOT, 'src')), ...testFiles(join(ROOT, 'scripts'))]
  .map((file) => relative(ROOT, file).split('\\').join('/'))
  .filter((file) => !file.startsWith('src/test/'));

function definitions(pattern: RegExp): string[] {
  return TESTS.filter((file) => pattern.test(readFileSync(join(ROOT, file), 'utf8')));
}

/** A top-level or nested `function name(` or `const name =` definition. */
function defines(name: string): RegExp {
  return new RegExp(
    `(?:\\bfunction\\s+${name}\\s*[(<]|\\b(?:const|let)\\s+${name}\\s*=)`,
  );
}

describe('shared test helpers (dedupe criterion 8)', () => {
  it('has src/test/render.tsx and src/test/content.ts', () => {
    expect(existsSync(join(ROOT, 'src/test/render.tsx'))).toBe(true);
    expect(existsSync(join(ROOT, 'src/test/content.ts'))).toBe(true);
  });

  it('finds the test files it checks', () => {
    expect(TESTS.length).toBeGreaterThan(20);
    expect(TESTS).toContain('src/components/SectionNav.test.tsx');
  });

  it.each(['LocationDisplay', 'escapeRegExp', 'renderAt', 'renderDialog'])(
    'no test file defines its own %s',
    (name) => {
      expect(definitions(defines(name))).toEqual([]);
    },
  );

  it.each(['rawFor', 'without', 'chromeLinks'])(
    'no test file defines its own %s (shared in src/test/content.ts)',
    (name) => {
      expect(definitions(defines(name))).toEqual([]);
    },
  );

  it('no test file renders its own location probe or inlines the RegExp escape', () => {
    expect(definitions(/data-testid=["']location-display["']/)).toEqual([]);
    expect(definitions(/\[\.\*\+\?\^\$\{\}\(\)\|\[\\\]\\\\\]/)).toEqual([]);
  });

  it('escapeRegExp makes a RegExp that matches the text literally', () => {
    const title = 'Design a Widget (like a.b+c) [v2] $5 ^x? {y}|z\\';
    expect(new RegExp(`^${escapeRegExp(title)}$`).test(title)).toBe(true);
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false);
  });

  it('LocationDisplay shows the current pathname', () => {
    render(
      <MemoryRouter initialEntries={['/alpha/one?x=1#part']}>
        <LocationDisplay />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('location-display').textContent).toBe('/alpha/one');
  });

  it('renderAt renders the whole app at the path by default, with the probe', () => {
    renderAt('/ai-and-ml');
    expect(
      screen.getByRole('heading', { level: 1, name: 'AI & Machine Learning' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/ai-and-ml');
  });

  it('renderAt renders a given element inside the router and providers instead', () => {
    renderAt('/dsa', <p>Only this</p>);
    expect(screen.getByText('Only this')).toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-display').textContent).toBe('/dsa');
  });
});
