import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaseStudy, Topic } from '@/types';
import { createSearchIndex, type SearchResult } from './search';

// Fixture words are deliberately long and unlike each other so fuzzy matching
// (threshold 0.3) can't cross-match between fixture entries.
const TOPIC_A: Topic = {
  section: 'alpha',
  slug: 'aardvark-migration',
  title: 'Aardvark Migration Patterns',
  summary: 'How nocturnal mammals relocate across savannas.',
  date: '2026-01-01',
};

const TOPIC_B: Topic = {
  section: 'alpha',
  slug: 'bioluminescent-squid',
  title: 'Bioluminescent Squid',
  summary: 'Cephalopods that glow in the deep.',
  date: '2026-01-02',
};

// Case studies are metadata only, like topics: the body comes from
// `loadCaseStudyBodies` (keyed by slug) on the full-text path.
const CASE_STUDY: CaseStudy = {
  slug: 'flux-capacitor',
  title: 'Design a Flux Capacitor Service',
  summary: 'Diagnosing temporal hardware.',
  date: '2026-01-03',
  order: 1,
};

const BODY_A = 'The obsidianlattice reconciliation step runs at dawn.\n';
const BODY_B = 'Nothing distinctive here beyond quokka habitats.\n';
const CASE_STUDY_BODY = 'Replace the tungstenresonance coil before anything else.\n';

function bodiesMap(): Map<string, string> {
  return new Map([
    ['alpha/aardvark-migration', BODY_A],
    ['alpha/bioluminescent-squid', BODY_B],
  ]);
}

function caseStudyBodiesMap(): Map<string, string> {
  return new Map([['flux-capacitor', CASE_STUDY_BODY]]);
}

function keys(results: SearchResult[]): string[] {
  return results.map((r) =>
    r.kind === 'topic'
      ? `topic:${r.topic.section}/${r.topic.slug}`
      : r.kind === 'dsa'
        ? `dsa:${r.entry.slug}`
        : `caseStudy:${r.caseStudy.slug}`,
  );
}

function makeIndex(
  loadTopicBodies: () => Promise<Map<string, string>>,
  loadCaseStudyBodies: () => Promise<Map<string, string>> = async () =>
    caseStudyBodiesMap(),
) {
  return createSearchIndex({
    topics: [TOPIC_A, TOPIC_B],
    caseStudies: [CASE_STUDY],
    dsaEntries: [],
    loadTopicBodies,
    loadCaseStudyBodies,
    loadDsaBodies: async () => new Map(),
  });
}

describe('createSearchIndex before full text loads (criterion 5)', () => {
  it('returns nothing for an empty or whitespace-only query', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(index.searchContent('')).toEqual([]);
    expect(index.searchContent('   ')).toEqual([]);
  });

  it('finds a topic by title', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(keys(index.searchContent('Aardvark Migration'))).toContain(
      'topic:alpha/aardvark-migration',
    );
  });

  it('finds a topic by summary', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(keys(index.searchContent('nocturnal mammals relocate'))).toContain(
      'topic:alpha/aardvark-migration',
    );
  });

  it('finds a case study by title and by summary (criterion 11)', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(keys(index.searchContent('Flux Capacitor Service'))).toContain(
      'caseStudy:flux-capacitor',
    );
    expect(keys(index.searchContent('Diagnosing temporal hardware'))).toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('carries the full CaseStudy on a case-study result', () => {
    const index = makeIndex(async () => bodiesMap());
    const hit = index
      .searchContent('Flux Capacitor Service')
      .find((r) => r.kind === 'caseStudy');
    expect(hit).toEqual({ kind: 'caseStudy', caseStudy: CASE_STUDY });
  });

  it('does not find a case study by a phrase only in its body (criterion 11)', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(keys(index.searchContent('tungstenresonance'))).not.toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('does not find a topic by a phrase only in its body', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(keys(index.searchContent('obsidianlattice reconciliation'))).not.toContain(
      'topic:alpha/aardvark-migration',
    );
  });

  it('reports full-text search as not ready', () => {
    const index = makeIndex(async () => bodiesMap());
    expect(index.isFullTextSearchReady()).toBe(false);
  });
});

describe('createSearchIndex after ensureFullTextSearch (criterion 6)', () => {
  it('finds a topic by a phrase only in its body, and flips the ready flag', async () => {
    const index = makeIndex(async () => bodiesMap());
    expect(index.isFullTextSearchReady()).toBe(false);
    await index.ensureFullTextSearch();
    expect(index.isFullTextSearchReady()).toBe(true);
    expect(keys(index.searchContent('obsidianlattice reconciliation'))).toContain(
      'topic:alpha/aardvark-migration',
    );
  });

  it('finds a case study by a phrase only in its body afterwards (criterion 11)', async () => {
    const index = makeIndex(async () => bodiesMap());
    await index.ensureFullTextSearch();
    expect(keys(index.searchContent('tungstenresonance'))).toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('still finds titles and summaries afterwards', async () => {
    const index = makeIndex(async () => bodiesMap());
    await index.ensureFullTextSearch();
    expect(keys(index.searchContent('Bioluminescent Squid'))).toContain(
      'topic:alpha/bioluminescent-squid',
    );
    expect(keys(index.searchContent('Cephalopods that glow'))).toContain(
      'topic:alpha/bioluminescent-squid',
    );
    expect(keys(index.searchContent('Flux Capacitor Service'))).toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('keeps the flag false until the case-study bodies have loaded too', async () => {
    let resolve!: (bodies: Map<string, string>) => void;
    const pending = new Promise<Map<string, string>>((r) => {
      resolve = r;
    });
    const index = makeIndex(
      async () => bodiesMap(),
      () => pending,
    );

    const ensured = index.ensureFullTextSearch();
    await new Promise((r) => setTimeout(r, 0));
    expect(index.isFullTextSearchReady()).toBe(false);

    resolve(caseStudyBodiesMap());
    await ensured;
    expect(index.isFullTextSearchReady()).toBe(true);
    expect(keys(index.searchContent('tungstenresonance'))).toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('loads case-study bodies once across repeated calls, and retries after a case-study load fails', async () => {
    const loadCaseStudyBodies = vi
      .fn<() => Promise<Map<string, string>>>()
      .mockRejectedValueOnce(new Error('case study chunk failed'))
      .mockResolvedValueOnce(caseStudyBodiesMap());
    const index = makeIndex(async () => bodiesMap(), loadCaseStudyBodies);

    await expect(index.ensureFullTextSearch()).rejects.toThrow('case study chunk failed');
    expect(index.isFullTextSearchReady()).toBe(false);
    expect(keys(index.searchContent('Flux Capacitor Service'))).toContain(
      'caseStudy:flux-capacitor',
    );

    await index.ensureFullTextSearch();
    await index.ensureFullTextSearch();
    expect(loadCaseStudyBodies).toHaveBeenCalledTimes(2);
    expect(index.isFullTextSearchReady()).toBe(true);
    expect(keys(index.searchContent('tungstenresonance'))).toContain(
      'caseStudy:flux-capacitor',
    );
  });

  it('keeps the flag false until the load resolves', async () => {
    let resolve!: (bodies: Map<string, string>) => void;
    const pending = new Promise<Map<string, string>>((r) => {
      resolve = r;
    });
    const index = makeIndex(() => pending);

    const ensured = index.ensureFullTextSearch();
    await Promise.resolve();
    expect(index.isFullTextSearchReady()).toBe(false);
    expect(keys(index.searchContent('obsidianlattice reconciliation'))).not.toContain(
      'topic:alpha/aardvark-migration',
    );

    resolve(bodiesMap());
    await ensured;
    expect(index.isFullTextSearchReady()).toBe(true);
  });

  it('reuses the work: repeated and concurrent calls load bodies once', async () => {
    const loadTopicBodies = vi.fn(async () => bodiesMap());
    const index = makeIndex(loadTopicBodies);

    await Promise.all([index.ensureFullTextSearch(), index.ensureFullTextSearch()]);
    await index.ensureFullTextSearch();
    await index.ensureFullTextSearch();

    expect(loadTopicBodies).toHaveBeenCalledTimes(1);
    expect(index.isFullTextSearchReady()).toBe(true);
  });

  it('leaves the flag false when the load rejects, keeps title search working, and retries on a later call', async () => {
    const loadTopicBodies = vi
      .fn<() => Promise<Map<string, string>>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce(bodiesMap());
    const index = makeIndex(loadTopicBodies);

    await expect(index.ensureFullTextSearch()).rejects.toThrow('chunk failed');
    expect(index.isFullTextSearchReady()).toBe(false);
    expect(keys(index.searchContent('Aardvark Migration'))).toContain(
      'topic:alpha/aardvark-migration',
    );
    expect(keys(index.searchContent('obsidianlattice reconciliation'))).not.toContain(
      'topic:alpha/aardvark-migration',
    );

    await index.ensureFullTextSearch();
    expect(loadTopicBodies).toHaveBeenCalledTimes(2);
    expect(index.isFullTextSearchReady()).toBe(true);
    expect(keys(index.searchContent('obsidianlattice reconciliation'))).toContain(
      'topic:alpha/aardvark-migration',
    );
  });

  it('keeps separate instances independent', async () => {
    const first = makeIndex(async () => bodiesMap());
    const second = makeIndex(async () => bodiesMap());
    await first.ensureFullTextSearch();
    expect(first.isFullTextSearchReady()).toBe(true);
    expect(second.isFullTextSearchReady()).toBe(false);
  });
});

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

  it('does not find plan-before-you-build by a body-only phrase until ensureFullTextSearch runs', async () => {
    const search = await import('./search');
    expect(search.isFullTextSearchReady()).toBe(false);
    expect(keys(search.searchContent('thin vertical slice'))).not.toContain(
      'topic:engineering-practices/plan-before-you-build',
    );

    await search.ensureFullTextSearch();

    expect(search.isFullTextSearchReady()).toBe(true);
    expect(keys(search.searchContent('thin vertical slice'))).toContain(
      'topic:engineering-practices/plan-before-you-build',
    );
  });

  it('still finds a topic by title and the URL shortener by its title before full text loads', async () => {
    const search = await import('./search');
    const { getCaseStudy } = await import('./system-design');
    expect(keys(search.searchContent('prompt engineering'))).toContain(
      'topic:ai-and-ml/prompt-engineering',
    );
    expect(search.isFullTextSearchReady()).toBe(false);
    expect(keys(search.searchContent(getCaseStudy('url-shortener')!.title))).toContain(
      'caseStudy:url-shortener',
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
