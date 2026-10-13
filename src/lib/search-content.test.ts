import { describe, expect, it } from 'vitest';
import { getSection } from '@/content/registry';
import { bodyOnlyWordAt } from '@/test/content';
import { TOPICS } from './content';
import { DSA_ENTRIES } from './dsa';
import {
  ensureFullTextSearch,
  isFullTextSearchReady,
  searchContent,
  type SearchResult,
} from './search';
import { CASE_STUDIES } from './system-design';

// The real search index over the real content. docs/specs/content-dedupe.md,
// criterion 6: moving search onto one source shape changes no result. The
// tests run in file order against one module instance: the title-and-summary
// cases first, then the full-text ones, which load every body.

/** What a result row shows and where it goes: SearchDialog renders exactly
 * these. */
function rows(results: SearchResult[]) {
  return results.map(({ title, path, label }) => ({ title, path, label }));
}

const row = (title: string, path: string, label: string) => ({ title, path, label });

// Recorded on 2026-10-12 from the code before this change (each result's
// title, its dialog path and its dialog label, in order), with full text not
// yet loaded. Each query below matches a topic, a case study and a DSA entry
// at once, or is the exact title of one kind. A content change that moves
// these results is a reason to re-record them, not to change search.
const RECORDED: [string, ReturnType<typeof row>[]][] = [
  [
    'prompt engineering',
    [
      row(
        'Prompt Engineering',
        '/ai-and-ml/prompt-engineering',
        'AI and Machine Learning',
      ),
    ],
  ],
  [
    'url shortener',
    [
      row(
        'Design a URL Shortener (like TinyURL)',
        '/system-design/url-shortener',
        'System Design',
      ),
    ],
  ],
  [
    'binary search',
    [
      row('Binary Search', '/dsa/binary-search', 'DSA'),
      row('Binary Search Tree', '/dsa/binary-search-tree', 'DSA'),
    ],
  ],
  [
    'queue',
    [
      row('Stacks and Queues', '/dsa/stacks-and-queues', 'DSA'),
      row(
        'Message Queues and Dead Letter Queues',
        '/systems-and-infrastructure/message-queues',
        'Systems and Infrastructure',
      ),
      row('Heap and Priority Queue', '/dsa/heap', 'DSA'),
      row(
        'Design a Notification System (like a push, email and SMS service)',
        '/system-design/notification-system',
        'System Design',
      ),
      row('Breadth-First Search', '/dsa/breadth-first-search', 'DSA'),
      row(
        'Worker Pools',
        '/systems-and-infrastructure/worker-pools',
        'Systems and Infrastructure',
      ),
    ],
  ],
  [
    'hash',
    [
      row('Hash Map', '/dsa/hash-map', 'DSA'),
      row(
        'Consistent Hashing',
        '/systems-and-infrastructure/consistent-hashing',
        'Systems and Infrastructure',
      ),
      row(
        'Encoding, Hashing and Encryption',
        '/computing-fundamentals/encoding-hashing-and-encryption',
        'Computing Fundamentals',
      ),
      row(
        'Design Cloud File Storage (like Google Drive or Dropbox)',
        '/system-design/file-storage',
        'System Design',
      ),
      row(
        'Distributed Locks',
        '/systems-and-infrastructure/distributed-locks',
        'Systems and Infrastructure',
      ),
      row(
        'Git Rebase vs. Merge',
        '/engineering-practices/git-rebase-vs-merge',
        'Engineering Practices',
      ),
      row(
        'Workflow Engines and Durable Execution',
        '/systems-and-infrastructure/workflow-engines',
        'Systems and Infrastructure',
      ),
      row(
        'Design a Ticket Booking System (like Ticketmaster)',
        '/system-design/ticket-booking',
        'System Design',
      ),
    ],
  ],
  [
    'search',
    [
      row('Vector Search', '/ai-and-ml/vector-search', 'AI and Machine Learning'),
      row('Binary Search', '/dsa/binary-search', 'DSA'),
      row('Breadth-First Search', '/dsa/breadth-first-search', 'DSA'),
      row('Depth-First Search', '/dsa/depth-first-search', 'DSA'),
      row('Binary Search Tree', '/dsa/binary-search-tree', 'DSA'),
      row(
        'Hybrid Search and Reranking',
        '/ai-and-ml/hybrid-search-and-reranking',
        'AI and Machine Learning',
      ),
      row(
        'Design a Web Search Engine (like Google Search)',
        '/system-design/search-engine',
        'System Design',
      ),
      row(
        'Focus and Distraction',
        '/focus-and-attention/why-you-cant-focus-anymore',
        'Focus and Attention',
      ),
    ],
  ],
];

// Every item the index holds, as the dialog showed it before this change: a
// topic under its section's label, a case study under "System Design", a DSA
// entry under "DSA".
const EVERY_ITEM = [
  ...TOPICS.map((t) => ({
    ...row(t.title, `/${t.section}/${t.slug}`, getSection(t.section)?.label ?? t.section),
    summary: t.summary,
  })),
  ...CASE_STUDIES.map((c) => ({
    ...row(c.title, `/system-design/${c.slug}`, 'System Design'),
    summary: c.summary,
  })),
  ...DSA_ENTRIES.map((e) => ({
    ...row(e.title, `/dsa/${e.slug}`, 'DSA'),
    summary: e.summary,
  })),
];

// One file per kind, and its search path. Each is searched for by a word only
// its body holds, read from the file at test time so no published phrase is
// pinned (docs/specs/harness-follow-ups.md, criterion 9).
const BODY_ONLY: [string, string, string][] = [
  [
    'topic',
    '/src/content/engineering-practices/plan-before-you-build.md',
    '/engineering-practices/plan-before-you-build',
  ],
  [
    'case study',
    '/src/system-design/case-studies/url-shortener.md',
    '/system-design/url-shortener',
  ],
  ['DSA entry', '/src/dsa/entries/binary-search.md', '/dsa/binary-search'],
];

describe('searchContent before full text loads (content-dedupe criterion 6)', () => {
  it('has not loaded full text yet', () => {
    expect(isFullTextSearchReady()).toBe(false);
  });

  it.each(RECORDED)('gives the recorded results for "%s"', (query, expected) => {
    expect(rows(searchContent(query))).toEqual(expected);
  });

  it('gives each result exactly key, path, label, title and summary', () => {
    const results = searchContent('queue');
    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(Object.keys(result).sort()).toEqual([
        'key',
        'label',
        'path',
        'summary',
        'title',
      ]);
    }
  });

  it('gives results keys that are unique (they are the dialog’s list keys)', () => {
    const keys = searchContent('ing', EVERY_ITEM.length).map((r) => r.key);
    expect(keys.length).toBeGreaterThan(20);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(EVERY_ITEM.map((item) => [item.path, item] as const))(
    'finds %s by its exact title, with its path, label and summary',
    (_path, item) => {
      const hit = searchContent(item.title, 50).find((r) => r.path === item.path);
      expect(hit).toBeDefined();
      expect({
        title: hit!.title,
        path: hit!.path,
        label: hit!.label,
        summary: hit!.summary,
      }).toEqual(item);
    },
  );

  it.each(BODY_ONLY)('does not find the %s by a word only its body holds', (_k, file) => {
    expect(searchContent(bodyOnlyWordAt(file))).toEqual([]);
  });

  it('respects the limit argument', () => {
    expect(searchContent('database', 50).length).toBeGreaterThan(2);
    expect(searchContent('database', 1)).toHaveLength(1);
    expect(searchContent('database', 2).length).toBeLessThanOrEqual(2);
  });
});

describe('searchContent once full text has loaded (content-dedupe criterion 6)', () => {
  it.each(BODY_ONLY)(
    'finds the %s by a word only its body holds, ranked first',
    async (_kind, file, path) => {
      await ensureFullTextSearch();
      expect(isFullTextSearchReady()).toBe(true);
      const [first] = searchContent(bodyOnlyWordAt(file));
      expect(first).toBeDefined();
      expect({
        title: first.title,
        path: first.path,
        label: first.label,
        summary: first.summary,
      }).toEqual(EVERY_ITEM.find((item) => item.path === path));
    },
  );
});
