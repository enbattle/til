import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as markdown from './markdown.mjs';
import {
  diagramName,
  diagramReferences,
  extractCaseStudyRefs,
  extractTopicRefs,
  isDiagramSrc,
  type TopicRef,
} from './markdown.mjs';

// The link extractors live in one plain-JS module with the site's markdown
// parser (no `import.meta.glob`, no `@/` alias), so `vite.config.ts` and the
// check scripts can import them too (docs/specs/dedupe-app-scripts-tests.md,
// criterion 1). They read links the way the site renders them: the cases below
// held for the old regex extractor and still hold.

describe('extractTopicRefs (criterion 6)', () => {
  it('returns refs in first-appearance order, de-duplicated by section+slug', () => {
    const body = [
      'See [b](/beta/two) first, then [a](/alpha/one).',
      'Again [b again](/beta/two) and [c](/gamma/three) and [a again](/alpha/one).',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'beta', slug: 'two' },
      { section: 'alpha', slug: 'one' },
      { section: 'gamma', slug: 'three' },
    ]);
  });

  it('returns [] when there are no links', () => {
    expect(extractTopicRefs('Just prose, no links at all.')).toEqual([]);
  });

  it('ignores an external https link', () => {
    expect(extractTopicRefs('[ext](https://example.com/foo/bar)')).toEqual([]);
  });

  it('ignores a single-segment link', () => {
    expect(extractTopicRefs('[s](/only-one)')).toEqual([]);
  });

  it('ignores a link with more than two path segments', () => {
    expect(extractTopicRefs('[deep](/a/b/c)')).toEqual([]);
  });

  it('ignores /system-design/... links', () => {
    expect(extractTopicRefs('[q](/system-design/some-case-study)')).toEqual([]);
  });

  it('ignores a diagram image, which is not a link', () => {
    expect(extractTopicRefs('![Architecture](/diagrams/url-shortener.svg)')).toEqual([]);
    expect(extractTopicRefs('![Architecture](/diagrams/x/y.svg)')).toEqual([]);
  });

  it('ignores a link inside a fenced code block but counts links after it', () => {
    const body = [
      'Before [kept](/alpha/one).',
      '',
      '```md',
      '[hidden](/code/block)',
      '```',
      '',
      'After [also kept](/beta/two).',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'alpha', slug: 'one' },
      { section: 'beta', slug: 'two' },
    ]);
  });

  it('strips a #fragment from the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one#some-heading)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('strips a ?query from the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one?x=1)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('de-duplicates a link that appears with and without a fragment', () => {
    expect(extractTopicRefs('[a](/alpha/one#x) and [b](/alpha/one)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('accepts a double-quoted title after the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one "A title")')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('finds a link whose visible text spans two lines', () => {
    const body = 'This is [a link whose text\nwraps onto a second line](/alpha/one) ok.';
    expect(extractTopicRefs(body)).toEqual([{ section: 'alpha', slug: 'one' }]);
  });
});

describe('extractCaseStudyRefs (criterion 6)', () => {
  it('returns only /system-design/<slug> slugs, first-appearance order, de-duplicated', () => {
    const body = [
      '[two](/system-design/second) then [one](/system-design/first).',
      '[topic](/alpha/one) [ext](https://example.com/system-design/nope)',
      '[two again](/system-design/second) [landing](/system-design)',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['second', 'first']);
  });

  it('returns [] when there are none', () => {
    expect(extractCaseStudyRefs('[topic](/alpha/one)')).toEqual([]);
  });

  it('ignores a link inside a fenced code block', () => {
    const body = [
      '[real](/system-design/real)',
      '',
      '```',
      '[fake](/system-design/fake)',
      '```',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['real']);
  });

  it('strips a #fragment from the destination', () => {
    expect(extractCaseStudyRefs('[s](/system-design/real#trade-offs)')).toEqual(['real']);
  });

  it('finds a link whose visible text spans two lines', () => {
    const body = '[text that\nwraps](/system-design/wrapped)';
    expect(extractCaseStudyRefs(body)).toEqual(['wrapped']);
  });
});

// docs/specs/dedupe-app-scripts-tests.md, criterion 1: the extractors walk the
// site's own markdown tree, so a reference-style link counts and a link shown
// as code does not.
describe('extractTopicRefs on the markdown parser (dedupe criterion 1)', () => {
  it('counts a reference-style link whose definition exists', () => {
    const body = ['See [a][r] for more.', '', '[r]: /alpha/one'].join('\n');
    expect(extractTopicRefs(body)).toEqual([{ section: 'alpha', slug: 'one' }]);
  });

  it('counts collapsed and shortcut reference links, matching labels case-insensitively', () => {
    const body = [
      'See [Alpha][] and [beta] and [x][GAMMA].',
      '',
      '[alpha]: /alpha/one',
      '[Beta]: /beta/two "A title"',
      '[gamma]: /gamma/three#part',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'alpha', slug: 'one' },
      { section: 'beta', slug: 'two' },
      { section: 'gamma', slug: 'three' },
    ]);
  });

  it('orders a reference-style link by where the link appears, not its definition', () => {
    const body = ['[r]: /alpha/one', '', 'First [b](/beta/two), then [a][r].'].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'beta', slug: 'two' },
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('ignores a reference whose definition is missing, and a bare definition', () => {
    const body = ['See [a][missing].', '', '[unused]: /alpha/one'].join('\n');
    expect(extractTopicRefs(body)).toEqual([]);
  });

  it('ignores a link inside inline code', () => {
    const body = 'Write `[a](/alpha/one)` to link; see [b](/beta/two).';
    expect(extractTopicRefs(body)).toEqual([{ section: 'beta', slug: 'two' }]);
  });

  it('ignores a link inside an indented code block', () => {
    const body = [
      'Before [kept](/beta/two).',
      '',
      '    [hidden](/alpha/one)',
      '',
      'After.',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([{ section: 'beta', slug: 'two' }]);
  });

  it('ignores a reference-style link inside code', () => {
    const body = ['`[a][r]`', '', '    [b][r]', '', '[r]: /alpha/one'].join('\n');
    expect(extractTopicRefs(body)).toEqual([]);
  });

  it('ignores a reference-style image', () => {
    const body = ['![Architecture][d]', '', '[d]: /alpha/one'].join('\n');
    expect(extractTopicRefs(body)).toEqual([]);
  });

  it('returns plain { section, slug } objects (the TopicRef type)', () => {
    const [ref]: TopicRef[] = extractTopicRefs('[a](/alpha/one)');
    expect(Object.keys(ref).sort()).toEqual(['section', 'slug']);
  });
});

describe('extractCaseStudyRefs on the markdown parser (dedupe criterion 1)', () => {
  it('counts a reference-style link whose definition exists', () => {
    const body = [
      'See [the shortener][s].',
      '',
      '[s]: /system-design/url-shortener',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['url-shortener']);
  });

  it('ignores a link inside inline code', () => {
    expect(
      extractCaseStudyRefs('`[x](/system-design/fake)` and [y](/system-design/real)'),
    ).toEqual(['real']);
  });

  it('ignores a link inside an indented code block', () => {
    const body = [
      '[real](/system-design/real)',
      '',
      '    [fake](/system-design/fake)',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['real']);
  });
});

describe('the rest of src/lib/markdown.mjs (dedupe criterion 1)', () => {
  it('exports the parser and the diagram and DSA helpers from the one module', () => {
    for (const name of [
      'markdownParser',
      'isDiagramSrc',
      'diagramName',
      'diagramReferences',
      'dsaPrerequisites',
      'extractTopicRefs',
      'extractCaseStudyRefs',
    ]) {
      expect(typeof ({ ...markdown } as Record<string, unknown>)[name], name).toBe(
        'function',
      );
    }
  });

  it('finds diagram images, inline and reference-style, but not in code', () => {
    const body = [
      '![Flow](/diagrams/demo/flow.svg)',
      '',
      '![Data][d]',
      '',
      '`![x](/diagrams/demo/inline.svg)`',
      '',
      '![Photo](/images/photo.png)',
      '',
      '[d]: /diagrams/demo/data.svg',
    ].join('\n');
    expect(diagramReferences(body)).toEqual([
      '/diagrams/demo/flow.svg',
      '/diagrams/demo/data.svg',
    ]);
    expect(isDiagramSrc('/diagrams/demo/flow.svg')).toBe(true);
    expect(isDiagramSrc('/images/photo.png')).toBe(false);
    expect(diagramName('/diagrams/url-shortener/architecture.svg')).toBe(
      'url-shortener/architecture',
    );
  });
});

// Criterion 3: the three old modules are gone and nothing imports them.
describe('the old link modules are gone (dedupe criterion 3)', () => {
  const ROOT = resolve('.');
  const OLD = /^(markdown-links|diagram-refs|dsa-prereqs)(\.d)?(\.m?[jt]s)?$/;
  const THIS_FILE = 'src/lib/markdown.test.ts';

  it.each([
    'src/lib/markdown-links.ts',
    'src/lib/diagram-refs.mjs',
    'src/lib/diagram-refs.d.mts',
    'src/lib/dsa-prereqs.mjs',
    'src/lib/dsa-prereqs.d.mts',
  ])('%s does not exist', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(false);
  });

  function sourceFiles(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) sourceFiles(path, files);
      else if (/\.(m?[jt]sx?|mts)$/.test(entry)) files.push(path);
    }
    return files;
  }

  it('no file under src/, scripts/ or vite.config.ts imports them', () => {
    const files = [
      ...sourceFiles(join(ROOT, 'src')),
      ...sourceFiles(join(ROOT, 'scripts')),
      join(ROOT, 'vite.config.ts'),
    ];
    const importers: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split('\\').join('/');
      if (rel === THIS_FILE) continue;
      const source = readFileSync(file, 'utf8');
      // Every quoted module specifier in an import, export-from, dynamic
      // import() or vi.mock(), checked by its last path segment.
      for (const [, specifier] of source.matchAll(
        /(?:\bfrom\s*|\bimport\s*\(?\s*|\bmock\s*\(\s*)['"`]([^'"`]+)['"`]/g,
      )) {
        const last = specifier.split('/').pop()!;
        if (OLD.test(last)) importers.push(`${rel}: ${specifier}`);
      }
    }
    expect(importers).toEqual([]);
  });
});
