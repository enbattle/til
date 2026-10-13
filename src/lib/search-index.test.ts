import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyOnlyWord } from '@/test/content';
import { createSearchIndex, type SearchResult, type SearchSource } from './search';

// docs/specs/content-dedupe.md, design item 6 and criterion 6: the index takes
// a list of sources, `createSearchIndex(sources)`, each `{ items, loadBodies }`.
// An item is `{ key, path, label, title, summary }`; a result is the item
// itself, so there is one result shape for topics, case studies and DSA
// entries. `loadBodies()` resolves every body of that source in a Map keyed by
// the items' `key`. Titles and summaries are searchable at once; bodies join
// once `ensureFullTextSearch` has loaded every source. (search-dsa.test.ts's
// cases are the DSA row of the describe.each below.)

// Fixture words are deliberately long and unlike each other so fuzzy matching
// (threshold 0.3) can't cross-match between fixture entries.
const TOPIC_A: SearchResult = {
  key: 'alpha/aardvark-migration',
  path: '/alpha/aardvark-migration',
  label: 'Alpha Section',
  title: 'Aardvark Migration Patterns',
  summary: 'How nocturnal mammals relocate across savannas.',
};

const TOPIC_B: SearchResult = {
  key: 'alpha/bioluminescent-squid',
  path: '/alpha/bioluminescent-squid',
  label: 'Alpha Section',
  title: 'Bioluminescent Squid',
  summary: 'Cephalopods that glow in the deep.',
};

const CASE_STUDY: SearchResult = {
  key: 'system-design/flux-capacitor',
  path: '/system-design/flux-capacitor',
  label: 'System Design',
  title: 'Design a Flux Capacitor Service',
  summary: 'Diagnosing temporal hardware.',
};

const ENTRY: SearchResult = {
  key: 'dsa/quokka-heap',
  path: '/dsa/quokka-heap',
  label: 'DSA',
  title: 'Quokka Heap',
  summary: 'A marsupial priority queue.',
};

const TOPIC_BODIES = new Map([
  [TOPIC_A.key, 'The obsidianlattice reconciliation step runs at dawn.\n'],
  [TOPIC_B.key, 'Nothing distinctive here beyond quokka habitats.\n'],
]);
const CASE_STUDY_BODIES = new Map([
  [CASE_STUDY.key, 'Replace the tungstenresonance coil before anything else.\n'],
]);
const DSA_BODIES = new Map([
  [ENTRY.key, 'The zirconiumpendulum sift-down runs in logarithmic time.\n'],
]);

type Loader = () => Promise<Map<string, string>>;

interface Loaders {
  topics?: Loader;
  caseStudies?: Loader;
  dsa?: Loader;
}

/** The three fixture sources in the app's order (topics, case studies, DSA),
 * each loader replaceable. */
function sources(loaders: Loaders = {}): SearchSource[] {
  return [
    {
      items: [TOPIC_A, TOPIC_B],
      loadBodies: loaders.topics ?? (async () => TOPIC_BODIES),
    },
    {
      items: [CASE_STUDY],
      loadBodies: loaders.caseStudies ?? (async () => CASE_STUDY_BODIES),
    },
    { items: [ENTRY], loadBodies: loaders.dsa ?? (async () => DSA_BODIES) },
  ];
}

function makeIndex(loaders: Loaders = {}) {
  return createSearchIndex(sources(loaders));
}

function paths(results: SearchResult[]): string[] {
  return results.map((r) => r.path);
}

describe('createSearchIndex over sources (content-dedupe criterion 6)', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    const index = makeIndex();
    expect(index.searchContent('')).toEqual([]);
    expect(index.searchContent('   ')).toEqual([]);
  });

  it('returns the items themselves as results', () => {
    const index = makeIndex();
    const [hit] = index.searchContent('Flux Capacitor Service');
    expect(hit).toBe(CASE_STUDY);
    expect(Object.keys(hit).sort()).toEqual(['key', 'label', 'path', 'summary', 'title']);
  });

  it('breaks a ranking tie by source order, then item order', () => {
    const twin = (key: string): SearchResult => ({
      key,
      path: `/${key}`,
      label: key,
      title: 'Xylophone Tessellation',
      summary: 'Identical.',
    });
    const [first, second, third] = [twin('one'), twin('two'), twin('three')];
    const none = async () => new Map<string, string>();
    const forward = createSearchIndex([
      { items: [first, second], loadBodies: none },
      { items: [third], loadBodies: none },
    ]);
    expect(forward.searchContent('Xylophone Tessellation')).toEqual([
      first,
      second,
      third,
    ]);
    const reversed = createSearchIndex([
      { items: [third], loadBodies: none },
      { items: [first, second], loadBodies: none },
    ]);
    expect(reversed.searchContent('Xylophone Tessellation')).toEqual([
      third,
      first,
      second,
    ]);
  });

  it('respects the limit argument', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      key: `k${i}`,
      path: `/k${i}`,
      label: 'L',
      title: `Pelican ${i}`,
      summary: 'Seabirds.',
    }));
    const index = createSearchIndex([{ items: many, loadBodies: async () => new Map() }]);
    expect(index.searchContent('pelican')).toHaveLength(8);
    expect(index.searchContent('pelican', 3)).toHaveLength(3);
    expect(index.searchContent('pelican', 50)).toHaveLength(12);
  });

  it('treats an item with no body in its map as having an empty body', async () => {
    const index = makeIndex({ topics: async () => new Map([[TOPIC_A.key, 'x\n']]) });
    await index.ensureFullTextSearch();
    expect(index.isFullTextSearchReady()).toBe(true);
    expect(paths(index.searchContent('Bioluminescent Squid'))).toEqual([TOPIC_B.path]);
  });

  it('reads each source’s bodies by its own items’ keys', async () => {
    // The same key in two sources: each item gets its own source's body.
    const left = { ...TOPIC_A, key: 'shared', path: '/left' };
    const right = { ...ENTRY, key: 'shared', path: '/right' };
    const index = createSearchIndex([
      {
        items: [left],
        loadBodies: async () => new Map([['shared', 'wombatchronicle\n']]),
      },
      { items: [right], loadBodies: async () => new Map([['shared', 'dingoalmanac\n']]) },
    ]);
    await index.ensureFullTextSearch();
    expect(paths(index.searchContent('wombatchronicle'))).toEqual(['/left']);
    expect(paths(index.searchContent('dingoalmanac'))).toEqual(['/right']);
  });

  it('works with no sources at all', async () => {
    const index = createSearchIndex([]);
    expect(index.searchContent('anything')).toEqual([]);
    await index.ensureFullTextSearch();
    expect(index.isFullTextSearchReady()).toBe(true);
  });

  it('keeps separate instances independent', async () => {
    const first = makeIndex();
    const second = makeIndex();
    await first.ensureFullTextSearch();
    expect(first.isFullTextSearchReady()).toBe(true);
    expect(second.isFullTextSearchReady()).toBe(false);
  });

  it('loads every source’s bodies once across repeated and concurrent calls', async () => {
    const topics = vi.fn(async () => TOPIC_BODIES);
    const caseStudies = vi.fn(async () => CASE_STUDY_BODIES);
    const dsa = vi.fn(async () => DSA_BODIES);
    const index = makeIndex({ topics, caseStudies, dsa });
    await Promise.all([index.ensureFullTextSearch(), index.ensureFullTextSearch()]);
    await index.ensureFullTextSearch();
    expect(topics).toHaveBeenCalledTimes(1);
    expect(caseStudies).toHaveBeenCalledTimes(1);
    expect(dsa).toHaveBeenCalledTimes(1);
  });
});

// One row per kind: what used to be three result variants and three loader
// dependencies is one source shape, so each kind gets the same cases.
describe.each([
  {
    kind: 'topic',
    item: TOPIC_A,
    summaryQuery: 'nocturnal mammals relocate',
    bodyWord: 'obsidianlattice reconciliation',
    loader: 'topics' as const,
    bodies: TOPIC_BODIES,
  },
  {
    kind: 'case study',
    item: CASE_STUDY,
    summaryQuery: 'Diagnosing temporal hardware',
    bodyWord: 'tungstenresonance',
    loader: 'caseStudies' as const,
    bodies: CASE_STUDY_BODIES,
  },
  {
    kind: 'DSA entry',
    item: ENTRY,
    summaryQuery: 'marsupial priority',
    bodyWord: 'zirconiumpendulum',
    loader: 'dsa' as const,
    bodies: DSA_BODIES,
  },
])(
  'a $kind source (content-dedupe criterion 6)',
  ({ item, summaryQuery, bodyWord, loader, bodies }) => {
    it('is found by title before full text loads', () => {
      const index = makeIndex();
      expect(index.searchContent(item.title)[0]).toEqual(item);
    });

    it('is found by summary before full text loads', () => {
      expect(makeIndex().searchContent(summaryQuery)).toContainEqual(item);
    });

    it('is not found by a body-only word until ensureFullTextSearch, then is', async () => {
      const index = makeIndex();
      expect(index.isFullTextSearchReady()).toBe(false);
      expect(index.searchContent(bodyWord)).toEqual([]);
      await index.ensureFullTextSearch();
      expect(index.isFullTextSearchReady()).toBe(true);
      expect(index.searchContent(bodyWord)).toEqual([item]);
      // Titles and summaries still match afterwards.
      expect(index.searchContent(item.title)[0]).toEqual(item);
    });

    it('keeps the ready flag false until this source’s bodies have loaded', async () => {
      let resolve!: (value: Map<string, string>) => void;
      const pending = new Promise<Map<string, string>>((r) => {
        resolve = r;
      });
      const index = makeIndex({ [loader]: () => pending });

      const ensured = index.ensureFullTextSearch();
      await new Promise((r) => setTimeout(r, 0));
      expect(index.isFullTextSearchReady()).toBe(false);
      expect(index.searchContent(bodyWord)).toEqual([]);

      resolve(bodies);
      await ensured;
      expect(index.isFullTextSearchReady()).toBe(true);
      expect(index.searchContent(bodyWord)).toEqual([item]);
    });

    it('is not ready when this source’s bodies fail, keeps title search, and retries on the next call', async () => {
      const load = vi
        .fn<Loader>()
        .mockRejectedValueOnce(new Error('chunk failed'))
        .mockResolvedValueOnce(bodies);
      const index = makeIndex({ [loader]: load });

      await expect(index.ensureFullTextSearch()).rejects.toThrow('chunk failed');
      expect(index.isFullTextSearchReady()).toBe(false);
      expect(index.searchContent(item.title)[0]).toEqual(item);
      expect(index.searchContent(bodyWord)).toEqual([]);

      await index.ensureFullTextSearch();
      await index.ensureFullTextSearch();
      expect(load).toHaveBeenCalledTimes(2);
      expect(index.isFullTextSearchReady()).toBe(true);
      expect(index.searchContent(bodyWord)).toEqual([item]);
    });
  },
);

describe('the default search instance (criteria 5, 6, 7)', () => {
  // The default instance is module state, so each case gets a fresh copy of
  // the module rather than depending on test order.
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('./content');
    vi.resetModules();
  });

  it('does not find plan-before-you-build by a body-only word until ensureFullTextSearch runs', async () => {
    // Read from the topic's file, not pinned (docs/specs/harness-follow-ups.md,
    // criterion 9).
    const word = bodyOnlyWord('engineering-practices', 'plan-before-you-build');
    const path = '/engineering-practices/plan-before-you-build';
    const search = await import('./search');
    expect(search.isFullTextSearchReady()).toBe(false);
    expect(paths(search.searchContent(word))).not.toContain(path);

    await search.ensureFullTextSearch();

    expect(search.isFullTextSearchReady()).toBe(true);
    expect(paths(search.searchContent(word))).toContain(path);
  });

  it('still finds a topic by title and the URL shortener by its title before full text loads', async () => {
    const search = await import('./search');
    const { getCaseStudy } = await import('./system-design');
    expect(paths(search.searchContent('prompt engineering'))).toContain(
      '/ai-and-ml/prompt-engineering',
    );
    expect(search.isFullTextSearchReady()).toBe(false);
    expect(paths(search.searchContent(getCaseStudy('url-shortener')!.title))).toContain(
      '/system-design/url-shortener',
    );
  });

  it('loads bodies through the content module and retries after a failed load', async () => {
    const actual = await vi.importActual<typeof import('./content')>('./content');
    const loadAllTopicBodies = vi
      .fn<() => Promise<Map<string, string>>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockImplementationOnce(() => actual.loadAllTopicBodies());
    vi.doMock('./content', () => ({ ...actual, loadAllTopicBodies }));

    const search = await import('./search');
    await expect(search.ensureFullTextSearch()).rejects.toThrow('chunk failed');
    expect(search.isFullTextSearchReady()).toBe(false);

    await search.ensureFullTextSearch();
    expect(loadAllTopicBodies).toHaveBeenCalledTimes(2);
    expect(search.isFullTextSearchReady()).toBe(true);
  });
});
