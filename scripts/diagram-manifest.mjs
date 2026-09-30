// Shared by render-diagrams.mjs (which renders the diagrams and writes
// public/diagrams/manifest.json) and check-diagrams.mjs (which proves, without
// d2, that what is committed still matches), so both read the tokens, hash
// files, check contrast and police `.d2` colors the same way.
//
// Manifest shape (the lock file):
//
//   {
//     "$tokens": {
//       "light": { "<token>": "#rrggbb", ... },   // src/index.css `:root {` blocks
//       "dark":  { "<token>": "#rrggbb", ... }    // src/index.css `.dark {` blocks
//     },
//     "<case>/<name>.d2": {
//       "sha256": "<SHA-256 of the .d2>",
//       "width": 811, "height": 1113,             // read by the app for <img>
//       "svgs": { "light": "<SHA-256>", "dark": "<SHA-256>" }
//     }
//   }
//
// `$tokens` holds only the tokens SLOTS maps into the D2 theme, keyed without
// the `--color-` prefix. Every hash normalizes CRLF to LF first, so a Windows
// checkout with autocrlf and CI agree.
import { createHash } from 'node:crypto';
import { contrastRatio, readThemeTokens } from './css-tokens.mjs';

/** The manifest's one reserved, non-source key. */
export const TOKENS_KEY = '$tokens';

/** Where a `.d2` source may live, relative to src/system-design/diagrams/:
 * `<case-slug>/<name>.d2`, lowercase kebab-case, exactly one folder deep. The
 * rendered SVGs mirror it under public/diagrams/. */
const SOURCE_PATH = /^[a-z0-9-]+\/[a-z0-9-]+\.d2$/;

/** Why a `.d2` source path (relative, with `/`) breaks the naming rule, or
 * null when it follows it. */
export function sourcePathProblem(source) {
  return SOURCE_PATH.test(source)
    ? null
    : 'sources live at <case-slug>/<name>.d2 (lowercase, kebab-case, one folder deep)';
}

/** Lowercase hex SHA-256 of a text file (a `.d2` source or a rendered SVG),
 * with CRLF normalized to LF so a Windows checkout and CI agree. */
export function sourceHash(text) {
  return createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
}

// --- design tokens -> D2 theme ---------------------------------------------------

// D2's theme slots, and the token each one takes. N* are neutrals (N1 is shape
// and label text, N2 connection labels, N7 the canvas), B* the base palette
// (B1 shape and arrow strokes, B4-B6 shape fills from container to leaf), and
// AA*/AB* the fills of special shapes such as cylinders and queues. Fills are
// kept to the paper surfaces plus the soft accent, so dark text always sits on
// a light fill in light mode and light text on a dark fill in dark mode.
const SLOTS = {
  N1: 'text-primary',
  N2: 'text-secondary',
  N3: 'text-tertiary',
  N4: 'border',
  N5: 'bg-tertiary',
  N6: 'bg-secondary',
  N7: 'bg-primary',
  B1: 'accent',
  B2: 'accent',
  B3: 'border',
  B4: 'bg-secondary',
  B5: 'accent-soft',
  B6: 'accent-soft',
  AA2: 'accent',
  AA4: 'bg-tertiary',
  AA5: 'bg-tertiary',
  AB4: 'bg-tertiary',
  AB5: 'bg-secondary',
};

/** Each D2 text slot and every fill slot it can sit on. */
const TEXT_ON = {
  N1: ['N4', 'N5', 'N6', 'N7', 'B3', 'B4', 'B5', 'B6', 'AA4', 'AA5', 'AB4', 'AB5'],
  N2: ['N5', 'N6', 'N7', 'B4', 'B5', 'B6'],
};

/** The src/index.css blocks each rendered theme takes its tokens from. */
const THEME_SELECTORS = { light: ':root', dark: '.dark' };

/** The tokens the diagrams are rendered with, per theme, as recorded in the
 * manifest's `$tokens`, plus problems (a missing token). Tokens are read by
 * the shared `readThemeTokens`, which throws on a token it can't read the way
 * CSS applies it. */
export function diagramTokens(css) {
  const themes = readThemeTokens(css);
  const tokens = {};
  const problems = [];
  const names = [...new Set(Object.values(SLOTS))].sort();
  for (const [theme, selector] of Object.entries(THEME_SELECTORS)) {
    tokens[theme] = {};
    for (const name of names) {
      if (themes[theme][name]) tokens[theme][name] = themes[theme][name];
      else problems.push(`src/index.css "${selector}" has no --color-${name}`);
    }
  }
  return { tokens, problems };
}

/** A theme's D2 overrides (slot -> hex) from its recorded tokens. */
export function themeSlots(themeTokens) {
  return Object.fromEntries(
    Object.entries(SLOTS).map(([slot, token]) => [slot, themeTokens[token]]),
  );
}

/** Every TEXT_ON pair below WCAG AA (4.5:1) in any theme, as messages. */
export function contrastProblems(tokens) {
  const problems = [];
  for (const [theme, selector] of Object.entries(THEME_SELECTORS)) {
    const slots = themeSlots(tokens[theme] ?? {});
    for (const [text, fills] of Object.entries(TEXT_ON)) {
      for (const fill of fills) {
        if (!slots[text] || !slots[fill]) continue;
        const ratio = contrastRatio(slots[text], slots[fill]);
        if (ratio < 4.5) {
          problems.push(
            `src/index.css "${selector}": diagram text ${text} (--color-${SLOTS[text]}) on ${fill} (--color-${SLOTS[fill]}) is ${ratio.toFixed(2)}:1, below the 4.5:1 contrast minimum. Change the tokens or the mapping in scripts/diagram-manifest.mjs.`,
          );
        }
      }
    }
  }
  return problems;
}

// --- colors and imports in .d2 sources -----------------------------------------

// A style key that takes a color, in any form D2 accepts: `x.style.fill: red`,
// `{style.fill: red}`, a `style: { fill: red }` map, `(a -> b)[0].style.stroke`,
// a class or glob. `stroke-dash`/`stroke-width` don't match (the key must end
// at the colon). The theme keys would replace the token-derived theme.
const COLOR_KEY =
  /(?:^|[\s{;.,"'])(fill|stroke|font-color|fill-pattern|theme-id|dark-theme-id|theme-overrides|dark-theme-overrides)["']?\s*:/;
// A hex color only matters where D2 takes it as a value: a whole quoted value
// (`"#ff0000"`, e.g. in `vars`) or an unquoted one right after the colon
// (`x:#f00`; with a space before it, `#` starts a comment). A `#` inside a
// longer label (`"Issue #123"`) or a comment is not a color.
const HEX_VALUE = /(["'])\s*(#[0-9a-fA-F]{3,8})\s*\1|:(#[0-9a-fA-F]{3,8})\b/;
// A D2 import: `...@file` spreads a file in, `x: @file` imports it as a value.
// Either pulls in a source the manifest hash and this guard never see.
const IMPORT = /\.\.\.\s*@|(?:^|[:{;])\s*@/;
// A quoted string on one line, blanked before looking for a comment or an import.
const QUOTED = /(["'])(?:\\.|(?!\1)[^\\])*\1/g;

/** Why a `.d2` source can't be rendered and checked as it is, or null: it
 * names a color (a color style key or a hex value), or it imports another
 * file, which would escape both the source hash and the color guard. It checks
 * each line once `"""` block comments and the line's `# ...` comment (a `#` at
 * the start or after whitespace, outside quotes) are dropped. Used by
 * check-diagrams.mjs and render-diagrams.mjs. */
export function d2SourceProblem(text) {
  for (const line of text.replace(/"""[\s\S]*?(?:"""|$)/g, '').split(/\r?\n/)) {
    const blanked = line.replace(QUOTED, (s, q) => q + ' '.repeat(s.length - 2) + q);
    const end = blanked.search(/(?:^|\s)#/);
    const code = end === -1 ? line : line.slice(0, end);
    const key = COLOR_KEY.exec(code);
    const hex = HEX_VALUE.exec(code);
    if (key || hex) {
      const color = key
        ? `sets \`${key[1]}\``
        : `contains the hex color ${hex[2] ?? hex[3]}`;
      return `${color}. Diagram colors come from the site tokens through the theme; remove it`;
    }
    if (IMPORT.test(blanked.slice(0, code.length))) {
      return 'imports another file (`...@file` or `x: @file`). Imports are not allowed: the imported file would escape the source hash and the color guard, so put everything in this one file';
    }
  }
  return null;
}

// --- SVG allowlist ---------------------------------------------------------------

// Everything d2 v0.9 emits for the diagrams here (nested <svg>, <style> with an
// embedded font, <g>, <rect>, <path>, <polygon>, <text>, <marker>, <mask>),
// plus a few inert shape and structure elements it uses for other shapes.
// Nothing that runs script, embeds another document, loads a resource or
// animates an attribute (<script>, <foreignObject>, <iframe>, <image>, <a>,
// <set>, <animate*>, ...) is on it. If a new diagram needs another element,
// add it here only if it can do none of those things.
const ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'style',
  'rect',
  'path',
  'polygon',
  'polyline',
  'line',
  'circle',
  'ellipse',
  'text',
  'tspan',
  'marker',
  'mask',
  'clipPath',
  'use',
  'title',
  'desc',
]);

const ATTRIBUTES = new Set([
  'xmlns',
  'xmlns:xlink',
  'version',
  'data-d2-version',
  'preserveAspectRatio',
  'viewBox',
  'id',
  'class',
  'style',
  'type',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'dx',
  'dy',
  'width',
  'height',
  'd',
  'points',
  'transform',
  'fill',
  'fill-opacity',
  'fill-rule',
  'opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-opacity',
  'mask',
  'maskUnits',
  'clip-path',
  'clipPathUnits',
  'marker-start',
  'marker-end',
  'markerWidth',
  'markerHeight',
  'markerUnits',
  'refX',
  'refY',
  'orient',
  'text-anchor',
  'dominant-baseline',
  'font-family',
  'font-size',
  'font-weight',
  'xml:space',
  'href',
  'xlink:href',
]);

const ANIMATION = /^(set|animate|animateMotion|animateTransform|animateColor|discard)$/;
const HREF = new Set(['href', 'xlink:href']);
const ATTRIBUTE = /\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

// CSS can load a resource through more than `url(`: image-set(), cross-fade(),
// a bare string in some positions, an escaped function name (`u\72l(`), and
// whatever CSS adds next. So instead of a list of known-bad names, attribute
// values and CSS are held to the shapes d2 v0.9 actually emits.

/** In `transform` only, the SVG transform functions (which take numbers). */
const TRANSFORM_FUNCTIONS =
  /^(?:matrix|translate|translateX|translateY|scale|rotate|skewX|skewY)$/;

/** `style="..."` properties: what d2 v0.9 emits (`stroke-width`,
 * `stroke-dasharray`, `text-anchor`, `font-size`) plus a few more of the same
 * kind. Every one takes only numbers or keywords, never an image, URL or string. */
const STYLE_PROPERTIES = new Set([
  'stroke-width',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'fill-opacity',
  'opacity',
  'text-anchor',
  'dominant-baseline',
  'font-size',
  'font-weight',
  'font-style',
  'shape-rendering',
]);
/** A `style` value: letters, digits, `.`, `%`, `,`, `-`, `_` and spaces only;
 * so no quote, parenthesis, colon, slash or backslash, and no string, URL or
 * function of any kind. */
const STYLE_VALUE = /^[\w.%, -]+$/;

/** Problems with a `style` attribute: every declaration must be an allowed
 * property with a plain number-or-keyword value. */
function styleAttributeProblems(element, value) {
  const problems = [];
  for (const declaration of value.split(';')) {
    if (!declaration.trim()) continue;
    const colon = declaration.indexOf(':');
    const property = (colon === -1 ? declaration : declaration.slice(0, colon)).trim();
    const val = colon === -1 ? '' : declaration.slice(colon + 1).trim();
    if (!STYLE_PROPERTIES.has(property)) {
      problems.push(
        `<${element} style>: property "${property.slice(0, 40)}" is not on the allowlist`,
      );
    } else if (!STYLE_VALUE.test(val)) {
      problems.push(
        `<${element} style>: ${property} value "${val.slice(0, 40)}" is not a plain number or keyword`,
      );
    }
  }
  return problems;
}

/** Problems with one attribute value: a backslash (a CSS escape can spell any
 * function name), a character reference (which could spell `javascript:` past
 * any pattern), a quote (a CSS string can be a URL), a reference that leaves
 * the file, any function but `url(#fragment)` (or numeric transform functions
 * in `transform`), and in `style`, anything off the property and value
 * allowlist. */
function valueProblems(element, name, value) {
  const problems = [];
  if (value.includes('\\')) {
    problems.push(`<${element} ${name}>: backslash (a CSS escape) in an attribute value`);
  }
  if (value.includes('&')) {
    problems.push(
      `<${element} ${name}>: character or entity reference in an attribute value`,
    );
  }
  if (/["']/.test(value)) {
    problems.push(`<${element} ${name}>: quote in an attribute value`);
  }
  if (HREF.has(name) && !value.startsWith('#')) {
    problems.push(
      `<${element} ${name}="${value.slice(0, 40)}">: only #fragment references are allowed (no data:, javascript: or external URLs)`,
    );
  }
  if (name === 'style') {
    problems.push(...styleAttributeProblems(element, value));
  } else {
    for (const [call, fn, args = ''] of value.matchAll(/([\w-]*)\s*\(([^)]*)\)?/g)) {
      const fragment = fn.toLowerCase() === 'url' && /^\s*#[\w.-]+\s*$/.test(args);
      const transform =
        name === 'transform' &&
        TRANSFORM_FUNCTIONS.test(fn) &&
        /^[\d\s.,eE+-]*$/.test(args);
      if (!fragment && !transform) {
        problems.push(`<${element} ${name}>: ${call.slice(0, 40)} is not url(#fragment)`);
      }
    }
  }
  if (/javascript:|data:|expression\(/i.test(value)) {
    problems.push(
      `<${element} ${name}>: value contains a script, data: or expression() reference`,
    );
  }
  return problems;
}

// The one @font-face shape d2 emits: a family name and a base64 data: font.
const FONT_FACE =
  /@font-face\s*\{\s*font-family:\s*[\w-]+;\s*src:\s*url\("data:(?:font\/[\w.+-]+|application\/(?:x-)?font-[\w.+-]+);base64,[A-Za-z0-9+/=]*"\);?\s*\}/g;
// d2's rules name those fonts as a quoted identifier.
const FONT_FAMILY = /font-family:\s*"[\w-]+"/g;

/** Problems with a <style> element's CSS. Only d2's shape passes: rules with
 * plain values, `font-family: "<identifier>"`, and `@font-face` blocks whose
 * only source is an embedded base64 `data:` font. With those set aside, any
 * at-rule, quoted string, function call, escape or markup is a problem, so no
 * @import, image-set(), cross-fade() or url() can load anything. */
function styleProblems(content) {
  const problems = [];
  // d2 wraps its CSS in one or more CDATA sections.
  const css = content.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  if (/[<&\\]/.test(css)) {
    problems.push('<style>: contains markup, an entity reference or a CSS escape');
  }
  const rest = css.replace(FONT_FACE, '').replace(FONT_FAMILY, 'font-family:x');
  for (const [rule] of rest.matchAll(/@[\w-]*/g)) {
    problems.push(
      `<style>: at-rule ${rule} is not allowed (only an @font-face with an embedded data: font)`,
    );
  }
  if (/["']/.test(rest)) {
    problems.push(
      '<style>: quoted string outside a font-family name or an embedded @font-face',
    );
  }
  for (const [call] of rest.matchAll(/[\w-]*\s*\(/g)) {
    problems.push(
      `<style>: function ${call.slice(0, 40)} is not allowed outside an embedded @font-face`,
    );
  }
  if (/javascript:|expression|behavior\s*:|-moz-binding/i.test(rest)) {
    problems.push('<style>: contains a script-capable CSS construct');
  }
  return problems;
}

/** The one accepted `<?xml ...?>` declaration shape (see svgProblems). */
const XML_DECLARATION =
  /^<\?xml version="1\.0"(?: encoding="[uU][tT][fF]-8")?(?: standalone="(?:yes|no)")?\?>/;

/**
 * Why a rendered SVG is unsafe to open as a document, as a list of problems
 * (empty when it's fine). It is an allowlist over a strict, minimal XML
 * tokenizer: an optional `<?xml ...?>` declaration, then only allowed elements
 * with allowed, quoted attributes; no comments, DOCTYPE (it could declare
 * entities) or processing instructions; text content may use entity
 * references, attribute values may not. Anything the tokenizer can't read is a
 * problem too, so a malformed file fails rather than slipping through.
 */
export function svgProblems(svg) {
  const problems = [];
  let text = svg.replace(/^﻿/, '');
  // The declaration is an allowlist of its own: exactly `<?xml version="1.0"`,
  // then optionally ` encoding="utf-8"` (any case), then optionally
  // ` standalone="yes|no"`, in that order, single spaces, double quotes. Only
  // UTF-8: another declared encoding (UTF-7 spells `<script>` as
  // `+ADw-script+AD4-`), or a second `encoding` a parser might honor, would
  // make the bytes decode differently from how this allowlist read them.
  const decl = XML_DECLARATION.exec(text);
  if (decl) {
    text = text.slice(decl[0].length);
  } else if (text.startsWith('<?')) {
    const shown = text.slice(0, Math.max(text.indexOf('?>') + 2, 2)).slice(0, 80);
    problems.push(
      `XML declaration ${JSON.stringify(shown)} is not allowed; only <?xml version="1.0"` +
        ' with an optional encoding="utf-8" and standalone="yes|no", in that order',
    );
    return problems;
  }
  let i = 0;
  let seenRoot = false;
  while (i < text.length) {
    const lt = text.indexOf('<', i);
    if (lt === -1) break;
    if (text.startsWith('</', lt)) {
      const close = /^<\/([A-Za-z][\w:.-]*)\s*>/.exec(text.slice(lt, lt + 200));
      if (!close) {
        problems.push(`unreadable closing tag at offset ${lt}`);
        break;
      }
      i = lt + close[0].length;
      continue;
    }
    if (text.startsWith('<!', lt) || text.startsWith('<?', lt)) {
      problems.push(
        `${text.slice(lt, lt + 9)}... at offset ${lt}: comments, DOCTYPE, CDATA outside <style> and processing instructions are not allowed`,
      );
      break;
    }
    const open = /^<([A-Za-z][\w:.-]*)/.exec(text.slice(lt, lt + 100));
    if (!open) {
      problems.push(`unreadable tag at offset ${lt}`);
      break;
    }
    const element = open[1];
    if (!seenRoot && element !== 'svg')
      problems.push(`root element is <${element}>, not <svg>`);
    seenRoot = true;
    if (ANIMATION.test(element)) {
      problems.push(
        `<${element}>: animation elements are not allowed (they can rewrite attributes such as href)`,
      );
    } else if (!ELEMENTS.has(element)) {
      problems.push(`<${element}>: element is not on the allowlist`);
    }
    ATTRIBUTE.lastIndex = lt + open[0].length;
    let end = ATTRIBUTE.lastIndex;
    for (let match; (match = ATTRIBUTE.exec(text));) {
      const [, name, double, single] = match;
      const value = double ?? single;
      if (/^on/i.test(name))
        problems.push(`<${element} ${name}>: event-handler attribute`);
      else if (!ATTRIBUTES.has(name)) {
        problems.push(`<${element} ${name}>: attribute is not on the allowlist`);
      }
      problems.push(...valueProblems(element, name, value));
      end = ATTRIBUTE.lastIndex;
    }
    const tail = /^\s*(\/?)>/.exec(text.slice(end, end + 50));
    if (!tail) {
      problems.push(`<${element}> at offset ${lt}: unreadable attributes`);
      break;
    }
    i = end + tail[0].length;
    if (element === 'style' && !tail[1]) {
      const closeAt = text.indexOf('</style>', i);
      if (closeAt === -1) {
        problems.push('<style>: not closed');
        break;
      }
      problems.push(...styleProblems(text.slice(i, closeAt)));
      i = closeAt + '</style>'.length;
    }
  }
  if (!seenRoot) problems.push('no <svg> element');
  return [...new Set(problems)];
}
