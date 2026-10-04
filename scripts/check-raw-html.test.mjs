// @vitest-environment node
// Planted-violation tests for scripts/check-raw-html.mjs (NON_NEGOTIABLES #6).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseSync } from 'oxc-parser';
import { afterEach, describe, expect, it } from 'vitest';
import { markdownParser } from '../src/lib/markdown.mjs';
import { cleanTemps, gitInit, run, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

export const NON_NEGOTIABLES = resolve('docs/NON_NEGOTIABLES.md');

/**
 * The distinct inline-code spans in one numbered item of a markdown ordered
 * list, parsed with the site's markdown stack. The item is found by its number
 * (`list.start` + its index), not by its position in the file. `source` is
 * `{ path }` or `{ text }`, so a copy of the document can be fed in.
 */
export function itemSpans(number, source = { path: NON_NEGOTIABLES }) {
  const text = source.text ?? readFileSync(source.path, 'utf8');
  const items = [];
  (function walk(node) {
    if (node.type === 'list' && node.ordered) {
      node.children.forEach((item, index) => {
        if ((node.start ?? 1) + index === number) items.push(item);
      });
    }
    for (const child of node.children ?? []) walk(child);
  })(markdownParser().parse(text));
  if (items.length !== 1) {
    throw new Error(`expected one list item numbered ${number}, found ${items.length}`);
  }
  const spans = new Set();
  (function collect(node) {
    if (node.type === 'inlineCode') spans.add(node.value);
    for (const child of node.children ?? []) collect(child);
  })(items[0]);
  return spans;
}

// Every inline-code span NON_NEGOTIABLES #6 contains, classified. A sink has
// a planted fixture that check-raw-html must reject with a stderr line naming
// it (`named`); `null` marks a span that isn't a sink.
const BAD = 'components/Bad.tsx';
export const SPAN_TABLE = {
  'rehype-raw': {
    fixture: { pkg: { dependencies: { 'rehype-raw': '^7' } } },
    named: 'rehype-raw',
  },
  dangerouslySetInnerHTML: {
    fixture: {
      src: {
        [BAD]:
          'export const B = ({ s }) => <div dangerouslySetInnerHTML={{ __html: s }} />;\n',
      },
    },
    named: 'dangerouslySetInnerHTML',
  },
  innerHTML: { fixture: { src: { [BAD]: 'el.innerHTML = html;' } }, named: '.innerHTML' },
  outerHTML: { fixture: { src: { [BAD]: 'el.outerHTML = html;' } }, named: '.outerHTML' },
  insertAdjacentHTML: {
    fixture: { src: { [BAD]: "el.insertAdjacentHTML('beforeend', s)" } },
    named: '.insertAdjacentHTML',
  },
  'document.write': {
    fixture: { src: { [BAD]: 'document.write(s)' } },
    named: 'document.write',
  },
  'check:raw-html': null,
  'check:diagrams': null,
  'public/': null,
  '.d2': null,
  'scripts/checks.test.mjs': null,
  svgProblems: null,
};

// Sinks the script rejects beyond what #6 names; not driven by #6's text.
const SCRIPT_ONLY_SINKS = {
  'rehype-dom-raw': {
    fixture: { pkg: { devDependencies: { 'rehype-dom-raw': '^1' } } },
    named: 'rehype-dom-raw',
  },
  'document.writeln': {
    fixture: { src: { [BAD]: 'document.writeln(s)' } },
    named: 'document.writeln',
  },
};

// docs/specs/raw-html-sink-variants.md "Must reject": variant forms of the
// sinks, plus HTML-parsing sinks #6 doesn't name. R1 and R5 are the SPAN_TABLE
// and SCRIPT_ONLY_SINKS plants above. `named` is matched case-insensitively,
// since the spec accepts `srcdoc` or `srcDoc`. Each fixture holds one form.
const SINK_VARIANTS = {
  'R2 innerHTML +=': {
    fixture: { src: { [BAD]: 'el.innerHTML += s;' } },
    named: 'innerHTML',
  },
  'R2 innerHTML ||=': {
    fixture: { src: { [BAD]: 'el.innerHTML ||= s;' } },
    named: 'innerHTML',
  },
  'R2 outerHTML &&=': {
    fixture: { src: { [BAD]: 'el.outerHTML &&= s;' } },
    named: 'outerHTML',
  },
  'R2 innerHTML ??=': {
    fixture: { src: { [BAD]: 'el.innerHTML ??= s;' } },
    named: 'innerHTML',
  },
  'R3 innerHTML across a line break': {
    fixture: { src: { [BAD]: 'el.innerHTML\n  = s;' } },
    named: 'innerHTML',
  },
  "R4 el['innerHTML'] =": {
    fixture: { src: { [BAD]: "el['innerHTML'] = s;" } },
    named: 'innerHTML',
  },
  'R4 el["outerHTML"] +=': {
    fixture: { src: { [BAD]: 'el["outerHTML"] += s;' } },
    named: 'outerHTML',
  },
  'R4 el[`innerHTML`] =': {
    fixture: { src: { [BAD]: 'el[`innerHTML`] = s;' } },
    named: 'innerHTML',
  },
  'R6 setHTMLUnsafe': {
    fixture: { src: { [BAD]: 'el.setHTMLUnsafe(s);' } },
    named: 'setHTMLUnsafe',
  },
  'R6 Document.parseHTMLUnsafe': {
    fixture: { src: { [BAD]: 'const doc = Document.parseHTMLUnsafe(s);' } },
    named: 'parseHTMLUnsafe',
  },
  'R6 createContextualFragment': {
    fixture: { src: { [BAD]: 'const f = range.createContextualFragment(s);' } },
    named: 'createContextualFragment',
  },
  'R7 frame.srcdoc =': {
    fixture: { src: { [BAD]: 'frame.srcdoc = s;' } },
    named: 'srcdoc',
  },
  "R7 frame['srcdoc'] =": {
    fixture: { src: { [BAD]: "frame['srcdoc'] = s;" } },
    named: 'srcdoc',
  },
  'R7 React srcDoc prop': {
    fixture: { src: { [BAD]: 'export const F = ({ s }) => <iframe srcDoc={s} />;\n' } },
    named: 'srcDoc',
  },
  // "Review decisions", round 1: reachable vectors the guard missed.
  'R7 lowercase JSX srcdoc attribute': {
    fixture: { src: { [BAD]: 'export const F = ({ s }) => <iframe srcdoc={s} />;\n' } },
    named: 'srcdoc',
  },
  "R7 setAttribute('srcdoc', s)": {
    fixture: { src: { [BAD]: "frame.setAttribute('srcdoc', s);" } },
    named: 'srcdoc',
  },
  'R7 setAttribute("srcdoc", s)': {
    fixture: { src: { [BAD]: 'frame.setAttribute("srcdoc", s);' } },
    named: 'srcdoc',
  },
  'R5 contentDocument.write': {
    fixture: { src: { [BAD]: 'frame.contentDocument.write(s);' } },
    named: 'document.write',
  },
  'R5 ownerDocument.write': {
    fixture: { src: { [BAD]: 'el.ownerDocument.write(s);' } },
    named: 'document.write',
  },
  'R5 _document.write': {
    fixture: { src: { [BAD]: '_document.write(s);' } },
    named: 'document.write',
  },
  // "Review decisions", round 2: optional-chained and line-broken writes.
  'R8 contentDocument?.write': {
    fixture: { src: { [BAD]: 'iframe.contentDocument?.write(html);' } },
    named: 'document.write',
  },
  'R8 contentDocument?.writeln': {
    fixture: { src: { [BAD]: 'frame.contentDocument?.writeln(html);' } },
    named: 'document.write',
  },
  'R8 document\\n  .write': {
    fixture: { src: { [BAD]: 'document\n  .write(s);' } },
    named: 'document.write',
  },
  // "Review decisions", round 3: TypeScript non-null assertions, casts and
  // parenthesized receivers before `.write`.
  'R9 contentDocument!.write': {
    fixture: { src: { 'components/Bad.ts': 'iframe.contentDocument!.write(html);' } },
    named: 'document.write',
  },
  'R9 (contentDocument as Document).write': {
    fixture: {
      src: { 'components/Bad.ts': '(iframe.contentDocument as Document).write(html);' },
    },
    named: 'document.write',
  },
  'R9 (document).write': {
    fixture: { src: { [BAD]: '(document).write(s);' } },
    named: 'document.write',
  },
  'R9 contentDocument!.writeln': {
    fixture: { src: { [BAD]: 'iframe.contentDocument!.writeln(html);' } },
    named: 'document.write',
  },
  // docs/specs/raw-html-ast.md, criterion 6 and "Unwrapping": a parenthesized
  // optional chain as the receiver or assignment target.
  'R10 (iframe?.contentDocument).write': {
    fixture: { src: { [BAD]: '(iframe?.contentDocument).write(html);' } },
    named: 'document.write',
  },
  'R10 (frame?.contentWindow?.document).writeln': {
    fixture: { src: { [BAD]: '(frame?.contentWindow?.document).writeln(html);' } },
    named: 'document.write',
  },
  'R10 (el?.firstElementChild).innerHTML =': {
    fixture: { src: { [BAD]: '(el?.firstElementChild).innerHTML = s;' } },
    named: 'innerHTML',
  },
};

// docs/specs/raw-html-sink-variants.md "Must pass": near-misses that must exit 0.
const NEAR_MISSES = {
  'P1 read into a const': 'const x = el.innerHTML;',
  'P1 returned read': 'export const f = (el) => { return el.outerHTML; };',
  "P2 innerHTML === ''": "if (el.innerHTML === '') f();",
  'P2 innerHTML == y': 'if (el.innerHTML == y) f();',
  'P2 innerHTML !== y': 'if (el.innerHTML !== y) f();',
  'P2 srcdoc === s': 'if (el.srcdoc === s) f();',
  'P3 innerHTMLCache =': 'el.innerHTMLCache = s;',
  'P3 srcdocs =': 'obj.srcdocs = s;',
  'P4 textContent =': 'el.textContent = s;',
  'P4 innerText =': 'el.innerText = s;',
  'P5 the word in a string': "const name = 'innerHTML';",
  'P5 the word in a comment': '// avoid innerHTML\nexport {};',
  // "Review decisions", round 1: the fixes above must not overreach.
  "P6 setAttribute('title', s)": "el.setAttribute('title', s);",
  "P6 getAttribute('srcdoc')": "const x = el.getAttribute('srcdoc');",
  'P6 doc.writeFile(s)': 'doc.writeFile(s);',
  'P6 documentation.write(s)': 'documentation.write(s);',
  // "Review decisions", round 2.
  'P7 doc?.writeFile(s)': 'doc?.writeFile(s);',
  'P7 stream.write(s)': 'stream.write(s);',
  // "Review decisions", round 3: a cast to a type that isn't Document.
  'P8 (stream as Writable).write(s)': '(stream as Writable).write(s);',
  'P8 (doc as Docs).write(s)': '(doc as Docs).write(s);',
  // docs/specs/raw-html-ast.md "Review decisions", round 1.
  'P9 dangerouslySetInnerHTML in a comment only':
    '// dangerouslySetInnerHTML is banned here\nexport {};',
  'P9 stream.write.call(stream, s)': 'stream.write.call(stream, s);',
  'P9 doc.write.bind(doc)': 'doc.write.bind(doc);',
  "P9 const name = 'innerHTMLx'": "const name = 'innerHTMLx';",
  // docs/specs/raw-html-ast.md "Review decisions", round 2: destructuring a
  // method that isn't a sink, or from a receiver that isn't a document.
  'P10 const { write } = stream': 'const { write } = stream;',
  'P10 const { write: w } = fs': 'const { write: w } = fs;',
  'P10 const { innerText } = el': 'const { innerText } = el;',
  'P10 const { insertAdjacentText } = el': 'const { insertAdjacentText } = el;',
  // docs/specs/raw-html-ast.md "Review decisions", round 3: nested
  // destructuring under a parent key that isn't document-like, or of a
  // property that isn't a sink.
  'P11 const { stream: { write } } = x': 'const { stream: { write } } = x;',
  'P11 const { a: { innerText } } = el': 'const { a: { innerText } } = el;',
};

// docs/specs/raw-html-ast.md, criterion 2: forms the regex version missed,
// each of which must exit 1 naming the sink.
const NEWLY_CAUGHT = {
  'a comment between innerHTML and =': {
    fixture: { src: { [BAD]: 'el.innerHTML /* c */ = s;' } },
    named: 'innerHTML',
  },
  '[el.innerHTML] = [s]': {
    fixture: { src: { [BAD]: '[el.innerHTML] = [s];' } },
    named: 'innerHTML',
  },
  '({ h: el.outerHTML } = o)': {
    fixture: { src: { [BAD]: '({ h: el.outerHTML } = o);' } },
    named: 'outerHTML',
  },
  "document['write'](s)": {
    fixture: { src: { [BAD]: "document['write'](s);" } },
    named: 'document.write',
  },
  '(<Document>x).write(s) in a .ts file': {
    fixture: { src: { 'components/Bad.ts': '(<Document>x).write(s);' } },
    named: 'document.write',
  },
  'iframeDocument!!.write(s)': {
    fixture: { src: { 'components/Bad.ts': 'iframeDocument!!.write(s);' } },
    named: 'document.write',
  },
  "setAttributeNS(null, 'srcdoc', s)": {
    fixture: { src: { [BAD]: "frame.setAttributeNS(null, 'srcdoc', s);" } },
    named: 'srcdoc',
  },
  '<iframe {...{ srcDoc: s }} />': {
    fixture: {
      src: { [BAD]: 'export const F = ({ s }) => <iframe {...{ srcDoc: s }} />;\n' },
    },
    named: 'srcDoc',
  },
};

// docs/specs/raw-html-ast.md "Review decisions", round 1: name references to
// dangerouslySetInnerHTML, a comma-expression receiver, and references to a
// sink method that aren't a direct call. Each must exit 1 naming the sink.
const AST_ROUND_1 = {
  "p['dangerouslySetInnerHTML'] = ... spread into JSX": {
    fixture: {
      src: {
        [BAD]:
          "const p = {}; p['dangerouslySetInnerHTML'] = { __html: s }; export const C = () => <div {...p} />;\n",
      },
    },
    named: 'dangerouslySetInnerHTML',
  },
  'props.dangerouslySetInnerHTML = x': {
    fixture: { src: { [BAD]: 'props.dangerouslySetInnerHTML = x;' } },
    named: 'dangerouslySetInnerHTML',
  },
  "const k = 'dangerouslySetInnerHTML'": {
    fixture: { src: { [BAD]: "const k = 'dangerouslySetInnerHTML';" } },
    named: 'dangerouslySetInnerHTML',
  },
  'const k = `dangerouslySetInnerHTML`': {
    fixture: { src: { [BAD]: 'const k = `dangerouslySetInnerHTML`;' } },
    named: 'dangerouslySetInnerHTML',
  },
  '(0, document).write(s)': {
    fixture: { src: { [BAD]: '(0, document).write(s);' } },
    named: 'document.write',
  },
  'document.write`<b>${s}</b>`': {
    fixture: { src: { [BAD]: 'document.write`<b>${s}</b>`;' } },
    named: 'document.write',
  },
  'document.write.call(document, s)': {
    fixture: { src: { [BAD]: 'document.write.call(document, s);' } },
    named: 'document.write',
  },
  "el.insertAdjacentHTML.call(el, 'beforeend', s)": {
    fixture: { src: { [BAD]: "el.insertAdjacentHTML.call(el, 'beforeend', s);" } },
    named: 'insertAdjacentHTML',
  },
  "el.insertAdjacentHTML.apply(el, ['beforeend', s])": {
    fixture: { src: { [BAD]: "el.insertAdjacentHTML.apply(el, ['beforeend', s]);" } },
    named: 'insertAdjacentHTML',
  },
  'const f = el.insertAdjacentHTML': {
    fixture: { src: { [BAD]: 'const f = el.insertAdjacentHTML;' } },
    named: 'insertAdjacentHTML',
  },
};

// docs/specs/raw-html-ast.md "Review decisions", round 2: a sink method pulled
// off its receiver by destructuring. Each must exit 1 naming the sink.
const AST_ROUND_2 = {
  'const { write } = document; write(s)': {
    fixture: { src: { [BAD]: 'const { write } = document; write(s);' } },
    named: 'document.write',
  },
  'const { writeln: w } = iframe.contentDocument; w(s)': {
    fixture: { src: { [BAD]: 'const { writeln: w } = iframe.contentDocument; w(s);' } },
    named: 'document.write',
  },
  "const { insertAdjacentHTML: f } = el; f('beforeend', s)": {
    fixture: {
      src: { [BAD]: "const { insertAdjacentHTML: f } = el; f('beforeend', s);" },
    },
    named: 'insertAdjacentHTML',
  },
  'const { setHTMLUnsafe } = el': {
    fixture: { src: { [BAD]: 'const { setHTMLUnsafe } = el;' } },
    named: 'setHTMLUnsafe',
  },
};

// docs/specs/raw-html-ast.md "Review decisions", round 3: a sink method pulled
// out by nested destructuring. Each must exit 1 naming the sink.
const AST_ROUND_3 = {
  'const { contentDocument: { write } } = iframe': {
    fixture: { src: { [BAD]: 'const { contentDocument: { write } } = iframe;' } },
    named: 'document.write',
  },
  'const { document: { writeln } } = window': {
    fixture: { src: { [BAD]: 'const { document: { writeln } } = window;' } },
    named: 'document.write',
  },
  'const { a: { insertAdjacentHTML } } = x': {
    fixture: { src: { [BAD]: 'const { a: { insertAdjacentHTML } } = x;' } },
    named: 'insertAdjacentHTML',
  },
  'const { a: { b: { setHTMLUnsafe } } } = x': {
    fixture: { src: { [BAD]: 'const { a: { b: { setHTMLUnsafe } } } = x;' } },
    named: 'setHTMLUnsafe',
  },
};

// docs/specs/raw-html-ast.md, criterion 3: forms the regex version wrongly
// flagged, each of which must exit 0.
const NO_LONGER_FLAGGED = {
  'const srcDoc = x': 'const srcDoc = x;',
  "function f(srcDoc = '') {}": "function f(srcDoc = '') {}",
  "const { srcDoc = '' } = p": "const { srcDoc = '' } = p;",
  'a sink in a line comment': '// el.innerHTML = s\nexport {};',
  'a sink in a string': "const t = 'el.innerHTML = s';",
  'a sink in a template literal': 'const t = `document.write(s)`;',
  'a srcDoc type member': 'type P = { srcDoc?: string };',
};

// The allowed CodeBlock usage and the tooling-gaps plant, so the parse
// assertion covers them too.
const CODEBLOCK_FIXTURE = {
  src: {
    'components/CodeBlock.tsx':
      'export const C = ({ __html }) => <pre dangerouslySetInnerHTML={{ __html }} />;\n',
  },
};
const MJS_FIXTURE = {
  src: { 'x.mjs': 'export const f = (el, s) => { el.innerHTML = s; };\n' },
};

/** Every planted source file in every table, as [label, filename, source]. */
function plantedSources() {
  const fixtures = [
    ...Object.entries(SPAN_TABLE)
      .filter(([, sink]) => sink)
      .map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(SCRIPT_ONLY_SINKS).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(SINK_VARIANTS).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(NEWLY_CAUGHT).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(AST_ROUND_1).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(AST_ROUND_2).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(AST_ROUND_3).map(([label, { fixture }]) => [label, fixture]),
    ...Object.entries(NEAR_MISSES).map(([label, source]) => [
      label,
      { src: { [BAD]: source } },
    ]),
    ...Object.entries(NO_LONGER_FLAGGED).map(([label, source]) => [
      label,
      { src: { [BAD]: source } },
    ]),
    ['CodeBlock', CODEBLOCK_FIXTURE],
    ['tooling-gaps x.mjs', MJS_FIXTURE],
  ];
  return fixtures.flatMap(([label, fixture]) =>
    Object.entries(fixture.src ?? {}).map(([path, source]) => [
      label,
      `src/${path}`,
      source,
    ]),
  );
}

/** Fails unless `spans` and SPAN_TABLE's keys are the same set, naming the
 * unclassified spans and the stale table entries. */
export function expectSpansClassified(spans) {
  const keys = new Set(Object.keys(SPAN_TABLE));
  const unclassified = [...spans].filter((span) => !keys.has(span));
  const stale = [...keys].filter((key) => !spans.has(key));
  expect(
    { unclassified, stale },
    'every span in NON_NEGOTIABLES #6 is classified in SPAN_TABLE, and every entry is still in #6',
  ).toEqual({ unclassified: [], stale: [] });
}

describe('check-raw-html', () => {
  function check(files) {
    const root = tempDir();
    gitInit(root);
    mkdirSync(join(root, 'src/components'), { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify(files.pkg ?? { dependencies: {} }),
    );
    for (const [path, content] of Object.entries(files.src ?? {})) {
      writeFileSync(join(root, 'src', path), content);
    }
    return run('check-raw-html.mjs', [], { CHECK_RAW_HTML_ROOT: root });
  }
  const repo = (files) => check(files).status;

  it('passes clean code and the allowed CodeBlock usage', () => {
    expect(repo(CODEBLOCK_FIXTURE)).toBe(0);
  });

  // docs/specs/raw-html-ast.md, criterion 1: every fixture is a valid program
  // for the language its planted filename selects.
  it.each(plantedSources())('the %s fixture (%s) parses', (_label, filename, source) => {
    const { errors } = parseSync(filename, source);
    expect(
      errors.map((error) => error.message),
      source,
    ).toEqual([]);
  });

  // docs/specs/raw-html-sink-coverage.md: the test follows #6's own text.
  it('classifies every inline-code span in NON_NEGOTIABLES #6', () => {
    expectSpansClassified(itemSpans(6));
  });

  const sinks = [
    ...Object.entries(SPAN_TABLE).filter(([, sink]) => sink),
    ...Object.entries(SCRIPT_ONLY_SINKS),
  ];
  it.each(sinks)('fails on %s, naming it on stderr', (_sink, { fixture, named }) => {
    const result = check(fixture);
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr.split('\n').some((line) => line.includes(named))).toBe(true);
  });

  // docs/specs/raw-html-sink-variants.md, criterion 1.
  it.each(Object.entries(SINK_VARIANTS))(
    'fails on the %s form, naming the sink on stderr',
    (_form, { fixture, named }) => {
      const result = check(fixture);
      expect(result.status, result.stderr).toBe(1);
      expect(
        result.stderr
          .split('\n')
          .some((line) => line.toLowerCase().includes(named.toLowerCase())),
        result.stderr,
      ).toBe(true);
    },
  );

  // docs/specs/raw-html-sink-variants.md, criterion 2.
  it.each(Object.entries(NEAR_MISSES))('passes the %s near-miss', (_form, source) => {
    const result = check({ src: { [BAD]: source } });
    expect(result.status, result.stderr).toBe(0);
  });

  // docs/specs/tooling-gaps.md, criterion 3: src/lib/markdown.mjs ships to the
  // browser, so `.mjs` under src/ is app code too.
  it('fails on an innerHTML write in a planted src/x.mjs (tooling-gaps criterion 3)', () => {
    expect(repo(MJS_FIXTURE)).toBe(1);
  });

  // docs/specs/raw-html-ast.md, criterion 2.
  it.each(Object.entries(NEWLY_CAUGHT))(
    'fails on %s, naming the sink on stderr (raw-html-ast criterion 2)',
    (_form, { fixture, named }) => {
      const result = check(fixture);
      expect(result.status, result.stderr).toBe(1);
      expect(
        result.stderr
          .split('\n')
          .some((line) => line.toLowerCase().includes(named.toLowerCase())),
        result.stderr,
      ).toBe(true);
    },
  );

  // docs/specs/raw-html-ast.md "Review decisions", round 1.
  it.each(Object.entries(AST_ROUND_1))(
    'fails on %s, naming the sink on stderr (raw-html-ast review round 1)',
    (_form, { fixture, named }) => {
      const result = check(fixture);
      expect(result.status, result.stderr).toBe(1);
      expect(
        result.stderr
          .split('\n')
          .some((line) => line.toLowerCase().includes(named.toLowerCase())),
        result.stderr,
      ).toBe(true);
    },
  );

  // docs/specs/raw-html-ast.md "Review decisions", round 2.
  it.each(Object.entries(AST_ROUND_2))(
    'fails on %s, naming the sink on stderr (raw-html-ast review round 2)',
    (_form, { fixture, named }) => {
      const result = check(fixture);
      expect(result.status, result.stderr).toBe(1);
      expect(
        result.stderr
          .split('\n')
          .some((line) => line.toLowerCase().includes(named.toLowerCase())),
        result.stderr,
      ).toBe(true);
    },
  );

  // docs/specs/raw-html-ast.md "Review decisions", round 3.
  it.each(Object.entries(AST_ROUND_3))(
    'fails on %s, naming the sink on stderr (raw-html-ast review round 3)',
    (_form, { fixture, named }) => {
      const result = check(fixture);
      expect(result.status, result.stderr).toBe(1);
      expect(
        result.stderr
          .split('\n')
          .some((line) => line.toLowerCase().includes(named.toLowerCase())),
        result.stderr,
      ).toBe(true);
    },
  );

  // docs/specs/raw-html-ast.md, criterion 3.
  it.each(Object.entries(NO_LONGER_FLAGGED))(
    'passes %s (raw-html-ast criterion 3)',
    (_form, source) => {
      const result = check({ src: { [BAD]: source } });
      expect(result.status, result.stderr).toBe(0);
    },
  );

  // docs/specs/raw-html-ast.md, criterion 4: unparseable code could hide a sink.
  it('fails on a file that does not parse, naming it (raw-html-ast criterion 4)', () => {
    const result = check({ src: { 'components/Broken.tsx': 'const = ;\n' } });
    expect(result.status, result.stderr).toBe(1);
    expect(
      result.stderr
        .split('\n')
        .some(
          (line) =>
            line.includes('src/components/Broken.tsx') &&
            line.includes('could not be parsed'),
        ),
      result.stderr,
    ).toBe(true);
  });

  it('passes the real repository', () => {
    const result = run('check-raw-html.mjs');
    expect(result.status, result.stderr).toBe(0);
  });
});
