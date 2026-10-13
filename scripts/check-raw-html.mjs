#!/usr/bin/env node
// Guardrail for docs/NON_NEGOTIABLES.md #6: markdown never renders raw HTML,
// and `dangerouslySetInnerHTML` only takes output from an escaping source.
// Fails if package.json depends on a package that renders raw HTML from
// markdown or an HTML string (RAW_HTML_PACKAGES), or if a non-test
// .js/.jsx/.mjs/.cjs/.ts/.tsx/.mts/.cts file under src/ (except src/dsa/code/
// and src/test/, never shipped to the browser) names an HTML sink: any of
// SINKS as a case-insensitive substring, or the whole word `write`/`writeln`
// (case-sensitive), which `document.write` can't be called without, however
// the document is reached. `dangerouslySetInnerHTML` is allowed only in
// src/components/CodeBlock.tsx, which passes it Shiki's escaped output.
//
// It matches names, not syntax (docs/specs/in-process-checks.md), so a name
// in a comment or a string counts too, and the check fails closed rather
// than parsing code. It decodes the escape sequences \uXXXX, \u{...} and \xXX
// first, since `\u0069nnerHTML` is `innerHTML` to the engine. What gets
// past it is a name built at run time
// ('inner' + 'HTML', document['wr' + 'ite']) or spelled with another escape
// (an identity escape such as 'inner\HTML', or a backslash line continuation
// inside a string); review covers those. oxlint's
// `react/no-danger` rule (.oxlintrc.json) also errors on the JSX prop.
// `eval` and `new Function` are script sinks, not HTML ones, and are out of
// scope here.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isMain, listFiles, ROOT } from './lib.mjs';

const RAW_HTML_PACKAGES = [
  'rehype-raw',
  'rehype-dom-raw',
  'hast-util-raw',
  'markdown-to-jsx',
  'html-react-parser',
];
// DOM APIs that parse a string as HTML; none is needed in this app outside
// CodeBlock.tsx's one `dangerouslySetInnerHTML`.
const SINKS = [
  'dangerouslySetInnerHTML',
  'innerHTML',
  'outerHTML',
  'srcdoc',
  'insertAdjacentHTML',
  'setHTMLUnsafe',
  'parseHTMLUnsafe',
  'createContextualFragment',
  'parseFromString',
  'document.write',
];
const WRITE_WORD = /\bwrite(?:ln)?\b/;
const ALLOWED = { 'src/components/CodeBlock.tsx': ['dangerouslySetInnerHTML'] };
const EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts'];
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const NOT_SHIPPED = /^src\/(?:dsa\/code|test)\//;
const ESCAPE = /\\u\{([0-9a-f]+)\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})/gi;

/** `source` with its JavaScript escape sequences decoded (a code point out
 * of range is left as written). */
function decodeEscapes(source) {
  return source.replace(ESCAPE, (match, braced, four, two) => {
    const code = parseInt(braced ?? four ?? two, 16);
    return code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

/** The raw-HTML problems in `root` (default: the repository), each naming
 * the package or file at fault; `[]` when there are none. */
export function rawHtmlProblems(root = ROOT) {
  const problems = [];
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  for (const field of ['dependencies', 'devDependencies']) {
    for (const name of RAW_HTML_PACKAGES) {
      if (pkg[field]?.[name]) {
        problems.push(`package.json: ${name} in ${field} renders raw HTML`);
      }
    }
  }
  for (const file of listFiles({ root, under: 'src', ext: EXTENSIONS })) {
    const rel = relative(root, file).split('\\').join('/');
    if (TEST_FILE.test(rel) || NOT_SHIPPED.test(rel)) continue;
    const source = decodeEscapes(readFileSync(file, 'utf8'));
    if (WRITE_WORD.test(source)) problems.push(`${rel}: names write/writeln`);
    // An allowed name is cut out first, so the sink names inside it
    // (`innerHTML` in `dangerouslySetInnerHTML`) don't count either.
    let text = source.toLowerCase();
    for (const allowed of ALLOWED[rel] ?? []) {
      text = text.replaceAll(allowed.toLowerCase(), '');
    }
    for (const sink of SINKS) {
      if (text.includes(sink.toLowerCase())) problems.push(`${rel}: names ${sink}`);
    }
  }
  return problems;
}

if (isMain(import.meta.url)) {
  const problems = rawHtmlProblems();
  if (problems.length > 0) {
    console.error('Raw HTML rendering found (docs/NON_NEGOTIABLES.md #6):\n');
    for (const problem of problems) console.error(`  ${problem}`);
    process.exit(1);
  }
  console.log('No raw HTML rendering outside CodeBlock.tsx.');
}
