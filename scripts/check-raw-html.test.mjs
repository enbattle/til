// @vitest-environment node
// Planted-violation tests for scripts/check-raw-html.mjs (NON_NEGOTIABLES #6).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
    fixture: { src: { [BAD]: 'dangerouslySetInnerHTML={{}}' } },
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
    expect(
      repo({
        src: { 'components/CodeBlock.tsx': 'dangerouslySetInnerHTML={{ __html }}' },
      }),
    ).toBe(0);
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

  // docs/specs/tooling-gaps.md, criterion 3: src/lib/markdown.mjs ships to the
  // browser, so `.mjs` under src/ is app code too.
  it('fails on an innerHTML write in a planted src/x.mjs (tooling-gaps criterion 3)', () => {
    expect(
      repo({ src: { 'x.mjs': 'export const f = (el, s) => { el.innerHTML = s; };\n' } }),
    ).toBe(1);
  });

  it('passes the real repository', () => {
    const result = run('check-raw-html.mjs');
    expect(result.status, result.stderr).toBe(0);
  });
});
