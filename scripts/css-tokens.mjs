// The one reader of the `--color-*` design tokens in src/index.css, shared by
// check-contrast, check-design-tokens and diagram-manifest (diagramTokens), so
// the checks and the rendered diagrams never disagree about a value. It does
// not model everything CSS applies: top-level `@theme` blocks are skipped (in
// src/index.css they only alias each token to itself for Tailwind), so a
// color set there would bypass these checks.
//
// The supported shape is deliberately narrow: tokens are declared only in
// top-level `:root { ... }` (light) and `.dark { ... }` (dark) blocks, as 3- or
// 6-digit hex. Every such block is read in order and a later declaration wins,
// as in CSS. A `--color-*` token declared anywhere else (under `@media`, in a
// compound selector, in a nested rule) or with any other kind of value throws,
// naming the token, rather than being silently read or skipped: a value the
// scripts can't read the way CSS applies it must fail loudly. Top-level
// `@theme` / `@theme inline` blocks (Tailwind's mapping of utilities onto the
// tokens) are skipped. Comments are ignored wherever they appear.
//
// Only `node:` imports, or none: check-contrast and check-design-tokens are
// tested by copying them next to this file in a throwaway directory.

const THEMES = { ':root': 'light', '.dark': 'dark' };
const DECLARATION = /(?:^|[\s;{])(--color-[\w-]+)\s*:/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** The CSS with every comment replaced by a space (strings kept intact). */
function stripComments(css) {
  let out = '';
  let i = 0;
  while (i < css.length) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      const end = stringEnd(css, i);
      out += css.slice(i, end);
      i = end;
    } else if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end === -1 ? css.length : end + 2;
      out += ' ';
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

/** Index just past the string literal starting at `start`. */
function stringEnd(css, start) {
  const quote = css[start];
  let i = start + 1;
  while (i < css.length && css[i] !== quote) i += css[i] === '\\' ? 2 : 1;
  return Math.min(i + 1, css.length);
}

/** Splits comment-free CSS into its top-level items: `{ prelude, body }` for
 * a block (body without the outer braces, null for a `;` statement) and
 * `{ prelude: text, body: null }` for loose text. */
function topLevel(css) {
  const items = [];
  let depth = 0;
  let start = 0;
  let open = -1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      i = stringEnd(css, i) - 1;
    } else if (ch === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth < 0) throw new Error('src/index.css has an unmatched "}"');
      if (depth === 0) {
        items.push({ prelude: css.slice(start, open), body: css.slice(open + 1, i) });
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      items.push({ prelude: css.slice(start, i), body: null });
      start = i + 1;
    }
  }
  if (depth !== 0) throw new Error('src/index.css has an unclosed "{"');
  items.push({ prelude: css.slice(start), body: null });
  return items;
}

/** Throws if `text` declares a `--color-*` token; `where` says where. */
function rejectDeclarations(text, where) {
  const found = DECLARATION.exec(text);
  if (found) {
    throw new Error(
      `${found[1]} is declared ${where}; declare --color-* tokens only in top-level ` +
        '":root {" or ".dark {" blocks',
    );
  }
}

/** Reads one `:root`/`.dark` block body into `values`. Declarations are the
 * text outside any nested rule; a nested rule may not declare a token. */
function readBlock(body, selector, values) {
  const flat = [];
  let depth = 0;
  let nestedStart = 0;
  let last = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '"' || ch === "'") {
      i = stringEnd(body, i) - 1;
    } else if (ch === '{') {
      if (depth === 0) {
        // The nested rule's selector is the text since the last `;`.
        const cut = body.lastIndexOf(';', i) + 1;
        const from = Math.max(cut, last);
        flat.push(body.slice(last, from));
        nestedStart = from;
      }
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rejectDeclarations(
          body.slice(nestedStart, i + 1),
          `in a rule nested in "${selector}"`,
        );
        last = i + 1;
      }
    }
  }
  flat.push(body.slice(last));
  for (const declaration of flat.join(';').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim();
    if (!name.startsWith('--color-')) continue;
    const value = declaration.slice(colon + 1).trim();
    if (!HEX.test(value)) {
      throw new Error(
        `${name} in "${selector}" is "${value}"; tokens must be 3- or 6-digit hex colors`,
      );
    }
    const hex = value.toLowerCase();
    values[name.slice('--color-'.length)] =
      hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  }
}

/**
 * The `--color-*` tokens of a stylesheet: `light` from its top-level `:root`
 * blocks, `dark` from its top-level `.dark` blocks, keyed without the prefix,
 * as 6-digit lowercase hex. Throws, naming the token, on a value it can't read
 * or a token declared anywhere else.
 */
export function readThemeTokens(css) {
  const tokens = { light: {}, dark: {} };
  for (const { prelude, body } of topLevel(stripComments(css))) {
    const selector = prelude.trim().replace(/\s+/g, ' ');
    if (body === null) {
      rejectDeclarations(prelude, 'outside any block');
    } else if (Object.hasOwn(THEMES, selector)) {
      readBlock(body, selector, tokens[THEMES[selector]]);
    } else if (!/^@theme(?:\s|$)/.test(selector)) {
      rejectDeclarations(body, `in "${selector}"`);
    }
  }
  return tokens;
}
