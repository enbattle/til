// Tests for the one shared reader of the `--color-*` design tokens in
// src/index.css. check-contrast, check-design-tokens and the diagram scripts
// (diagram-manifest's diagramTokens) all read tokens through it, so they can
// never disagree with each other, or with what CSS itself applies.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readThemeTokens } from './css-tokens.mjs';

// Interface assumed (scripts/css-tokens.mjs):
//
//   export function readThemeTokens(css: string): {
//     light: Record<string, string>, // from top-level `:root { ... }` blocks
//     dark: Record<string, string>,  // from top-level `.dark { ... }` blocks
//   }
//
// - Keys are the token name without the `--color-` prefix ('bg-primary').
// - Values are 6-digit lowercase hex ('#faf6f0'); a 3-digit value is expanded
//   ('#FFF' -> '#ffffff').
// - Every top-level block whose selector is exactly `:root` or `.dark` is
//   read, in order; a later declaration wins, as in CSS. Tokens only in an
//   earlier block are kept.
// - `/* ... */` comments are ignored wherever they appear.
// - It throws (an Error whose message names the offending `--color-*` token)
//   when:
//     * a `--color-*` value in a `:root`/`.dark` block is anything other than
//       a 3- or 6-digit hex color (8/4-digit alpha hex, var(), rgb(), named
//       colors, malformed hex);
//     * a `--color-*` token is declared anywhere other than a top-level
//       `:root` or `.dark` block: under `@media`, in a compound/other
//       selector (`:root:not(.x)`, `:root, .light`, `html.dark`, `.x .dark`),
//       or in a `.dark` rule nested inside another rule.
// - Top-level `@theme` / `@theme inline` blocks are Tailwind's mapping of
//   utilities onto the tokens (`--color-x: var(--color-x)`) and are skipped,
//   not read and not rejected. Using a token (`var(--color-x)` as a value of
//   another property) anywhere is fine; only declaring one is restricted.

const block = (selector, body) => `${selector} {\n${body}\n}\n`;

describe('readThemeTokens: later blocks win', () => {
  const css = [
    block(':root', '  --color-text-primary: #111111;\n  --color-border: #222222;'),
    block('.dark', '  --color-text-primary: #999999;\n  --color-border: #444444;'),
    block(':root', '  --color-text-primary: #eeeeee;'),
    block('.dark', '  --color-border: #555555;'),
  ].join('\n');

  it('lets a later :root block override an earlier one, keeping the rest', () => {
    expect(readThemeTokens(css).light).toEqual({
      'text-primary': '#eeeeee',
      border: '#222222',
    });
  });

  it('lets a later .dark block override an earlier one, keeping the rest', () => {
    expect(readThemeTokens(css).dark).toEqual({
      'text-primary': '#999999',
      border: '#555555',
    });
  });

  it('lets a later declaration in the same block win', () => {
    const { light } = readThemeTokens(
      block(':root', '  --color-accent: #111111;\n  --color-accent: #222222;'),
    );
    expect(light).toEqual({ accent: '#222222' });
  });

  it('reads a block whatever its whitespace (indented, no space, one line)', () => {
    const { light, dark } = readThemeTokens(
      '  :root {\n    --color-accent: #111111;\n  }\n' +
        '.dark{--color-accent:#222222}\n' +
        ':root\n{\n  --color-border: #333333;\n}\n',
    );
    expect(light).toEqual({ accent: '#111111', border: '#333333' });
    expect(dark).toEqual({ accent: '#222222' });
  });
});

describe('readThemeTokens: comments are ignored', () => {
  const real =
    block(':root', '  --color-accent: #111111;') +
    block('.dark', '  --color-accent: #222222;');

  it.each([
    ['a single-line comment', '/* :root { --color-accent: #000000; } */\n'],
    [
      'a multi-line comment with :root { at column 0',
      '/*\n:root {\n  --color-accent: #000000;\n}\n*/\n',
    ],
    [
      'a multi-line comment with .dark { at column 0',
      '/*\n.dark {\n  --color-accent: #000000;\n}\n*/\n',
    ],
  ])('ignores a block inside %s, before and after the real one', (_label, comment) => {
    for (const css of [comment + real, real + comment]) {
      expect(readThemeTokens(css)).toEqual({
        light: { accent: '#111111' },
        dark: { accent: '#222222' },
      });
    }
  });

  it('ignores a commented-out declaration inside a block', () => {
    const { light } = readThemeTokens(
      block(':root', '  --color-accent: #111111;\n  /* --color-accent: #000000; */'),
    );
    expect(light).toEqual({ accent: '#111111' });
  });

  it('is not cut short by a } inside a comment in the block', () => {
    const { light } = readThemeTokens(
      block(':root', '  /* a } brace */\n  --color-accent: #111111;'),
    );
    expect(light).toEqual({ accent: '#111111' });
  });

  it('does not throw for a bad value that is commented out', () => {
    expect(() =>
      readThemeTokens(
        block(':root', '  --color-accent: #111111;\n  /* --color-border: red; */') +
          '/* @media (x) { :root { --color-accent: #000000; } } */\n',
      ),
    ).not.toThrow();
  });
});

describe('readThemeTokens: values', () => {
  it('expands 3-digit hex to 6-digit lowercase', () => {
    const { light, dark } = readThemeTokens(
      block(':root', '  --color-bg-primary: #fff;\n  --color-accent: #A1b;') +
        block('.dark', '  --color-bg-primary: #0F0;'),
    );
    expect(light).toEqual({ 'bg-primary': '#ffffff', accent: '#aa11bb' });
    expect(dark).toEqual({ 'bg-primary': '#00ff00' });
  });

  it('lowercases 6-digit hex', () => {
    expect(readThemeTokens(block(':root', '  --color-accent: #92400E;')).light).toEqual({
      accent: '#92400e',
    });
  });

  it.each([
    ['8-digit alpha hex', '#11223344'],
    ['4-digit alpha hex', '#1234'],
    ['5-digit hex', '#12345'],
    ['non-hex digits', '#gggggg'],
    ['var()', 'var(--color-border)'],
    ['rgb()', 'rgb(0 0 0)'],
    ['hsl()', 'hsl(0 0% 0%)'],
    ['a named color', 'red'],
    ['transparent', 'transparent'],
    ['currentColor', 'currentColor'],
    ['an empty value', ''],
  ])('throws, naming the token, for %s', (_label, value) => {
    for (const selector of [':root', '.dark']) {
      expect(() =>
        readThemeTokens(
          block(':root', '  --color-accent: #111111;') +
            block('.dark', '  --color-accent: #222222;') +
            block(selector, `  --color-accent: ${value};`),
        ),
      ).toThrow(/--color-accent/);
    }
  });

  it('throws rather than keep an earlier valid value when a later one is invalid', () => {
    expect(() =>
      readThemeTokens(
        block(':root', '  --color-text-primary: #111111;') +
          block(':root', '  --color-text-primary: #11111180;'),
      ),
    ).toThrow(/--color-text-primary/);
  });

  it('ignores custom properties that are not --color-*', () => {
    expect(
      readThemeTokens(
        block(
          ':root',
          '  --radius: 4px;\n  --gap: var(--x);\n  --color-accent: #111111;',
        ),
      ).light,
    ).toEqual({ accent: '#111111' });
  });
});

describe('readThemeTokens: only top-level :root and .dark define tokens', () => {
  const base =
    block(':root', '  --color-accent: #111111;') +
    block('.dark', '  --color-accent: #222222;');

  it.each([
    [
      '@media wrapping :root',
      '@media (prefers-color-scheme: dark) {\n  :root {\n    --color-accent: #000000;\n  }\n}\n',
    ],
    [
      '@media wrapping .dark',
      '@media (min-width: 40rem) {\n  .dark {\n    --color-accent: #000000;\n  }\n}\n',
    ],
    [
      '@supports wrapping :root',
      '@supports (color: red) {\n  :root {\n    --color-accent: #000000;\n  }\n}\n',
    ],
    [':root:not(.x)', block(':root:not(.x)', '  --color-accent: #000000;')],
    [':root, .light', block(':root, .light', '  --color-accent: #000000;')],
    ['.dark, .x', block('.dark, .x', '  --color-accent: #000000;')],
    ['html.dark', block('html.dark', '  --color-accent: #000000;')],
    ['.x .dark', block('.x .dark', '  --color-accent: #000000;')],
    ['.dark .x', block('.dark .x', '  --color-accent: #000000;')],
    ['html', block('html', '  --color-accent: #000000;')],
    [
      'a .dark rule nested in another rule',
      '.x {\n  .dark {\n    --color-accent: #000000;\n  }\n}\n',
    ],
    [
      'a .dark rule nested in :root',
      ':root {\n  .dark {\n    --color-accent: #000000;\n  }\n}\n',
    ],
  ])('throws, naming the token, for --color-* declared in %s', (_label, extra) => {
    for (const css of [base + extra, extra + base]) {
      expect(() => readThemeTokens(css)).toThrow(/--color-accent/);
    }
  });

  it.each([
    ['@media', '@media (min-width: 40rem) {\n  :root {\n    --gap: 2rem;\n  }\n}\n'],
    ['html.dark', block('html.dark', '  color-scheme: dark;')],
    ['.prose', block('.prose', '  --tw-prose-body: var(--color-accent);')],
    ['@theme inline', block('@theme inline', '  --color-accent: var(--color-accent);')],
    ['@theme', block('@theme', '  --color-accent: var(--color-accent);')],
    [
      '@layer base',
      '@layer base {\n  * {\n    border-color: var(--color-accent);\n  }\n}\n',
    ],
  ])(
    'neither reads nor rejects %s (no --color-* declared, or Tailwind @theme)',
    (_label, extra) => {
      expect(readThemeTokens(base + extra)).toEqual({
        light: { accent: '#111111' },
        dark: { accent: '#222222' },
      });
    },
  );
});

describe('readThemeTokens on the real src/index.css', () => {
  const css = readFileSync(resolve('src/index.css'), 'utf8');

  // What the scripts read today: the first top-level `:root {` / `.dark {`
  // block's 6-digit hex values. The real file has exactly one of each.
  function firstBlock(selector) {
    const start = css.search(new RegExp(`^${selector.replace('.', '\\.')} \\{`, 'm'));
    const text = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries(
      [...text.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g)].map(([, n, v]) => [
        n,
        v.toLowerCase(),
      ]),
    );
  }

  it('parses without throwing', () => {
    expect(() => readThemeTokens(css)).not.toThrow();
  });

  it('yields the same values the scripts read today, for both themes', () => {
    const { light, dark } = readThemeTokens(css);
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(10);
    expect(light).toEqual(firstBlock(':root'));
    expect(dark).toEqual(firstBlock('.dark'));
    expect(light['bg-primary']).not.toBe(dark['bg-primary']);
  });
});
