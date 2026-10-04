#!/usr/bin/env node
// Guardrail for docs/NON_NEGOTIABLES.md #6: markdown never renders raw HTML,
// and `dangerouslySetInnerHTML` only takes output from an escaping source.
// Fails if a dependency that turns on raw HTML in markdown is installed, if
// `dangerouslySetInnerHTML` appears in app code outside the one component
// allowed to use it (CodeBlock.tsx, which passes it Shiki's escaped output),
// or if app code writes HTML through another DOM sink (innerHTML and friends).
//
// The sink check is a text lint, so it can't follow values. By design it does
// not catch (docs/specs/raw-html-sink-variants.md, "Known limits"):
//   - `Object.assign(el, { innerHTML: s })`;
//   - computed keys (`el[key] = s`);
//   - `Reflect.set(el, 'innerHTML', s)`;
//   - aliasing (`const w = document.write; w(s)`);
//   - a comment between the property and `=` (`el.innerHTML /* x */ = s`);
//   - destructuring writes (`({ a: el.innerHTML } = { a: s })`);
//   - bracketed method calls (`document['write'](s)`);
//   - a JSX spread (`<iframe {...{ srcDoc: s }} />`);
//   - `setAttributeNS(null, 'srcdoc', s)`;
//   - whitespace after the dot (`el. innerHTML = s`, `el?. innerHTML = s`)
//     anywhere but documentWrite, the one pattern that allows it. Prettier,
//     which `npm run verify` runs, never produces that spacing.
// It also over-matches: jsxSrcdoc flags `srcDoc`/`srcdoc` used as a default
// value (`function f(srcDoc = "")`, `({ srcDoc = '' })`), as it does for
// `const srcDoc =`; rename the variable around it.
// `eval` and `new Function` are script sinks, not HTML ones, and are out of
// scope here.
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { listFiles, ROOT as REPO_ROOT } from './lib.mjs';

const ROOT = process.env.CHECK_RAW_HTML_ROOT ?? REPO_ROOT;
const RAW_HTML_PACKAGES = ['rehype-raw', 'rehype-dom-raw'];
const ALLOWED = new Set(['src/components/CodeBlock.tsx']);

// DOM APIs that parse a string as HTML; none is needed anywhere in this app.
// One pattern per sink family. `\s` spans line breaks on purpose.
const HTML_PROPS = String.raw`innerHTML|outerHTML|srcdoc`;
// `=` and the compound forms `+=`, `||=`, `&&=`, `??=`, but never `==`/`===`
// (a comparison) or `=>`.
const ASSIGN = String.raw`\s*(?:\+|\|\||&&|\?\?)?=(?![=>])`;
const RAW_HTML_SINKS = {
  // `el.innerHTML = s`, `el.innerHTML += s`, `frame.srcdoc = s`; the word
  // boundary lets longer names (`innerHTMLCache`, `srcdocs`) through.
  propertyWrite: new RegExp(String.raw`\.(?:${HTML_PROPS})\b${ASSIGN}`),
  // `el['innerHTML'] = s`, with any of the three quotes.
  bracketWrite: new RegExp(String.raw`\[\s*(['"\x60])(?:${HTML_PROPS})\1\s*\]${ASSIGN}`),
  // Methods that parse their string argument as HTML.
  htmlMethod:
    /\.(?:insertAdjacentHTML|setHTMLUnsafe|parseHTMLUnsafe|createContextualFragment)\s*\(/,
  // `document.write(s)`, and any identifier ending in `document`/`Document`
  // (`_document`, `frame.contentDocument`, `el.ownerDocument`). The lookbehind
  // starts the match at the identifier's first character; `documentation` and
  // `doc.writeFile` don't match. Optional chaining (`contentDocument?.write(`)
  // and whitespace or line breaks around the dot (`document\n  .write(`) do.
  // So do a TypeScript non-null assertion (`contentDocument!.write(`) and a
  // closing paren before the dot: `(document).write(`, and a cast
  // `(x as Document).write(`, where the match starts at the type name. A cast
  // to another type (`(doc as Docs).write(`) doesn't match.
  documentWrite: /(?<![\w$])[\w$]*[dD]ocument!?\)?\s*\??\.\s*write(?:ln)?\s*\(/,
  // A JSX `srcDoc`/`srcdoc` attribute (`<iframe srcDoc={s} />`). The
  // lookbehind leaves `frame.srcdoc = s` to propertyWrite.
  jsxSrcdoc: /(?<![.\w$])srcdoc\s*=(?![=>])/i,
  // `frame.setAttribute('srcdoc', s)`, with any of the three quotes.
  setAttributeSrcdoc: /\.setAttribute\s*\(\s*(['"\x60])srcdoc\1/i,
};
const violations = [];

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'devDependencies']) {
  for (const name of RAW_HTML_PACKAGES) {
    if (pkg[field]?.[name])
      violations.push(`package.json ${field}: ${name} renders raw HTML`);
  }
}

const appFiles = listFiles({
  root: ROOT,
  under: 'src',
  // `.mjs` too: src/lib/markdown.mjs ships to the browser.
  ext: ['.js', '.jsx', '.mjs', '.ts', '.tsx'],
}).filter((path) => !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path));
for (const path of appFiles) {
  const rel = relative(ROOT, path).split('\\').join('/');
  const source = readFileSync(path, 'utf8');
  if (!ALLOWED.has(rel) && source.includes('dangerouslySetInnerHTML')) {
    violations.push(`${rel}: dangerouslySetInnerHTML outside ${[...ALLOWED].join(', ')}`);
  }
  for (const pattern of Object.values(RAW_HTML_SINKS)) {
    const sink = pattern.exec(source);
    // Collapse whitespace so a match across a line break stays on one line,
    // and print a member access as a plain `.`, dropping a `!` or `)` before
    // it: `document\n  .write(` prints `document.write(`, and
    // `contentDocument?.write(` and `contentDocument!.write(` both print
    // `contentDocument.write(`.
    if (sink) {
      const text = sink[0]
        .replace(/!?\)?\s*\??\.\s*/g, '.')
        .replace(/\s+/g, ' ')
        .trim();
      violations.push(`${rel}: ${text} writes raw HTML`);
    }
  }
}

if (violations.length > 0) {
  console.error('Raw HTML rendering found (docs/NON_NEGOTIABLES.md #6):\n');
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('No raw HTML rendering outside CodeBlock.tsx.');
