#!/usr/bin/env node
// Guardrail for docs/DESIGN.md's accessibility rule that text clears WCAG AA
// (4.5:1) against the surfaces it sits on, in both themes. The contrast check
// was previously a one-time manual calculation, which is how `text-tertiary`
// ended up below AA in light mode for a while; this turns it into a hard
// check, the same "documented convention -> CI failure" move as `check:colors`
// and `check:tokens`. It reads the token values straight from src/index.css,
// so a palette change is checked automatically.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CSS_PATH = join(ROOT, 'src', 'index.css');

const AA_NORMAL_TEXT = 4.5;
// Tokens used as text color, and the surface tokens they can sit on. The
// tertiary surface is included even though no component uses it yet: it is a
// documented, reserved token, and a text token that fails on it would be a
// trap for whoever uses it first.
const TEXT_TOKENS = [
  'text-primary',
  'text-secondary',
  'text-tertiary',
  'accent',
  'accent-hover',
];
const SURFACE_TOKENS = ['bg-primary', 'bg-secondary', 'bg-tertiary'];

// Anchored to the start of a line so a comment that merely mentions a selector
// can't be mistaken for the block itself.
function extractBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escaped}\\s*\\{`, 'm').exec(css);
  if (!match) throw new Error(`Could not find a "${selector} {" block in ${CSS_PATH}`);
  const end = css.indexOf('}', match.index);
  return css.slice(match.index, end);
}

function extractTokens(block) {
  const tokens = new Map();
  const pattern = /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g;
  let match;
  while ((match = pattern.exec(block))) {
    tokens.set(match[1], match[2]);
  }
  return tokens;
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (lighter + 0.05) / (darker + 0.05);
}

const css = readFileSync(CSS_PATH, 'utf8');
const themes = {
  light: extractTokens(extractBlock(css, ':root')),
  dark: extractTokens(extractBlock(css, '.dark')),
};

const errors = [];

// If both blocks resolve to the same values, one of them was mis-read (or the
// dark theme was lost), and the check would pass by comparing light twice.
if (themes.light.get('bg-primary') === themes.dark.get('bg-primary')) {
  errors.push(
    'the light and dark themes have the same --color-bg-primary; one block was probably mis-read.',
  );
}

for (const [theme, tokens] of Object.entries(themes)) {
  for (const name of [...TEXT_TOKENS, ...SURFACE_TOKENS]) {
    if (!tokens.has(name)) {
      errors.push(`${theme}: --color-${name} is not defined in src/index.css.`);
    }
  }
  for (const text of TEXT_TOKENS) {
    for (const surface of SURFACE_TOKENS) {
      const foreground = tokens.get(text);
      const background = tokens.get(surface);
      if (!foreground || !background) continue;
      const ratio = contrastRatio(foreground, background);
      if (ratio < AA_NORMAL_TEXT) {
        errors.push(
          `${theme}: ${text} (${foreground}) on ${surface} (${background}) is ${ratio.toFixed(2)}:1, below the ${AA_NORMAL_TEXT}:1 AA minimum.`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Text/background contrast is below WCAG AA in src/index.css:\n');
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(
  `Every text token clears ${AA_NORMAL_TEXT}:1 on every surface token, in both themes.`,
);
