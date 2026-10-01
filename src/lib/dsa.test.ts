import { describe, expect, it } from 'vitest';
import { SECTIONS } from '@/content/registry';
import type { DsaEntry, DsaKind } from '@/types';
import { RAW_DSA_ENTRIES as RAW, rawDsaEntry as rawFor, without } from '@/test/content';
import { parseFrontmatter } from './frontmatter';
import { dsaPrerequisites } from './markdown.mjs';
import {
  DSA_ENTRIES,
  dsaKindLabel,
  getDsaEntry,
  getDsaPrerequisites,
  isDsaPath,
  loadAllDsaBodies,
  loadDsaEntryBody,
  orderDsaEntries,
  parseDsaEntry,
} from './dsa';

// Tests for docs/specs/dsa-tab.md, criteria 1-4 and 15. The loader's pure
// parts are checked on inline fixtures; `DSA_ENTRIES` and the body loader on
// the real entries under src/dsa/entries/.

// The test's own view of the real entry files (RAW, rawFor) comes from
// src/test/content.ts, independent of the app's loaders.

const REFERENCE_ENTRIES: [string, DsaKind][] = [
  ['hash-map', 'data-structure'],
  ['two-pointers', 'pattern'],
  ['binary-search', 'algorithm'],
];

// --- Criterion 1: parseDsaEntry ---

const VALID_PATH = '/src/dsa/entries/my-entry.md';

const VALID_FIELDS: Record<string, string> = {
  title: 'Binary Search',
  summary: 'Halve a sorted range until one index is left.',
  date: '2026-09-30',
  kind: 'algorithm',
};

describe('parseDsaEntry (criterion 1)', () => {
  it('returns slug, title, summary, date and kind, and no body', () => {
    const entry = parseDsaEntry(VALID_PATH, VALID_FIELDS);
    expect(entry).toEqual({
      slug: 'my-entry',
      title: 'Binary Search',
      summary: 'Halve a sorted range until one index is left.',
      date: '2026-09-30',
      kind: 'algorithm',
    });
    expect(entry).not.toHaveProperty('body');
  });

  it.each(['data-structure', 'pattern', 'algorithm'] as const)(
    'accepts kind %s',
    (kind) => {
      expect(parseDsaEntry(VALID_PATH, { ...VALID_FIELDS, kind }).kind).toBe(kind);
    },
  );

  it.each(['title', 'summary', 'date', 'kind'] as const)(
    'throws naming the file and the field when %s is missing',
    (field) => {
      expect(() => parseDsaEntry(VALID_PATH, without(VALID_FIELDS, field))).toThrow(
        /my-entry\.md/,
      );
      expect(() => parseDsaEntry(VALID_PATH, without(VALID_FIELDS, field))).toThrow(
        new RegExp(field),
      );
    },
  );

  it.each(['title', 'summary', 'date', 'kind'] as const)(
    'throws naming the file and the field when %s is present but empty',
    (field) => {
      const data = { ...VALID_FIELDS, [field]: '' };
      expect(() => parseDsaEntry(VALID_PATH, data)).toThrow(/my-entry\.md/);
      expect(() => parseDsaEntry(VALID_PATH, data)).toThrow(new RegExp(field));
    },
  );

  it.each(['datastructure', 'Data-Structure', 'patterns', 'algo', 'tree', ' pattern'])(
    'throws naming the file and "kind" when kind is %j',
    (kind) => {
      const data = { ...VALID_FIELDS, kind };
      expect(() => parseDsaEntry(VALID_PATH, data)).toThrow(/my-entry\.md/);
      expect(() => parseDsaEntry(VALID_PATH, data)).toThrow(/kind/);
    },
  );

  it.each([
    '/src/content/ai-and-ml/my-entry.md',
    '/src/dsa/my-entry.md',
    '/src/dsa/code/my-entry/my-entry.md',
    '/src/dsa/entries/nested/my-entry.md',
    '/src/dsa/entries/my-entry.txt',
    '/src/dsa/entries/.md',
    '/src/system-design/case-studies/my-entry.md',
    'not a path',
  ])('throws naming the path when it is not /src/dsa/entries/<slug>.md: %s', (path) => {
    expect(() => parseDsaEntry(path, VALID_FIELDS)).toThrow(path);
  });
});

// --- Criterion 2: orderDsaEntries ---

function entry(slug: string, kind: DsaKind, title: string): DsaEntry {
  return { slug, title, summary: `${title}.`, date: '2026-09-30', kind };
}

describe('orderDsaEntries (criterion 2)', () => {
  const ARRAY = entry('array', 'data-structure', 'Array');
  const HEAP = entry('heap', 'data-structure', 'Zeta Heap');
  const SLIDING = entry('sliding', 'pattern', 'Alpha Window');
  const BETA = entry('beta', 'pattern', 'Beta Pattern');
  const SEARCH = entry('search', 'algorithm', 'Aardvark Search');

  function slugs(entries: DsaEntry[]): string[] {
    return entries.map((e) => e.slug);
  }

  it('orders unrelated entries by kind (data structures, patterns, algorithms), then title', () => {
    expect(slugs(orderDsaEntries([SEARCH, BETA, HEAP, SLIDING, ARRAY], {}))).toEqual([
      'array',
      'heap',
      'sliding',
      'beta',
      'search',
    ]);
  });

  it('does not depend on the input order', () => {
    const forward = [ARRAY, HEAP, SLIDING, BETA, SEARCH];
    const expected = slugs(orderDsaEntries(forward, { sliding: ['heap'] }));
    expect(slugs(orderDsaEntries([...forward].reverse(), { sliding: ['heap'] }))).toEqual(
      expected,
    );
    expect(
      slugs(orderDsaEntries([BETA, SEARCH, ARRAY, SLIDING, HEAP], { sliding: ['heap'] })),
    ).toEqual(expected);
  });

  it('puts every prerequisite before its dependents, even against the kind order', () => {
    // A data structure that needs a pattern, which needs an algorithm.
    const ds = entry('ds', 'data-structure', 'Aa Structure');
    const pat = entry('pat', 'pattern', 'Bb Pattern');
    const alg = entry('alg', 'algorithm', 'Cc Algorithm');
    const other = entry('other', 'algorithm', 'Dd Algorithm');
    const ordered = slugs(
      orderDsaEntries([ds, pat, alg, other], { ds: ['pat'], pat: ['alg'] }),
    );
    expect(ordered.indexOf('alg')).toBeLessThan(ordered.indexOf('pat'));
    expect(ordered.indexOf('pat')).toBeLessThan(ordered.indexOf('ds'));
    expect(ordered).toHaveLength(4);
  });

  // Kahn's algorithm that always takes the ready entry (all prerequisites
  // placed) with the lowest (kind, title).
  it('breaks ties among ready entries by kind, then title', () => {
    // Ready at first: Array, Zeta Heap, Beta Pattern, Aardvark Search. Alpha
    // Window waits for Zeta Heap, then goes first among the patterns.
    expect(
      slugs(orderDsaEntries([SEARCH, BETA, HEAP, SLIDING, ARRAY], { sliding: ['heap'] })),
    ).toEqual(['array', 'heap', 'sliding', 'beta', 'search']);

    // Array needs Aardvark Search: the only ready data structure is Zeta Heap,
    // then the patterns, then the algorithm, and Array only after it.
    expect(
      slugs(orderDsaEntries([SEARCH, BETA, HEAP, SLIDING, ARRAY], { array: ['search'] })),
    ).toEqual(['heap', 'sliding', 'beta', 'search', 'array']);
  });

  it('keeps each entry object and returns every entry once', () => {
    const input = [ARRAY, HEAP, SLIDING, BETA, SEARCH];
    const ordered = orderDsaEntries(input, { beta: ['array', 'heap'] });
    expect(ordered).toHaveLength(input.length);
    for (const e of input) expect(ordered).toContain(e);
  });

  it('treats an entry missing from the prerequisites map as having none', () => {
    expect(slugs(orderDsaEntries([ARRAY], {}))).toEqual(['array']);
  });

  it('throws on a cycle, naming the entries in it', () => {
    const run = () =>
      orderDsaEntries([ARRAY, HEAP, SLIDING, BETA], {
        heap: ['sliding'],
        sliding: ['beta'],
        beta: ['heap'],
      });
    expect(run).toThrow(/cycle/i);
    expect(run).toThrow(/heap/);
    expect(run).toThrow(/sliding/);
    expect(run).toThrow(/beta/);
  });

  it('throws on a two-entry cycle, naming both', () => {
    const run = () =>
      orderDsaEntries([ARRAY, HEAP], { array: ['heap'], heap: ['array'] });
    expect(run).toThrow(/array/);
    expect(run).toThrow(/heap/);
  });

  it('throws on an unknown prerequisite slug, naming the entry and the slug', () => {
    const run = () => orderDsaEntries([ARRAY, HEAP], { heap: ['no-such-entry'] });
    expect(run).toThrow(/heap/);
    expect(run).toThrow(/no-such-entry/);
  });

  it('throws on a self-link, naming the entry', () => {
    const run = () => orderDsaEntries([ARRAY, HEAP], { heap: ['heap'] });
    expect(run).toThrow(/heap/);
  });
});

// --- Criterion 3: dsaPrerequisites ---

describe('dsaPrerequisites (criterion 3)', () => {
  it('returns the /dsa/<slug> links under ## Prerequisites, in order', () => {
    const md = [
      'Intro.',
      '',
      '## Prerequisites',
      '',
      'Read [arrays](/dsa/array) and [hash maps](/dsa/hash-map) first, then [sorting](/dsa/merge-sort).',
      '',
      '## The idea',
      '',
      'Text.',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['array', 'hash-map', 'merge-sort']);
  });

  it('reads links in a list under the heading', () => {
    const md = [
      '## Prerequisites',
      '',
      '- [Hash map](/dsa/hash-map): the lookup table.',
      '- [Two pointers](/dsa/two-pointers): the scan.',
      '',
      '## What it is',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['hash-map', 'two-pointers']);
  });

  it('de-duplicates, keeping the first appearance', () => {
    const md = [
      '## Prerequisites',
      '',
      '[A](/dsa/hash-map), [B](/dsa/array), [again](/dsa/hash-map).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['hash-map', 'array']);
  });

  it('returns [] when the section says there are none, in prose', () => {
    const md = [
      '## Prerequisites',
      '',
      'None: this entry only needs arrays and loops.',
      '',
      '## The idea',
      '',
      'See also [hash maps](/dsa/hash-map).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual([]);
  });

  it('returns [] when there is no Prerequisites section', () => {
    expect(dsaPrerequisites('## The idea\n\nSee [a](/dsa/hash-map).\n')).toEqual([]);
  });

  it('excludes /dsa/ links outside the section (see-also links)', () => {
    const md = [
      'Before: [x](/dsa/before).',
      '',
      '## Prerequisites',
      '',
      '[Array](/dsa/array).',
      '',
      '## Walkthrough',
      '',
      'Compare with [hash maps](/dsa/hash-map).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['array']);
  });

  it('keeps reading through a ### subheading but stops at the next ##', () => {
    const md = [
      '## Prerequisites',
      '',
      '[Array](/dsa/array).',
      '',
      '### Helpful',
      '',
      '[Heap](/dsa/heap).',
      '',
      '## When to use it',
      '',
      '[Queue](/dsa/queue).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['array', 'heap']);
  });

  it('excludes a link inside inline code or a code fence', () => {
    const md = [
      '## Prerequisites',
      '',
      'Real: [array](/dsa/array). Not a link: `[x](/dsa/inline-code)`.',
      '',
      '```md',
      '[fenced](/dsa/fenced-code)',
      '```',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['array']);
  });

  it('ignores a "## Prerequisites" line inside a code fence', () => {
    const md = [
      '```md',
      '## Prerequisites',
      '',
      '[fenced](/dsa/fenced)',
      '```',
      '',
      'Text with [a link](/dsa/outside).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual([]);
  });

  it('excludes catalog links, external links and the /dsa landing page', () => {
    const md = [
      '## Prerequisites',
      '',
      'See [caching](/systems-and-infrastructure/caching),',
      '[an article](https://example.com/dsa/hash-map), [the list](/dsa),',
      'and [array](/dsa/array).',
    ].join('\n');
    expect(dsaPrerequisites(md)).toEqual(['array']);
  });
});

// --- Criteria 2 and 4: the real entries ---

describe('DSA_ENTRIES and getDsaEntry (criteria 2 and 4)', () => {
  it('loads one entry per file, including the three reference entries', () => {
    expect(DSA_ENTRIES).toHaveLength(Object.keys(RAW).length);
    for (const [slug, kind] of REFERENCE_ENTRIES) {
      expect(getDsaEntry(slug)?.kind, slug).toBe(kind);
    }
  });

  it('is metadata only: exactly slug, title, summary, date and kind', () => {
    for (const e of DSA_ENTRIES) {
      expect(Object.keys(e).sort()).toEqual(['date', 'kind', 'slug', 'summary', 'title']);
    }
  });

  it('matches each file’s frontmatter', () => {
    for (const e of DSA_ENTRIES) {
      const { data } = parseFrontmatter(rawFor(e.slug));
      expect(e.title).toBe(data.title);
      expect(e.summary).toBe(data.summary);
      expect(e.date).toBe(data.date);
      expect(e.kind).toBe(data.kind);
    }
  });

  it('has well-formed values and unique slugs', () => {
    for (const e of DSA_ENTRIES) {
      expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.summary).not.toMatch(/\n/);
    }
    const slugs = DSA_ENTRIES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('finds binary-search by slug', () => {
    const found = getDsaEntry('binary-search');
    expect(found?.slug).toBe('binary-search');
    expect(found).toBe(DSA_ENTRIES.find((e) => e.slug === 'binary-search'));
  });

  it('returns undefined for an unknown slug', () => {
    expect(getDsaEntry('nope')).toBeUndefined();
    expect(getDsaEntry('url-shortener')).toBeUndefined();
  });

  it('getDsaPrerequisites matches the links in each real entry’s Prerequisites section', () => {
    for (const e of DSA_ENTRIES) {
      const expected = dsaPrerequisites(parseFrontmatter(rawFor(e.slug)).content);
      expect(
        getDsaPrerequisites(e.slug).map((p) => p.slug),
        e.slug,
      ).toEqual(expected);
      for (const p of getDsaPrerequisites(e.slug)) expect(p).toBe(getDsaEntry(p.slug));
    }
  });

  it('returns [] prerequisites for an unknown slug', () => {
    expect(getDsaPrerequisites('nope')).toEqual([]);
  });

  it('puts every real entry’s prerequisites before it', () => {
    const position = new Map(DSA_ENTRIES.map((e, i) => [e.slug, i]));
    for (const e of DSA_ENTRIES) {
      for (const slug of dsaPrerequisites(parseFrontmatter(rawFor(e.slug)).content)) {
        expect(position.has(slug), `${e.slug} -> ${slug}`).toBe(true);
        expect(position.get(slug)!, `${e.slug} -> ${slug}`).toBeLessThan(
          position.get(e.slug)!,
        );
      }
    }
  });

  it('is exactly orderDsaEntries over the real entries and their prerequisites', () => {
    const prereqs = Object.fromEntries(
      DSA_ENTRIES.map((e) => [
        e.slug,
        dsaPrerequisites(parseFrontmatter(rawFor(e.slug)).content),
      ]),
    );
    expect(orderDsaEntries([...DSA_ENTRIES].reverse(), prereqs)).toEqual(DSA_ENTRIES);
  });
});

describe('loadDsaEntryBody (criterion 4)', () => {
  it('resolves binary-search’s body without frontmatter', async () => {
    const body = await loadDsaEntryBody('binary-search');
    expect(body).toBe(parseFrontmatter(rawFor('binary-search')).content);
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body.startsWith('---')).toBe(false);
    expect(body).not.toMatch(/^kind:/m);
    expect(body).not.toMatch(/^summary:/m);
  });

  it('resolves every real entry to its own body', async () => {
    for (const e of DSA_ENTRIES) {
      expect(await loadDsaEntryBody(e.slug)).toBe(
        parseFrontmatter(rawFor(e.slug)).content,
      );
    }
  });

  it('returns the same promise for the same entry', () => {
    expect(loadDsaEntryBody('binary-search')).toBe(loadDsaEntryBody('binary-search'));
  });

  it('rejects for an unknown slug, naming it', async () => {
    await expect(loadDsaEntryBody('no-such-entry')).rejects.toThrow(/no-such-entry/);
  });

  it('loadAllDsaBodies returns every body keyed by slug', async () => {
    const bodies = await loadAllDsaBodies();
    expect([...bodies.keys()].sort()).toEqual(DSA_ENTRIES.map((e) => e.slug).sort());
    for (const e of DSA_ENTRIES) {
      expect(bodies.get(e.slug)).toBe(parseFrontmatter(rawFor(e.slug)).content);
    }
  });
});

describe('dsaKindLabel', () => {
  it('names each kind in text', () => {
    expect(dsaKindLabel('data-structure')).toBe('Data structure');
    expect(dsaKindLabel('pattern')).toBe('Pattern');
    expect(dsaKindLabel('algorithm')).toBe('Algorithm');
  });
});

describe('isDsaPath (criterion 5)', () => {
  it.each(['/dsa', '/dsa/two-pointers', '/dsa/binary-search'])('is true for %s', (p) => {
    expect(isDsaPath(p)).toBe(true);
  });

  it.each([
    '/',
    '/dsas',
    '/dsa-notes',
    '/ai-and-ml/dsa',
    '/system-design',
    '/system-design/url-shortener',
  ])('is false for %s', (p) => {
    expect(isDsaPath(p)).toBe(false);
  });
});

describe('/dsa is not a catalog section (criterion 15)', () => {
  it('has no dsa slug in the section registry', () => {
    expect(SECTIONS.map((s) => s.slug)).not.toContain('dsa');
  });
});
