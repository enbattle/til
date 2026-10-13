import type { Code, Nodes } from 'mdast';
import { describe, expect, it } from 'vitest';
import { parseRegions, resolveCodeRegions } from './code-regions.mjs';
import { markdownParser } from './markdown.mjs';

// docs/specs/dsa-code-regions.md, criteria 1-3. A DSA code file marks named
// regions (`# region <name>` … `# endregion` in Python, `// #region <name>` …
// `// #endregion` in TypeScript); an entry names a region with an empty
// ` ```python region=<name> ` fence, and `resolveCodeRegions` fills it in.
// Fixtures are in memory; the real entries are checked in
// src/dsa/dsa-code-chunks.test.ts.

const lines = (...rows: string[]) => rows.join('\n');

/** Just each region's name and text, whatever else `parseRegions` returns. */
function namesAndTexts(source: string, language: 'python' | 'typescript') {
  return parseRegions(source, language).map(({ name, text }) => ({ name, text }));
}

/** The thrown message of `run`, or a failure when it doesn't throw. */
function thrown(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error('expected a throw, but nothing was thrown');
}

const PY = lines(
  '# region imports', //            1
  'import math', //                 2
  '', //                            3
  'TAU = 2 * math.pi', //           4
  '# endregion', //                 5
  '', //                            6
  '', //                            7
  '# region area', //               8
  '    ', //                        9
  'def area(r: float) -> float:', // 10
  '    return math.pi * r * r', //  11
  '', //                            12
  '# endregion', //                 13
  '', //                            14
  '', //                            15
  '# region shape-class', //        16
  'class Shape:', //                17
  '    """A shape with n sides."""', // 18
  '# endregion', //                 19
  '', //                            20
  '    # region shape-init', //     21
  '    def __init__(self, n: int) -> None:', // 22
  '        self.n = n', //          23
  '    # endregion', //             24
  '',
);

const PY_TEXT = {
  imports: 'import math\n\nTAU = 2 * math.pi',
  area: 'def area(r: float) -> float:\n    return math.pi * r * r',
  'shape-class': 'class Shape:\n    """A shape with n sides."""',
  'shape-init': '    def __init__(self, n: int) -> None:\n        self.n = n',
};

const TS = lines(
  '// #region area',
  'export function area(r: number): number {',
  '  return Math.PI * r * r;',
  '}',
  '// #endregion',
  '',
  '// #region shape-class',
  'export class Shape {',
  '// #endregion',
  '  // #region shape-init',
  '  constructor(readonly n: number) {}',
  '  // #endregion',
  '// #region shape-end',
  '}',
  '// #endregion',
  '',
);

const TS_TEXT = {
  area: 'export function area(r: number): number {\n  return Math.PI * r * r;\n}',
  'shape-class': 'export class Shape {',
  'shape-init': '  constructor(readonly n: number) {}',
  'shape-end': '}',
};

describe('parseRegions (criterion 1)', () => {
  it('returns each Python region, in file order, with indented markers inside a class', () => {
    expect(namesAndTexts(PY, 'python')).toEqual(
      Object.entries(PY_TEXT).map(([name, text]) => ({ name, text })),
    );
  });

  it('returns each TypeScript region, in file order, with indented markers inside a class', () => {
    expect(namesAndTexts(TS, 'typescript')).toEqual(
      Object.entries(TS_TEXT).map(([name, text]) => ({ name, text })),
    );
  });

  it('leaves the markers out and trims outer blank lines, keeping inner ones', () => {
    const [imports, area] = namesAndTexts(PY, 'python');
    expect(imports.text).not.toMatch(/region/);
    expect(imports.text).toContain('\n\n');
    expect(area.text.startsWith('def area')).toBe(true);
    expect(area.text.endsWith('* r * r')).toBe(true);
  });

  it('accepts kebab-case names with digits', () => {
    const source = lines('# region part-2', 'x = 1', '# endregion', '');
    expect(namesAndTexts(source, 'python')).toEqual([{ name: 'part-2', text: 'x = 1' }]);
  });

  it('returns no regions for a file with none', () => {
    expect(parseRegions('', 'python')).toEqual([]);
  });

  describe.each([
    [
      'python',
      {
        open: (name: string) => `# region ${name}`,
        close: '# endregion',
        code: 'x = 1',
      },
    ],
    [
      'typescript',
      {
        open: (name: string) => `// #region ${name}`,
        close: '// #endregion',
        code: 'const x = 1;',
      },
    ],
  ] as const)('%s errors name the line', (language, { open, close, code }) => {
    it('a nested region', () => {
      const source = lines(open('outer'), code, open('inner'), code, close, close);
      const message = thrown(() => parseRegions(source, language));
      expect(message).toMatch(/\bline 3\b/);
      expect(message).toMatch(/nest/i);
    });

    it('an unclosed region', () => {
      const source = lines(open('first'), code, close, '', open('second'), code, '');
      const message = thrown(() => parseRegions(source, language));
      expect(message).toContain('second');
      expect(message).toMatch(/\bline 5\b/);
    });

    it('an endregion with no open region', () => {
      const source = lines(open('first'), code, close, close);
      expect(thrown(() => parseRegions(source, language))).toMatch(/\bline 4\b/);
    });

    it('a duplicate name', () => {
      const source = lines(open('same'), code, close, open('same'), code, close);
      const message = thrown(() => parseRegions(source, language));
      expect(message).toContain('same');
      expect(message).toMatch(/\bline 4\b/);
    });

    it.each(['Area', 'area_of', 'two words', '-lead', 'trail-'])(
      'a bad name %j',
      (name) => {
        const source = lines(open('ok'), code, close, open(name), code, close);
        expect(thrown(() => parseRegions(source, language))).toMatch(/\bline 4\b/);
      },
    );

    it('a region marker with no name', () => {
      const source = lines(open('').trimEnd(), code, close);
      expect(thrown(() => parseRegions(source, language))).toMatch(/\bline 1\b/);
    });
  });
});

/** A ` ```lang region=name ` fence with an empty body. */
const ref = (language: string, name: string) =>
  `\`\`\`${language} region=${name}\n\`\`\``;
/** A plain fence holding `text`. */
const plain = (language: string, text: string) => `\`\`\`${language}\n${text}\n\`\`\``;

const ENTRY = [
  '---',
  'title: Shapes',
  'kind: algorithm',
  '---',
  '',
  'Intro with `inline code` and a [link](/dsa/hash-map).',
  '',
  '## The idea',
  '',
  plain('python', 'print(area(1.0))'),
  '',
  plain('text', '  o\n / \\\no   o'),
  '',
  '## Walkthrough',
  '',
  ref('python', 'imports'),
  '',
  ref('python', 'area'),
  '',
  ref('typescript', 'area'),
  '',
  'Prose   between,   spaced *oddly*.',
  '',
  ref('python', 'shape-class'),
  '',
  ref('typescript', 'shape-class'),
  '',
  '### A smaller step',
  '',
  ref('python', 'shape-init'),
  '',
  ref('typescript', 'shape-init'),
  '',
  ref('typescript', 'shape-end'),
  '',
  '## Complexity',
  '',
  plain('python', '# a literal example outside the code sections'),
  '',
  'O(1).',
  '',
].join('\n');

const FILES = { python: PY, typescript: TS, label: 'shapes' };

/** `ENTRY` with each region fence replaced by hand. */
function expectedEntry(): string {
  let out = ENTRY;
  for (const [name, text] of Object.entries(PY_TEXT))
    out = out.replace(ref('python', name), plain('python', text));
  for (const [name, text] of Object.entries(TS_TEXT))
    out = out.replace(ref('typescript', name), plain('typescript', text));
  return out;
}

describe('resolveCodeRegions (criterion 2)', () => {
  it('replaces each region fence with a plain fence holding its text', () => {
    expect(resolveCodeRegions(ENTRY, FILES)).toBe(expectedEntry());
  });

  it('leaves literal fences, prose and frontmatter byte for byte', () => {
    const resolved = resolveCodeRegions(ENTRY, FILES);
    expect(resolved.startsWith(ENTRY.slice(0, ENTRY.indexOf('## Walkthrough')))).toBe(
      true,
    );
    expect(resolved).toContain('Prose   between,   spaced *oddly*.');
    expect(resolved.endsWith(ENTRY.slice(ENTRY.indexOf('## Complexity')))).toBe(true);
    expect(resolved).not.toMatch(/region=/);
  });

  it('returns markdown with no region fences unchanged when there is no code', () => {
    const md = '## The idea\n\nJust prose.\n\n```text\nx\n```\n';
    expect(resolveCodeRegions(md, { label: 'plain' })).toBe(md);
  });

  it('reads an Implementation section the same way', () => {
    const md = [
      '## Implementation',
      '',
      ref('python', 'only'),
      '',
      ref('typescript', 'only'),
      '',
    ].join('\n');
    const files = {
      python: lines('# region only', 'x = 1', '# endregion', ''),
      typescript: lines('// #region only', 'const x = 1;', '// #endregion', ''),
      label: 'impl',
    };
    expect(resolveCodeRegions(md, files)).toBe(
      [
        '## Implementation',
        '',
        plain('python', 'x = 1'),
        '',
        plain('typescript', 'const x = 1;'),
        '',
      ].join('\n'),
    );
  });

  describe('errors name the entry and the region', () => {
    const swap = (from: string, to: string) => ENTRY.replace(from, to);

    it('an unknown region name', () => {
      const md = swap(ref('python', 'area'), ref('python', 'perimeter'));
      const message = thrown(() => resolveCodeRegions(md, FILES));
      expect(message).toContain('shapes');
      expect(message).toContain('perimeter');
    });

    it('a region that only the other language has', () => {
      const md = swap(
        ref('typescript', 'shape-end'),
        `${ref('typescript', 'shape-end')}\n\n${ref('typescript', 'imports')}`,
      );
      const message = thrown(() => resolveCodeRegions(md, FILES));
      expect(message).toContain('shapes');
      expect(message).toContain('imports');
    });

    it('a region used twice', () => {
      const md = swap(
        ref('python', 'shape-init'),
        `${ref('python', 'shape-init')}\n\n${ref('python', 'shape-init')}`,
      );
      const message = thrown(() => resolveCodeRegions(md, FILES));
      expect(message).toContain('shapes');
      expect(message).toContain('shape-init');
    });

    it('a region fence with a non-empty body', () => {
      const md = swap(ref('python', 'area'), '```python region=area\nstale copy\n```');
      const message = thrown(() => resolveCodeRegions(md, FILES));
      expect(message).toContain('shapes');
      expect(message).toContain('area');
    });

    it('a region fence for an entry with no code folder', () => {
      const md = '## Walkthrough\n\n' + ref('python', 'area') + '\n';
      const message = thrown(() => resolveCodeRegions(md, { label: 'orphan' }));
      expect(message).toContain('orphan');
      expect(message).toContain('area');
    });

    it.each(['Implementation', 'Walkthrough'])(
      'a literal python or typescript fence under %s',
      (section) => {
        for (const language of ['python', 'typescript']) {
          const md = ENTRY.replace(
            '## Complexity',
            `## ${section}\n\n${plain(language, 'copied = True')}\n\n## Complexity`,
          );
          expect(thrown(() => resolveCodeRegions(md, FILES))).toContain('shapes');
        }
      },
    );

    it('a malformed code file, naming the entry and the line', () => {
      const broken = PY.replace('# region shape-init', '# region Shape_Init');
      const message = thrown(() =>
        resolveCodeRegions(ENTRY, { ...FILES, python: broken }),
      );
      expect(message).toContain('shapes');
      expect(message).toMatch(/\bline 21\b/);
    });
  });
});

describe('coverage, per language (criterion 3)', () => {
  it('throws when a non-blank line lies outside every region', () => {
    const uncovered = PY.replace('# region area', 'stray = 1\n# region area');
    const message = thrown(() =>
      resolveCodeRegions(ENTRY, { ...FILES, python: uncovered }),
    );
    expect(message).toContain('shapes');
    expect(message).toMatch(/\bline 8\b/);
  });

  it('does not count blank lines between regions', () => {
    const spaced = PY.replace('# region area', '\n\n# region area');
    expect(resolveCodeRegions(ENTRY, { ...FILES, python: spaced })).toBe(expectedEntry());
  });

  it('throws when a region is never used', () => {
    const md = ENTRY.replace(`${ref('python', 'imports')}\n\n`, '');
    const message = thrown(() => resolveCodeRegions(md, FILES));
    expect(message).toContain('shapes');
    expect(message).toContain('imports');
  });

  it('throws when the entry names no region of a file at all', () => {
    const md = ENTRY.replace(/```typescript region=[a-z-]+\n```\n\n/g, '');
    const message = thrown(() => resolveCodeRegions(md, FILES));
    expect(message).toContain('shapes');
    expect(message).toContain('area');
  });

  it('throws when regions are used out of file order', () => {
    const md = ENTRY.replace(
      `${ref('python', 'imports')}\n\n${ref('python', 'area')}`,
      `${ref('python', 'area')}\n\n${ref('python', 'imports')}`,
    );
    const message = thrown(() => resolveCodeRegions(md, FILES));
    expect(message).toContain('shapes');
    expect(message).toMatch(/imports|area/);
  });

  it('checks each language on its own order', () => {
    // All TypeScript fences before all Python ones is fine: each file's order
    // is checked on its own.
    const md = [
      '## Walkthrough',
      ...Object.keys(TS_TEXT).map((name) => ref('typescript', name)),
      ...Object.keys(PY_TEXT).map((name) => ref('python', name)),
      '',
    ].join('\n\n');
    const expected = [
      '## Walkthrough',
      ...Object.values(TS_TEXT).map((text) => plain('typescript', text)),
      ...Object.values(PY_TEXT).map((text) => plain('python', text)),
      '',
    ].join('\n\n');
    expect(resolveCodeRegions(md, FILES)).toBe(expected);
    const swapped = ENTRY.replace(
      `${ref('typescript', 'shape-init')}\n\n${ref('typescript', 'shape-end')}`,
      `${ref('typescript', 'shape-end')}\n\n${ref('typescript', 'shape-init')}`,
    );
    const message = thrown(() => resolveCodeRegions(swapped, FILES));
    expect(message).toContain('shapes');
    expect(message).toMatch(/shape-end|shape-init/);
  });
});

describe('every marker form VS Code folds (review finding 2a)', () => {
  it.each([
    ['#region name / #endregion', '#region area', '#endregion'],
    ['# region name / #endregion', '# region area', '#endregion'],
    ['#region name / # endregion', '#region area', '# endregion'],
    ['extra spaces after #', '#   region area', '#   endregion'],
    ['indented, no space', '    #region area', '    #endregion'],
  ])('Python: %s', (_form, open, close) => {
    const source = lines(open, 'def area(r):', '    return r * r', close, '');
    expect(namesAndTexts(source, 'python')).toEqual([
      { name: 'area', text: 'def area(r):\n    return r * r' },
    ]);
  });

  it.each([
    ['//#region name / //#endregion', '//#region area', '//#endregion'],
    ['// region name / // endregion', '// region area', '// endregion'],
    ['//region name / //endregion', '//region area', '//endregion'],
    ['// #region name / //#endregion', '// #region area', '//#endregion'],
    ['indented //#region', '  //#region area', '  //#endregion'],
  ])('TypeScript: %s', (_form, open, close) => {
    const source = lines(open, 'const area = (r: number) => r * r;', close, '');
    expect(namesAndTexts(source, 'typescript')).toEqual([
      { name: 'area', text: 'const area = (r: number) => r * r;' },
    ]);
  });

  it.each([
    ['python', '# region outer', 'x = 1', '#region inner', '# endregion'],
    ['python', '#region outer', 'x = 1', '#  region inner', '#endregion'],
    [
      'typescript',
      '// #region outer',
      'const x = 1;',
      '//#region inner',
      '// #endregion',
    ],
    [
      'typescript',
      '// #region outer',
      'const x = 1;',
      '// region inner',
      '// #endregion',
    ],
  ] as const)(
    '%s: a variant opening marker inside a region is a nested region, not code (%s … %s … %s)',
    (language, outer, code, inner, close) => {
      const source = lines(outer, code, inner, code, close, close, '');
      const message = thrown(() => parseRegions(source, language));
      expect(message).toMatch(/\bline 3\b/);
      expect(message).toMatch(/nest/i);
    },
  );

  it('a variant endregion closes the region instead of becoming its text', () => {
    // Before, `#endregion` was code, so the region ran on and never closed.
    const py = lines(
      '# region a',
      'x = 1',
      '#endregion',
      '# region b',
      'y = 2',
      '# endregion',
      '',
    );
    expect(namesAndTexts(py, 'python')).toEqual([
      { name: 'a', text: 'x = 1' },
      { name: 'b', text: 'y = 2' },
    ]);
    const ts = lines(
      '// #region a',
      'const x = 1;',
      '//#endregion',
      '// #region b',
      'const y = 2;',
      '// #endregion',
      '',
    );
    expect(namesAndTexts(ts, 'typescript')).toEqual([
      { name: 'a', text: 'const x = 1;' },
      { name: 'b', text: 'const y = 2;' },
    ]);
  });

  it('resolves an entry whose code files use variant markers', () => {
    const md = [
      '## Walkthrough',
      '',
      ref('python', 'only'),
      '',
      ref('typescript', 'only'),
      '',
    ].join('\n');
    const files = {
      python: lines('#region only', 'x = 1', '#endregion', ''),
      typescript: lines('//#region only', 'const x = 1;', '//#endregion', ''),
      label: 'variant',
    };
    expect(resolveCodeRegions(md, files)).toBe(
      [
        '## Walkthrough',
        '',
        plain('python', 'x = 1'),
        '',
        plain('typescript', 'const x = 1;'),
        '',
      ].join('\n'),
    );
  });

  // Unchanged rule: only a comment that starts its line with the marker word
  // is a marker.
  it('keeps a comment that only mentions region mid-line as code', () => {
    const py = lines(
      '# region area',
      '# the region of interest',
      'x = 1  # region',
      'y = 2  # endregion',
      '# regional settings',
      '# endregions',
      '# endregion',
      '',
    );
    expect(namesAndTexts(py, 'python')).toEqual([
      {
        name: 'area',
        text: [
          '# the region of interest',
          'x = 1  # region',
          'y = 2  # endregion',
          '# regional settings',
          '# endregions',
        ].join('\n'),
      },
    ]);
    const ts = lines(
      '// #region area',
      'const x = 1; // see #region below',
      'const y = 2; // #endregion',
      '// the region of interest',
      '//#regional',
      '// #endregion',
      '',
    );
    expect(namesAndTexts(ts, 'typescript')).toEqual([
      {
        name: 'area',
        text: [
          'const x = 1; // see #region below',
          'const y = 2; // #endregion',
          '// the region of interest',
          '//#regional',
        ].join('\n'),
      },
    ]);
  });

  // Unchanged rule: each language reads only its own comment syntax.
  it("does not read one language's markers in the other's file", () => {
    expect(
      parseRegions(lines('// #region a', 'x = 1', '// #endregion', ''), 'python'),
    ).toEqual([]);
    expect(
      parseRegions(lines('# region a', 'const x = 1;', '# endregion', ''), 'typescript'),
    ).toEqual([]);
  });
});

describe('an empty region (review finding 2b)', () => {
  describe.each([
    ['python', '# region', '# endregion', 'x = 1'],
    ['typescript', '// #region', '// #endregion', 'const x = 1;'],
  ] as const)('%s', (language, open, close, code) => {
    it('throws, naming the region and its line, when the markers are back to back', () => {
      const source = lines(`${open} first`, code, close, '', `${open} hollow`, close, '');
      const message = thrown(() => parseRegions(source, language));
      expect(message).toContain('hollow');
      expect(message).toMatch(/\bline 5\b/);
    });

    it('throws, naming the region and its line, when only blank lines sit between them', () => {
      const source = lines(
        `${open} first`,
        code,
        close,
        `${open} hollow`,
        '',
        '   ',
        '\t',
        close,
        '',
      );
      const message = thrown(() => parseRegions(source, language));
      expect(message).toContain('hollow');
      expect(message).toMatch(/\bline 4\b/);
    });
  });

  it('fails resolution naming the entry and the region', () => {
    const md = ['## Walkthrough', '', ref('python', 'hollow'), ''].join('\n');
    const message = thrown(() =>
      resolveCodeRegions(md, {
        python: lines('# region hollow', '', '# endregion', ''),
        label: 'empty-entry',
      }),
    );
    expect(message).toContain('empty-entry');
    expect(message).toContain('hollow');
  });
});

/** Every code node in `markdown`, as the site's parser reads it. */
function codeNodes(markdown: string): Code[] {
  const found: Code[] = [];
  const walk = (node: Nodes) => {
    if (node.type === 'code') found.push(node);
    if ('children' in node) node.children.forEach(walk);
  };
  walk(markdownParser().parse(markdown));
  return found;
}

describe('a region holding a backtick run (review finding 2c)', () => {
  const PY_TICKS = lines(
    '# region doc',
    'def doc() -> str:',
    '    return """',
    '```',
    'not a fence',
    '````',
    '"""',
    '# endregion',
    '',
  );
  const PY_TICKS_TEXT = lines(
    'def doc() -> str:',
    '    return """',
    '```',
    'not a fence',
    '````',
    '"""',
  );
  const TS_TICKS = lines(
    '// #region doc',
    'export const doc = `',
    '```',
    'not a fence',
    '```',
    '`;',
    '// #endregion',
    '',
  );
  const TS_TICKS_TEXT = lines('export const doc = `', '```', 'not a fence', '```', '`;');
  const MD = [
    '## Walkthrough',
    '',
    ref('python', 'doc'),
    '',
    ref('typescript', 'doc'),
    '',
    'Prose after.',
    '',
  ].join('\n');
  const FILES_TICKS = { python: PY_TICKS, typescript: TS_TICKS, label: 'ticks' };

  it('parses the region text with the backtick lines in it (unchanged)', () => {
    expect(namesAndTexts(PY_TICKS, 'python')).toEqual([
      { name: 'doc', text: PY_TICKS_TEXT },
    ]);
    expect(namesAndTexts(TS_TICKS, 'typescript')).toEqual([
      { name: 'doc', text: TS_TICKS_TEXT },
    ]);
  });

  it('fences the code with more backticks than the longest run in it', () => {
    const resolved = resolveCodeRegions(MD, FILES_TICKS);
    const python = /^(`+)python$/m.exec(resolved);
    const typescript = /^(`+)typescript$/m.exec(resolved);
    expect(python?.[1].length).toBeGreaterThan(4);
    expect(typescript?.[1].length).toBeGreaterThan(3);
  });

  it('yields one code node per region, holding exactly the region text', () => {
    const nodes = codeNodes(resolveCodeRegions(MD, FILES_TICKS));
    expect(nodes.map(({ lang, value }) => ({ lang, value }))).toEqual([
      { lang: 'python', value: PY_TICKS_TEXT },
      { lang: 'typescript', value: TS_TICKS_TEXT },
    ]);
  });

  it('keeps the prose after the code as prose', () => {
    const resolved = resolveCodeRegions(MD, FILES_TICKS);
    expect(resolved.endsWith('\n\nProse after.\n')).toBe(true);
    expect(codeNodes(resolved).some(({ value }) => value.includes('Prose after'))).toBe(
      false,
    );
  });

  it('keeps a three-backtick fence for text with no long run (unchanged)', () => {
    const md = ['## Walkthrough', '', ref('python', 'only'), ''].join('\n');
    const files = {
      python: lines('# region only', 'x = "``"', '# endregion', ''),
      label: 'short',
    };
    expect(resolveCodeRegions(md, files)).toBe(
      ['## Walkthrough', '', plain('python', 'x = "``"'), ''].join('\n'),
    );
  });
});
