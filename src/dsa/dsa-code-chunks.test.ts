import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { markdownParser } from '@/lib/markdown.mjs';
import { parseFrontmatter } from '@/lib/frontmatter';

/**
 * docs/specs/dsa-code-regions.md, criteria 3 and 5 (replacing
 * docs/specs/dsa-tab.md criterion 11's copy check). An entry's code lives once,
 * in the tested files beside it (`src/dsa/code/<slug>/<slug_underscored>.py`
 * and `<slug>.ts`), which mark named regions. Under `## Implementation` /
 * `## Walkthrough` the entry names regions with empty ` ```python region=<name> `
 * fences, and the build fills them in. This checks, per entry and language:
 *
 * - the entry file on disk (read with fs, not the resolved `?raw` import)
 *   holds region fences there and no literal python/typescript fence;
 * - every non-blank line of the code file sits inside a region;
 * - the resolved body (the `?raw` import) shows each region's text once, in
 *   file order, and so the whole file, marker lines aside, exactly once.
 *
 * Fences are read from the markdown tree (`markdownParser`), not a regex. The
 * region reading here is the test's own, kept independent of
 * `src/lib/code-regions.mjs`, so this file still runs (and its folder
 * allowlist still passes) when that module is broken.
 */

const ENTRIES = import.meta.glob('/src/dsa/entries/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CODE = import.meta.glob('/src/dsa/code/*/*.{py,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CHUNK_SECTIONS = ['Implementation', 'Walkthrough'];
const LANGUAGES = ['python', 'typescript'] as const;
type Language = (typeof LANGUAGES)[number];

interface MdNode {
  type: string;
  depth?: number;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  children?: MdNode[];
}

interface Fence {
  meta: string;
  value: string;
}

function textOf(node: MdNode): string {
  return node.value ?? (node.children ?? []).map(textOf).join('');
}

/** The `language` fences under the chunked sections, in order. */
function fences(markdown: string, language: Language): Fence[] {
  const root = markdownParser().parse(markdown) as MdNode;
  const found: Fence[] = [];
  let inChunkSection = false;
  const collect = (node: MdNode) => {
    if (node.type === 'code' && node.lang === language)
      found.push({ meta: node.meta ?? '', value: node.value ?? '' });
    node.children?.forEach(collect);
  };
  for (const node of root.children ?? []) {
    if (node.type === 'heading' && (node.depth ?? 0) <= 2) {
      inChunkSection = node.depth === 2 && CHUNK_SECTIONS.includes(textOf(node).trim());
    } else if (inChunkSection) {
      collect(node);
    }
  }
  return found;
}

// Every form VS Code folds (`#region`, `#  region`, `//#region`, `// region`,
// and the matching endregion), but only as a comment that starts its line and
// only the whole word: `x = 1  # region` and `# regional` stay code. An
// endregion may carry trailing text (`# endregion lower-bound`).
const MARKERS: Record<Language, { open: RegExp; close: RegExp }> = {
  python: {
    open: /^\s*#\s*region(?=\s|$)\s*(\S*)\s*$/,
    close: /^\s*#\s*endregion(?=\s|$)/,
  },
  typescript: {
    open: /^\s*\/\/\s*#?region(?=\s|$)\s*(\S*)\s*$/,
    close: /^\s*\/\/\s*#?endregion(?=\s|$)/,
  },
};

function isMarker(line: string, language: Language): boolean {
  const { open, close } = MARKERS[language];
  return open.test(line) || close.test(line);
}

/** Lines with blank ones (and, given a language, marker lines) dropped. */
function nonBlankLines(text: string, language?: Language): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '' && !(language && isMarker(line, language)));
}

interface Marked {
  regions: { name: string; text: string }[];
  /** 1-based numbers of non-blank, non-marker lines outside every region. */
  uncovered: number[];
}

/** The file's regions (outer blank lines trimmed) and its uncovered lines. */
function markedRegions(source: string, language: Language): Marked {
  const { open, close } = MARKERS[language];
  const regions: Marked['regions'] = [];
  const uncovered: number[] = [];
  let current: { name: string; lines: string[] } | null = null;
  source
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach((line, index) => {
      const opened = open.exec(line);
      if (opened) {
        current = { name: opened[1], lines: [] };
      } else if (close.test(line) && current) {
        const body = current.lines;
        while (body.length && body[0].trim() === '') body.shift();
        while (body.length && body[body.length - 1].trim() === '') body.pop();
        regions.push({ name: current.name, text: body.join('\n') });
        current = null;
      } else if (current) {
        current.lines.push(line);
      } else if (line.trim() !== '') {
        uncovered.push(index + 1);
      }
    });
  return { regions, uncovered };
}

/**
 * `null` when the entry's resolved `language` fences equal `file` with blank
 * and marker lines dropped; otherwise a message naming the entry and language
 * and showing the first line that differs.
 */
function chunkMismatch(
  entry: string,
  language: Language,
  markdown: string,
  file: string,
): string | null {
  const shown = nonBlankLines(
    fences(markdown, language)
      .map((f) => f.value)
      .join('\n'),
  );
  const real = nonBlankLines(file, language);
  const length = Math.max(shown.length, real.length);
  for (let i = 0; i < length; i++) {
    if (shown[i] === real[i]) continue;
    const describe = (line: string | undefined) =>
      line === undefined ? '(nothing)' : JSON.stringify(line);
    return (
      `${entry} (${language}): non-blank line ${i + 1} differs: ` +
      `the entry's chunks have ${describe(shown[i])}, the code file has ${describe(real[i])}`
    );
  }
  return null;
}

function codePath(slug: string, language: Language): string {
  return language === 'python'
    ? `/src/dsa/code/${slug}/${slug.replaceAll('-', '_')}.py`
    : `/src/dsa/code/${slug}/${slug}.ts`;
}

const SLUGS = Object.keys(ENTRIES).map((p) => p.replace(/^.*\/([^/]+)\.md$/, '$1'));
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The entry file as it is on disk, before the build fills in its regions. */
function entryOnDisk(slug: string): string {
  return readFileSync(path.join(HERE, 'entries', `${slug}.md`), 'utf8');
}

describe('DSA code files (criterion 12)', () => {
  it('has the three reference entries', () => {
    expect(SLUGS).toEqual(
      expect.arrayContaining(['hash-map', 'two-pointers', 'binary-search']),
    );
  });

  it.each(SLUGS)('%s has both code files and both test files', (slug) => {
    const underscored = slug.replaceAll('-', '_');
    const files = Object.keys(
      import.meta.glob('/src/dsa/code/*/*', { query: '?raw', import: 'default' }),
    );
    expect(files).toEqual(
      expect.arrayContaining([
        `/src/dsa/code/${slug}/${underscored}.py`,
        `/src/dsa/code/${slug}/test_${underscored}.py`,
        `/src/dsa/code/${slug}/${slug}.ts`,
        `/src/dsa/code/${slug}/${slug}.test.ts`,
      ]),
    );
  });

  it.each(SLUGS)(
    '%s code files are self-contained (no TS imports but MinHeap)',
    (slug) => {
      const ts = CODE[codePath(slug, 'typescript')];
      expect(ts, slug).toBeDefined();
      // The one allowed import: the Heap entry's MinHeap, for entries that
      // need a priority queue (docs/dsa.md, "The code files").
      const imports = ts.match(/^\s*import\s.*$/gm) ?? [];
      for (const line of imports) {
        expect(line.trim(), slug).toBe("import { MinHeap } from '../heap/heap';");
      }
      expect(ts).not.toMatch(/\brequire\(/);
    },
  );
});

// Entries whose code predates docs/dsa.md's plain-code rule. Shrink-only:
// each rewrite batch removes its entries, and the list goes when it's empty.
const PENDING_PLAIN = new Set([
  'arrays-and-strings',
  'backtracking',
  'binary-search',
  'binary-search-tree',
  'binary-tree',
  'bit-manipulation',
  'breadth-first-search',
  'depth-first-search',
  'dynamic-programming',
  'dynamic-programming-shapes',
  'graph',
  'greedy',
  'hash-map',
  'heap',
  'heap-patterns',
  'intervals',
  'linked-list',
  'monotonic-stack',
  'prefix-sums',
  'prim-kruskal',
  'shortest-paths',
  'sliding-window',
  'sorting',
  'stacks-and-queues',
  'topological-sort',
  'trie',
  'two-pointers',
  'union-find',
]);

// The constructs docs/dsa.md's plain-code rule names, as they're spelled in
// code. Comments are stripped first, so a comment may name one.
const NOT_PLAIN: Record<Language, [string, RegExp][]> = {
  python: [
    ['a generator (yield)', /\byield\b/],
    ['a special method', /\bdef __(iter|len|getitem|contains|next)__\b/],
    ['__slots__', /\b__slots__\b/],
    ['a generic type parameter', /\b(Generic\[|TypeVar\(|Protocol\b)/],
    ['a dataclass', /@dataclass\b/],
    ['the walrus operator', /:=/],
    ['functools.cache', /@(functools\.)?(cache|lru_cache)\b/],
  ],
  typescript: [
    ['a generator', /\bfunction\s*\*|\byield\b/],
    ['Symbol.iterator', /Symbol\.iterator/],
    ['a generic type parameter', /\b(class|function)\s+\w+\s*</],
    ['a typed array', /\b(Int|Uint|Float)(8|16|32|64)(Clamped)?Array\b/],
    ['Math.clz32 or Math.imul', /Math\.(clz32|imul)\b/],
    ['??=', /\?\?=/],
  ],
};

/** `source` with its comments removed (line comments and block comments). */
function withoutComments(source: string, language: Language): string {
  return language === 'python'
    ? source.replace(/#.*$/gm, '')
    : source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe("DSA code follows docs/dsa.md's plain-code rule", () => {
  it('lists only entries that exist (PENDING_PLAIN only shrinks)', () => {
    expect([...PENDING_PLAIN].filter((slug) => !SLUGS.includes(slug))).toEqual([]);
  });

  it.each(SLUGS.filter((slug) => !PENDING_PLAIN.has(slug)))(
    '%s uses none of the constructs the rule excludes',
    (slug) => {
      for (const language of LANGUAGES) {
        const code = withoutComments(CODE[codePath(slug, language)], language);
        const found = NOT_PLAIN[language]
          .filter(([, pattern]) => pattern.test(code))
          .map(([name]) => name);
        expect(found, `${slug} (${language})`).toEqual([]);
      }
    },
  );

  it.each([
    [
      'python',
      'def __iter__(self):\n    yield 1',
      ['a generator (yield)', 'a special method'],
    ],
    ['typescript', '*[Symbol.iterator]() {}', ['Symbol.iterator']],
    ['typescript', 'export class MinHeap<T> {}', ['a generic type parameter']],
    ['python', '# a comment may say yield or __iter__\nx = 1', []],
  ] as const)('the check itself: %s %j', (language, code, expected) => {
    const stripped = withoutComments(code, language);
    const found = NOT_PLAIN[language]
      .filter(([, pattern]) => pattern.test(stripped))
      .map(([name]) => name);
    expect(found).toEqual(expected);
  });
});

const CASES = SLUGS.flatMap((slug) => LANGUAGES.map((lang) => [slug, lang] as const));

describe('DSA entries name regions instead of copying code (regions criterion 5)', () => {
  it.each(CASES)(
    '%s: the file on disk has only %s region fences under Implementation/Walkthrough',
    (slug, language) => {
      const found = fences(parseFrontmatter(entryOnDisk(slug)).content, language);
      expect(found.length, `${slug} has no ${language} region fences`).toBeGreaterThan(0);
      const literal = found.filter((f) => !/^region=[a-z0-9-]+$/.test(f.meta.trim()));
      expect(
        literal.map((f) => f.value.split('\n')[0]),
        `${slug} still holds literal ${language} fences`,
      ).toEqual([]);
      expect(found.map((f) => f.value).filter((v) => v !== '')).toEqual([]);
    },
  );

  it.each(CASES)(
    '%s: every non-blank line of the %s file is in a region',
    (slug, language) => {
      const file = CODE[codePath(slug, language)];
      expect(file, `${codePath(slug, language)} is missing`).toBeDefined();
      const { regions, uncovered } = markedRegions(file, language);
      expect(
        regions.length,
        `${codePath(slug, language)} has no regions`,
      ).toBeGreaterThan(0);
      expect(
        uncovered,
        `${codePath(slug, language)}: lines outside every region`,
      ).toEqual([]);
    },
  );
});

describe('the resolved entries show their code files (regions criteria 3 and 5)', () => {
  it.each(CASES)(
    '%s: the resolved %s fences are the regions, once each, in file order',
    (slug, language) => {
      const markdown = parseFrontmatter(ENTRIES[`/src/dsa/entries/${slug}.md`]).content;
      const file = CODE[codePath(slug, language)];
      expect(file, `${codePath(slug, language)} is missing`).toBeDefined();
      const shown = fences(markdown, language);
      expect(shown.map((f) => f.meta.trim())).not.toContainEqual(
        expect.stringMatching(/region=/),
      );
      expect(shown.map((f) => f.value)).toEqual(
        markedRegions(file, language).regions.map((r) => r.text),
      );
    },
  );

  it.each(CASES)(
    '%s: the resolved %s fences show the whole file once, in order',
    (slug, language) => {
      const markdown = parseFrontmatter(ENTRIES[`/src/dsa/entries/${slug}.md`]).content;
      const file = CODE[codePath(slug, language)];
      expect(fences(markdown, language).length).toBeGreaterThan(0);
      expect(chunkMismatch(slug, language, markdown, file)).toBeNull();
    },
  );
});

describe('the region check itself', () => {
  const PY_FILE = [
    '# region lower-bound',
    'def lower_bound(nums, target):',
    '    lo, hi = 0, len(nums)',
    '',
    '    while lo < hi:',
    '# endregion',
    '',
    '    # region loop-body',
    '        mid = (lo + hi) // 2',
    '        if nums[mid] < target:',
    '            lo = mid + 1',
    '        else:',
    '            hi = mid',
    '    return lo',
    '    # endregion',
    '',
  ].join('\n');

  const TS_FILE = [
    '// #region lower-bound',
    'export function lowerBound(nums: number[], target: number): number {',
    '  let lo = 0;',
    '  let hi = nums.length;',
    '  // #endregion',
    '  // #region loop',
    '  while (lo < hi) {',
    '    const mid = (lo + hi) >>> 1;',
    '    if (nums[mid] < target) lo = mid + 1;',
    '    else hi = mid;',
    '  }',
    '  return lo;',
    '}',
    '// #endregion',
    '',
  ].join('\n');

  function fence(info: string, lines: string[]): string {
    return ['```' + info, ...lines, '```'].join('\n');
  }

  const PY = PY_FILE.split('\n');
  const TS = TS_FILE.split('\n');

  const RESOLVED = [
    '## The idea',
    fence('python', ['print(lower_bound([1, 2], 2))']),
    '## Walkthrough',
    fence('python', PY.slice(1, 5)),
    fence('typescript', TS.slice(1, 4)),
    'Why the loop ends.',
    '### Finishing',
    fence('python', PY.slice(8, 14)),
    fence('typescript', TS.slice(6, 13)),
    '## Complexity',
    fence('python', ['# not compared']),
  ].join('\n\n');

  it('reads both marker styles, indented ones too, and trims outer blank lines', () => {
    expect(markedRegions(PY_FILE, 'python')).toEqual({
      regions: [
        { name: 'lower-bound', text: PY.slice(1, 5).join('\n') },
        { name: 'loop-body', text: PY.slice(8, 14).join('\n') },
      ],
      uncovered: [],
    });
    expect(markedRegions(TS_FILE, 'typescript').regions.map((r) => r.name)).toEqual([
      'lower-bound',
      'loop',
    ]);
  });

  // docs/dsa.md: every form VS Code folds is a marker (VS Code's own snippet
  // writes `//#region`), but only as a comment that starts its line.
  const PY_VARIANTS = [
    '#region a',
    'a = 1',
    '#endregion',
    '#  region b',
    'b = 2',
    '#  endregion',
    '  # region c',
    'c = 3',
    '  # endregion c',
    '# regional',
    'x = 1  # region d',
    'y = 2  # endregion',
  ].join('\n');

  const TS_VARIANTS = [
    '//#region a',
    'const a = 1;',
    '//#endregion',
    '// region b',
    'const b = 2;',
    '// endregion',
    '  //  #region c',
    'const c = 3;',
    '  // #endregion c',
    '//region d',
    'const d = 4;',
    '//endregion',
    '// regional',
    'f(); // #region e',
    'g(); // #endregion',
  ].join('\n');

  it('reads every Python marker form VS Code folds, and only at the start of a line', () => {
    expect(markedRegions(PY_VARIANTS, 'python')).toEqual({
      regions: [
        { name: 'a', text: 'a = 1' },
        { name: 'b', text: 'b = 2' },
        { name: 'c', text: 'c = 3' },
      ],
      uncovered: [10, 11, 12],
    });
  });

  it('reads every TypeScript marker form VS Code folds, and only at the start of a line', () => {
    expect(markedRegions(TS_VARIANTS, 'typescript')).toEqual({
      regions: [
        { name: 'a', text: 'const a = 1;' },
        { name: 'b', text: 'const b = 2;' },
        { name: 'c', text: 'const c = 3;' },
        { name: 'd', text: 'const d = 4;' },
      ],
      uncovered: [13, 14, 15],
    });
  });

  it('drops every marker form, but not mid-line or longer words, when comparing', () => {
    const shown = (lines: string[]) =>
      ['## Walkthrough', fence('python', lines)].join('\n\n');
    const code = [
      'a = 1',
      'b = 2',
      'c = 3',
      '# regional',
      'x = 1  # region d',
      'y = 2  # endregion',
    ];
    expect(chunkMismatch('demo', 'python', shown(code), PY_VARIANTS)).toBeNull();
    const tsShown = [
      '## Walkthrough',
      fence('typescript', [
        'const a = 1;',
        'const b = 2;',
        'const c = 3;',
        'const d = 4;',
        '// regional',
        'f(); // #region e',
        'g(); // #endregion',
      ]),
    ].join('\n\n');
    expect(chunkMismatch('demo', 'typescript', tsShown, TS_VARIANTS)).toBeNull();
  });

  it('reports a non-blank line outside every region by its line number', () => {
    const stray = PY_FILE.replace(
      '    # region loop-body',
      'x = 1\n    # region loop-body',
    );
    expect(markedRegions(stray, 'python').uncovered).toEqual([8]);
  });

  it('passes when the resolved fences, blank and marker lines aside, equal the files', () => {
    expect(chunkMismatch('demo', 'python', RESOLVED, PY_FILE)).toBeNull();
    expect(chunkMismatch('demo', 'typescript', RESOLVED, TS_FILE)).toBeNull();
  });

  it('catches a missing chunk, naming the entry and the language', () => {
    const missing = RESOLVED.replace(fence('typescript', TS.slice(6, 13)), '');
    const message = chunkMismatch('demo', 'typescript', missing, TS_FILE);
    expect(message).toContain('demo');
    expect(message).toContain('typescript');
    expect(message).toContain(JSON.stringify(TS[6]));
  });

  it('only reads fences under Implementation or Walkthrough, with their info', () => {
    const md = RESOLVED.replace(
      fence('python', PY.slice(1, 5)),
      fence('python region=x', []),
    );
    expect(fences(md, 'python')).toEqual([
      { meta: 'region=x', value: '' },
      { meta: '', value: PY.slice(8, 14).join('\n') },
    ]);
  });
});

/**
 * docs/specs/dsa-tab.md, criteria 12 and 13 (review fix). pytest puts each
 * test's folder on `sys.path`, so any extra file in an entry's code folder (an
 * `__init__.py`, or a package folder that shadows the module under test) can
 * make `test:py` pass on broken code. So the code tree is an allowlist: every
 * folder under `src/dsa/code/` is named for an entry and holds exactly its
 * four files, with no subfolders; and every entry has its folder. The tree is
 * listed with Node's fs, not git, so an untracked file counts too.
 */

/** One item in a listing: a file, or a folder with its own listing. */
interface Listing {
  [name: string]: Listing | 'file';
}

function expectedFiles(slug: string): string[] {
  const underscored = slug.replaceAll('-', '_');
  return [`${underscored}.py`, `test_${underscored}.py`, `${slug}.ts`, `${slug}.test.ts`];
}

/** Problems with a code tree (`src/dsa/code` as a listing), empty when clean. */
function codeTreeProblems(tree: Listing, slugs: string[]): string[] {
  const problems: string[] = [];
  for (const [name, item] of Object.entries(tree)) {
    if (item === 'file') {
      problems.push(`src/dsa/code/${name} is a file; only entry folders belong here`);
      continue;
    }
    if (!slugs.includes(name)) {
      problems.push(
        `src/dsa/code/${name}/ has no matching entry src/dsa/entries/${name}.md`,
      );
      continue;
    }
    const expected = expectedFiles(name);
    for (const [child, kind] of Object.entries(item)) {
      if (kind !== 'file') {
        problems.push(`src/dsa/code/${name}/${child}/ is a folder; none are allowed`);
      } else if (!expected.includes(child)) {
        problems.push(
          `src/dsa/code/${name}/${child} is not one of the entry's four files`,
        );
      }
    }
    for (const file of expected) {
      if (item[file] !== 'file') problems.push(`src/dsa/code/${name}/${file} is missing`);
    }
  }
  for (const slug of slugs) {
    if (!(slug in tree))
      problems.push(`src/dsa/code/${slug}/ is missing for entry ${slug}`);
  }
  return problems;
}

/** The real folder as a listing, read with fs (untracked and ignored files included). */
function listTree(dir: string): Listing {
  const listing: Listing = {};
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    listing[item.name] = item.isDirectory()
      ? listTree(path.join(dir, item.name))
      : 'file';
  }
  return listing;
}

const CODE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'code');

describe('DSA code folders hold only their four files (criteria 12-13)', () => {
  it('the real src/dsa/code tree is clean', () => {
    expect(codeTreeProblems(listTree(CODE_DIR), SLUGS)).toEqual([]);
  });
});

describe('the code-folder check itself', () => {
  const folder = (slug: string): Listing =>
    Object.fromEntries(expectedFiles(slug).map((f) => [f, 'file' as const]));
  const clean = (): Listing => ({
    'hash-map': folder('hash-map'),
    'two-pointers': folder('two-pointers'),
  });
  const slugs = ['hash-map', 'two-pointers'];

  it('passes on a clean tree', () => {
    expect(codeTreeProblems(clean(), slugs)).toEqual([]);
  });

  it('catches an extra __init__.py in an entry folder', () => {
    const tree = clean();
    (tree['hash-map'] as Listing)['__init__.py'] = 'file';
    expect(codeTreeProblems(tree, slugs)).toEqual([
      "src/dsa/code/hash-map/__init__.py is not one of the entry's four files",
    ]);
  });

  it('catches a nested package folder that shadows the module', () => {
    const tree = clean();
    (tree['hash-map'] as Listing)['hash_map'] = { '__init__.py': 'file' };
    expect(codeTreeProblems(tree, slugs)).toEqual([
      'src/dsa/code/hash-map/hash_map/ is a folder; none are allowed',
    ]);
  });

  it('catches a __pycache__ folder too', () => {
    const tree = clean();
    (tree['two-pointers'] as Listing)['__pycache__'] = {};
    expect(codeTreeProblems(tree, slugs)).toHaveLength(1);
  });

  it('catches a missing test file', () => {
    const tree = clean();
    delete (tree['two-pointers'] as Listing)['test_two_pointers.py'];
    expect(codeTreeProblems(tree, slugs)).toEqual([
      'src/dsa/code/two-pointers/test_two_pointers.py is missing',
    ]);
  });

  it('catches a folder with no matching entry', () => {
    const tree = clean();
    tree['x'] = folder('x');
    expect(codeTreeProblems(tree, slugs)).toEqual([
      'src/dsa/code/x/ has no matching entry src/dsa/entries/x.md',
    ]);
  });

  it('catches a file at the top of the code tree', () => {
    const tree = clean();
    tree['conftest.py'] = 'file';
    expect(codeTreeProblems(tree, slugs)).toHaveLength(1);
  });

  it('catches an entry with no code folder', () => {
    const tree = clean();
    delete tree['two-pointers'];
    expect(codeTreeProblems(tree, slugs)).toEqual([
      'src/dsa/code/two-pointers/ is missing for entry two-pointers',
    ]);
  });
});
