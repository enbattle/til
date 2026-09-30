// Tests for the one shared reader of the `--color-*` design tokens in
// src/index.css (check-contrast, check-design-tokens and diagramTokens all
// read through it) and the contrast ratio it shares.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, readThemeTokens } from './css-tokens.mjs';

const block = (selector, body) => `${selector} {\n${body}\n}\n`;
const base =
  '/* :root { --color-accent: #000000; } */\n' +
  block(':root', '  --color-accent: #A1b;\n  --gap: var(--color-x);') +
  block('.dark', '  --color-accent: #222222;') +
  block('@theme inline', '  --color-accent: var(--color-accent);');

describe('readThemeTokens', () => {
  it('reads the :root and .dark blocks as 6-digit lowercase hex, skipping comments and @theme', () => {
    expect(readThemeTokens(base)).toEqual({
      light: { accent: '#aa11bb' },
      dark: { accent: '#222222' },
    });
  });

  it.each([
    [
      'a second :root block',
      block(':root', '  --color-accent: #111111;'),
      /more than one/,
    ],
    [
      'a second .dark block',
      block('.dark', '  --color-border: #111111;'),
      /more than one/,
    ],
    [
      'a token under @media',
      '@media (x) {\n  :root {\n    --color-accent: #000;\n  }\n}\n',
      /--color-accent/,
    ],
    [
      'a token in another selector',
      block('html.dark', '  --color-accent: #000;'),
      /--color-accent/,
    ],
    [
      'a token nested in a rule',
      '.x {\n  .dark {\n    --color-border: #000;\n  }\n}\n',
      /--color-border/,
    ],
  ])('throws on %s', (_label, extra, message) => {
    expect(() => readThemeTokens(base + extra)).toThrow(message);
  });

  it.each(['#11223344', 'var(--color-border)', 'red', ''])(
    'throws, naming the token, on the value "%s"',
    (value) => {
      expect(() =>
        readThemeTokens(
          block(':root', `  --color-accent: ${value};`) + block('.dark', ''),
        ),
      ).toThrow(/--color-accent/);
    },
  );

  it('ignores non-color @theme declarations', () => {
    expect(() =>
      readThemeTokens(
        base + block('@theme', "  --font-sans: 'X', sans-serif;\n  --spacing: 4px;"),
      ),
    ).not.toThrow();
  });

  it.each([
    ['a hex', '#ff0000'],
    ['an rgb()', 'rgb(255 0 0)'],
    ['an oklch()', 'oklch(0.6 0.2 30)'],
    ['a var to an undefined token', 'var(--color-nope)'],
    ['a var with a fallback', 'var(--color-accent, #fff)'],
    ['a var to a non-color property', 'var(--gap)'],
  ])('throws, naming the declaration, on %s inside @theme inline', (_label, value) => {
    const css = base + block('@theme inline', `  --color-danger: ${value};`);
    expect(() => readThemeTokens(css)).toThrow(/--color-danger in "@theme"/);
  });

  it('throws on an @theme var to a token only one theme defines', () => {
    const css =
      block(':root', '  --color-accent: #111111;\n  --color-only-light: #222222;') +
      block('.dark', '  --color-accent: #333333;') +
      block('@theme inline', '  --color-x: var(--color-only-light);');
    expect(() => readThemeTokens(css)).toThrow(/--color-x in "@theme"/);
  });

  it('throws when a theme block is missing', () => {
    expect(() => readThemeTokens(block(':root', '  --color-accent: #111111;'))).toThrow(
      /\.dark/,
    );
  });

  it('reads the real src/index.css: two different themes of at least 10 tokens', () => {
    const { light, dark } = readThemeTokens(
      readFileSync(resolve('src/index.css'), 'utf8'),
    );
    expect(Object.keys(light).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(dark)).toEqual(Object.keys(light));
    expect(light['bg-primary']).not.toBe(dark['bg-primary']);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white, either way round, and 1:1 for a color on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#92400e', '#92400e')).toBe(1);
  });
});
