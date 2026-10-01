import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { markdownParser } from '@/lib/markdown.mjs';
import { parseFrontmatter } from '@/lib/frontmatter';

/**
 * docs/specs/dsa-tab.md, criteria 11 and 12. An entry's code is shown in
 * chunks, but the tested code lives in files beside it
 * (`src/dsa/code/<slug>/<slug_underscored>.py` and `<slug>.ts`). This checks
 * that the python fences under `## Implementation` / `## Walkthrough`, in
 * order, are exactly the `.py` file, and the typescript fences exactly the
 * `.ts` file, line by line with blank lines dropped. Fences elsewhere in the
 * entry (a usage example) aren't compared. Fences are read from the markdown
 * tree (`markdownParser`), not a regex.
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
  value?: string;
  children?: MdNode[];
}

function textOf(node: MdNode): string {
  return node.value ?? (node.children ?? []).map(textOf).join('');
}

/** The `language` fences under the chunked sections, in order. */
function chunks(markdown: string, language: Language): string[] {
  const root = markdownParser().parse(markdown) as MdNode;
  const found: string[] = [];
  let inChunkSection = false;
  const collect = (node: MdNode) => {
    if (node.type === 'code' && node.lang === language) found.push(node.value ?? '');
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

/** Lines with blank ones dropped and line endings normalised. */
function nonBlankLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '');
}

/**
 * `null` when the entry's `language` chunks equal `file` (blank lines
 * dropped); otherwise a message naming the entry and language and showing the
 * first line that differs.
 */
function chunkMismatch(
  entry: string,
  language: Language,
  markdown: string,
  file: string,
): string | null {
  const shown = nonBlankLines(chunks(markdown, language).join('\n'));
  const real = nonBlankLines(file);
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

  it.each(SLUGS)('%s code files are self-contained (no TS imports)', (slug) => {
    const ts = CODE[codePath(slug, 'typescript')];
    expect(ts, slug).toBeDefined();
    expect(ts).not.toMatch(/^\s*import\s/m);
    expect(ts).not.toMatch(/\brequire\(/);
  });
});

describe('DSA code chunks match the code files (criterion 11)', () => {
  const cases = SLUGS.flatMap((slug) => LANGUAGES.map((lang) => [slug, lang] as const));

  it.each(cases)('%s: the %s chunks equal the code file', (slug, language) => {
    const markdown = parseFrontmatter(ENTRIES[`/src/dsa/entries/${slug}.md`]).content;
    const file = CODE[codePath(slug, language)];
    expect(file, `${codePath(slug, language)} is missing`).toBeDefined();
    expect(
      chunks(markdown, language).length,
      `${slug} has no ${language} chunks`,
    ).toBeGreaterThan(0);
    expect(chunkMismatch(slug, language, markdown, file)).toBeNull();
  });
});

describe('the chunk check itself (criterion 11)', () => {
  const PY_FILE = [
    'def lower_bound(nums, target):',
    '    lo, hi = 0, len(nums)',
    '',
    '    while lo < hi:',
    '        mid = (lo + hi) // 2',
    '        if nums[mid] < target:',
    '            lo = mid + 1',
    '        else:',
    '            hi = mid',
    '    return lo',
    '',
  ].join('\n');

  const TS_FILE = [
    'export function lowerBound(nums: number[], target: number): number {',
    '  let lo = 0;',
    '  let hi = nums.length;',
    '  while (lo < hi) {',
    '    const mid = (lo + hi) >>> 1;',
    '    if (nums[mid] < target) lo = mid + 1;',
    '    else hi = mid;',
    '  }',
    '  return lo;',
    '}',
    '',
  ].join('\n');

  function fence(language: Language, lines: string[]): string {
    return ['```' + language, ...lines, '```'].join('\n');
  }

  const PY = PY_FILE.split('\n');
  const TS = TS_FILE.split('\n');

  const GOOD = [
    '## Prerequisites',
    'None.',
    '## The idea',
    'A usage example is not compared:',
    fence('python', ['print(lower_bound([1, 2], 2))']),
    fence('typescript', ['console.log(lowerBound([1, 2], 2));']),
    '## Walkthrough',
    // The first chunk splits the function after its first line; the blank
    // line inside the file is not in any chunk.
    fence('python', PY.slice(0, 2)),
    fence('typescript', TS.slice(0, 3)),
    'Why the half-open range.',
    fence('python', PY.slice(3, 9)),
    fence('typescript', TS.slice(3, 8)),
    'Why the loop ends.',
    '### Finishing',
    fence('python', PY.slice(9)),
    fence('typescript', TS.slice(8)),
    'Why lo is the answer.',
    '## Complexity',
    fence('python', ['# not compared either']),
  ].join('\n\n');

  it('passes when the chunks, blank lines aside, equal the files', () => {
    expect(chunkMismatch('demo', 'python', GOOD, PY_FILE)).toBeNull();
    expect(chunkMismatch('demo', 'typescript', GOOD, TS_FILE)).toBeNull();
  });

  it('ignores CRLF line endings in the file', () => {
    expect(
      chunkMismatch('demo', 'python', GOOD, PY_FILE.replace(/\n/g, '\r\n')),
    ).toBeNull();
  });

  it('catches a changed line, naming the entry, the language and the line', () => {
    const changed = GOOD.replace('            lo = mid + 1', '            lo = mid');
    const message = chunkMismatch('demo', 'python', changed, PY_FILE);
    expect(message).toContain('demo');
    expect(message).toContain('python');
    expect(message).toContain('"            lo = mid"');
    expect(message).toContain('"            lo = mid + 1"');
    expect(message).toMatch(/line 6\b/);
  });

  it('catches a missing chunk', () => {
    const missing = GOOD.replace(fence('typescript', TS.slice(3, 8)), '');
    const message = chunkMismatch('demo', 'typescript', missing, TS_FILE);
    expect(message).toContain('demo');
    expect(message).toContain('typescript');
    expect(message).toContain(JSON.stringify(TS[3]));
  });

  it('catches a chunk the file does not have', () => {
    const extra = GOOD.replace(
      'Why lo is the answer.',
      `${fence('python', ['extra = 1'])}\n\nWhy lo is the answer.`,
    );
    const message = chunkMismatch('demo', 'python', extra, PY_FILE);
    expect(message).toContain('"extra = 1"');
    expect(message).toContain('(nothing)');
  });

  it('catches a chunk that stops early', () => {
    const short = GOOD.replace(fence('python', PY.slice(9)), '');
    expect(chunkMismatch('demo', 'python', short, PY_FILE)).toContain(
      JSON.stringify(PY[9]),
    );
  });

  it('only reads fences under Implementation or Walkthrough', () => {
    expect(chunks(GOOD, 'python')).toHaveLength(3);
    expect(chunks(GOOD, 'typescript')).toHaveLength(3);
  });

  it('reads an Implementation section the same way', () => {
    const md = ['## Implementation', fence('python', PY), fence('typescript', TS)].join(
      '\n\n',
    );
    expect(chunkMismatch('ds', 'python', md, PY_FILE)).toBeNull();
    expect(chunkMismatch('ds', 'typescript', md, TS_FILE)).toBeNull();
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
