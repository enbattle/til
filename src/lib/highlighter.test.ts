import { describe, expect, it } from 'vitest';
import { highlightCode } from './highlighter';

describe('highlightCode', () => {
  it('renders TypeScript with syntax-highlighting spans', async () => {
    const html = await highlightCode('const x: number = 1;', 'typescript', 'light');
    expect(html).toContain('<pre');
    expect(html).toContain('<span');
  });

  it('falls back to plain text for an unsupported language without throwing', async () => {
    const html = await highlightCode('some cobol maybe', 'cobol', 'light');
    expect(html).toContain('<pre');
  });

  it('resolves a common shorthand fence tag to its canonical language', async () => {
    // ```sh is what topic bodies actually write — must highlight, not fall back to plain text.
    const aliased = await highlightCode('git worktree list', 'sh', 'light');
    const canonical = await highlightCode('git worktree list', 'bash', 'light');
    expect(aliased).toBe(canonical);
    expect(aliased).toContain('<span');
  });

  it('switches theme colors between light and dark', async () => {
    const light = await highlightCode('const x = 1;', 'javascript', 'light');
    const dark = await highlightCode('const x = 1;', 'javascript', 'dark');
    expect(light).not.toBe(dark);
  });

  // Regression test: a real production error ("Failed to fetch dynamically
  // imported module") traced back to loading all ten languages up front on
  // the first code block, regardless of which one it actually needed.
  // Highlighting several distinct, never-before-used languages in sequence
  // must each succeed independently — a lazily-loaded language shouldn't
  // interfere with, or depend on, any other.
  it('highlights several different languages independently on demand', async () => {
    const python = await highlightCode('def f(): pass', 'python', 'light');
    const css = await highlightCode('.a { color: red; }', 'css', 'light');
    const html = await highlightCode('<div></div>', 'html', 'light');

    for (const result of [python, css, html]) {
      expect(result).toContain('<pre');
      expect(result).toContain('<span');
    }
  });
});
