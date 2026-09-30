// The one reader of the `--color-*` design tokens in src/index.css, shared by
// check-contrast, check-design-tokens and diagram-manifest (diagramTokens), so
// the checks and the rendered diagrams never disagree about a value. It also
// holds the WCAG contrast ratio both contrast checks use.
//
// The supported shape is deliberately narrow, matching src/index.css: exactly
// one `:root { ... }` (light) and one `.dark { ... }` (dark) block, each
// starting at column 0 with no nested rules, declaring tokens as 3- or 6-digit
// hex. Top-level `@theme` blocks (Tailwind's mapping of utilities onto the
// tokens) are skipped. Anything else throws, naming the problem, rather than
// being silently read or skipped: a second block for a theme, a missing one, a
// non-hex value, or a `--color-*` declared anywhere else (under `@media`, in a
// compound selector, nested in a rule). Comments are ignored.
//
// Only `node:` imports, or none: check-contrast and check-design-tokens are
// tested by copying them next to this file in a throwaway directory.

const BLOCK = /^(:root|\.dark)\s*\{([^{}]*)\}/gm;
const THEME_BLOCK = /^@theme\b[^{]*\{[^{}]*\}/gm;
const DECLARATION = /(--color-[\w-]+)\s*:\s*([^;}]*)/g;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The `--color-*` tokens of a stylesheet: `light` from its `:root` block,
 * `dark` from its `.dark` block, keyed without the prefix, as 6-digit
 * lowercase hex. Throws on any shape it doesn't support (see above).
 */
export function readThemeTokens(css) {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const tokens = {};
  for (const [, selector, body] of code.matchAll(BLOCK)) {
    const theme = selector === ':root' ? 'light' : 'dark';
    if (tokens[theme])
      throw new Error(`src/index.css has more than one "${selector} {" block`);
    tokens[theme] = {};
    for (const [, name, raw] of body.matchAll(DECLARATION)) {
      const value = raw.trim();
      if (!HEX.test(value)) {
        throw new Error(
          `${name} in "${selector}" is "${value}"; tokens must be 3- or 6-digit hex colors`,
        );
      }
      const hex = value.toLowerCase();
      tokens[theme][name.slice('--color-'.length)] =
        hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
    }
  }
  for (const [theme, selector] of [
    ['light', ':root'],
    ['dark', '.dark'],
  ]) {
    if (!tokens[theme])
      throw new Error(`src/index.css has no top-level "${selector} {" block`);
  }
  const rest = code.replace(BLOCK, '').replace(THEME_BLOCK, '');
  const stray = /--color-[\w-]+(?=\s*:)/.exec(rest);
  if (stray) {
    throw new Error(
      `${stray[0]} is declared outside the ":root {" and ".dark {" blocks; declare --color-* tokens only there`,
    );
  }
  return tokens;
}

/** WCAG 2.x contrast ratio between two `#rrggbb` colors. */
export function contrastRatio(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
