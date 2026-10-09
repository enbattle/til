import { describe, expect, it } from 'vitest';
import type { CaseStudy, DsaEntry, Topic } from '@/types';
import { TOPICS } from './content';
import { DSA_ENTRIES, getDsaEntry } from './dsa';
import { parseFrontmatter } from './frontmatter';
import {
  createSearchIndex,
  ensureFullTextSearch,
  searchContent,
  type SearchResult,
} from './search';
import { CASE_STUDIES } from './system-design';

// docs/specs/dsa-tab.md, criterion 14: DSA entries join search as
// `{ kind: 'dsa', entry }`, with title and summary searchable at once and
// bodies joining on the full-text path.

const TOPIC: Topic = {
  section: 'alpha',
  slug: 'aardvark-migration',
  title: 'Aardvark Migration Patterns',
  summary: 'How nocturnal mammals relocate across savannas.',
  date: '2026-01-01',
  words: 1,
};

const CASE_STUDY: CaseStudy = {
  slug: 'flux-capacitor',
  title: 'Design a Flux Capacitor Service',
  summary: 'Diagnosing temporal hardware.',
  date: '2026-01-03',
  order: 1,
  words: 1,
};

const ENTRY: DsaEntry = {
  slug: 'quokka-heap',
  title: 'Quokka Heap',
  summary: 'A marsupial priority queue.',
  date: '2026-01-04',
  kind: 'data-structure',
  words: 1,
};

const ENTRY_BODY = 'The zirconiumpendulum sift-down runs in logarithmic time.\n';

function keys(results: SearchResult[]): string[] {
  return results.map((r) =>
    r.kind === 'topic'
      ? `topic:${r.topic.section}/${r.topic.slug}`
      : r.kind === 'caseStudy'
        ? `caseStudy:${r.caseStudy.slug}`
        : `dsa:${r.entry.slug}`,
  );
}

function makeIndex(loadDsaBodies = async () => new Map([['quokka-heap', ENTRY_BODY]])) {
  return createSearchIndex({
    topics: [TOPIC],
    caseStudies: [CASE_STUDY],
    dsaEntries: [ENTRY],
    loadTopicBodies: async () => new Map([['alpha/aardvark-migration', 'Topic body.\n']]),
    loadCaseStudyBodies: async () => new Map([['flux-capacitor', 'Case body.\n']]),
    loadDsaBodies,
  });
}

describe('createSearchIndex with DSA entries (criterion 14)', () => {
  it('finds a DSA entry by title before full text loads', () => {
    const index = makeIndex();
    expect(keys(index.searchContent('Quokka Heap'))).toContain('dsa:quokka-heap');
  });

  it('finds a DSA entry by summary before full text loads', () => {
    expect(keys(makeIndex().searchContent('marsupial priority'))).toContain(
      'dsa:quokka-heap',
    );
  });

  it('carries the full entry on a DSA result', () => {
    const hit = makeIndex()
      .searchContent('Quokka Heap')
      .find((r) => r.kind === 'dsa');
    expect(hit).toEqual({ kind: 'dsa', entry: ENTRY });
  });

  it('matches a body-only word only after ensureFullTextSearch', async () => {
    const index = makeIndex();
    expect(keys(index.searchContent('zirconiumpendulum'))).toEqual([]);
    await index.ensureFullTextSearch();
    expect(keys(index.searchContent('zirconiumpendulum'))).toEqual(['dsa:quokka-heap']);
  });

  it('loads DSA bodies once, together with the other bodies', async () => {
    let calls = 0;
    const index = makeIndex(async () => {
      calls++;
      return new Map([['quokka-heap', ENTRY_BODY]]);
    });
    await Promise.all([index.ensureFullTextSearch(), index.ensureFullTextSearch()]);
    await index.ensureFullTextSearch();
    expect(calls).toBe(1);
    expect(index.isFullTextSearchReady()).toBe(true);
  });

  it('is not ready, and retries, when the DSA bodies fail to load', async () => {
    let fail = true;
    const index = makeIndex(async () => {
      if (fail) throw new Error('chunk failed');
      return new Map([['quokka-heap', ENTRY_BODY]]);
    });
    await expect(index.ensureFullTextSearch()).rejects.toThrow('chunk failed');
    expect(index.isFullTextSearchReady()).toBe(false);
    fail = false;
    await index.ensureFullTextSearch();
    expect(keys(index.searchContent('zirconiumpendulum'))).toEqual(['dsa:quokka-heap']);
  });
});

describe('the real search index finds DSA entries (criterion 14)', () => {
  it('finds binary-search by "binary search" at once', () => {
    expect(keys(searchContent('binary search'))).toContain('dsa:binary-search');
  });

  it.each(DSA_ENTRIES.map((e) => [e.slug, e] as const))(
    'finds %s by its exact title',
    (_slug, entry) => {
      const hit = searchContent(entry.title, 50).find(
        (r) => r.kind === 'dsa' && r.entry.slug === entry.slug,
      );
      expect(hit).toEqual({ kind: 'dsa', entry });
    },
  );

  it('finds binary-search by a body-only phrase once full text has loaded', async () => {
    const raw = import.meta.glob('/src/dsa/entries/binary-search.md', {
      query: '?raw',
      import: 'default',
      eager: true,
    }) as Record<string, string>;
    const { content } = parseFrontmatter(raw['/src/dsa/entries/binary-search.md']);
    const entry = getDsaEntry('binary-search')!;
    // A heading read from the entry's own file now, which the title and summary
    // don't contain, so only the body can match it; no published phrase is
    // pinned here (docs/specs/harness-follow-ups.md, criterion 9).
    const phrase = [...content.matchAll(/^##+ +(.+)$/gm)]
      .map(([, heading]) => heading.trim())
      .find(
        (heading) =>
          // Plain words within Fuse's 32-character pattern length.
          /^[A-Za-z ]{4,32}$/.test(heading) &&
          !`${entry.title} ${entry.summary}`
            .toLowerCase()
            .includes(heading.toLowerCase()),
      );
    expect(phrase).toBeDefined();
    await ensureFullTextSearch();
    // Every document may match a template heading, so the limit covers the
    // whole corpus: this tests that the body is searched, not how it ranks.
    const everything = TOPICS.length + CASE_STUDIES.length + DSA_ENTRIES.length;
    expect(keys(searchContent(phrase!, everything))).toContain('dsa:binary-search');
  });
});
