import { describe, expect, it } from 'vitest';
import { getSection } from '@/content/registry';
import { bodyOnlyWordAt } from '@/test/content';
import { TOPICS } from './content';
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
// yet loaded, and re-recorded on 2026-10-13 against the corpus left once the
// DSA tab is removed (docs/specs/remove-dsa-tab.md, criterion 3): search
// indexes only topics and case studies, so "binary search", which used to
// match only DSA entries, now matches nothing. Each other query below matches
// a topic and a case study at once, or is the exact title of one kind. A
// content change that moves these results is a reason to re-record them, not
// to change search.
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
  ['binary search', []],
  [
    'queue',
    [
      row(
        'Message Queues and Dead Letter Queues',
        '/systems-and-infrastructure/message-queues',
        'Systems and Infrastructure',
      ),
      row(
        'Design a Notification System (like a push, email and SMS service)',
        '/system-design/notification-system',
        'System Design',
      ),
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
      row(
        'Backpressure',
        '/systems-and-infrastructure/backpressure',
        'Systems and Infrastructure',
      ),
    ],
  ],
  [
    'search',
    [
      row('Vector Search', '/ai-and-ml/vector-search', 'AI and Machine Learning'),
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
      row('RAG Evaluation', '/ai-and-ml/rag-evaluation', 'AI and Machine Learning'),
      row(
        'Design a Docs Q&A Assistant (like a help-center chatbot)',
        '/system-design/docs-qa-assistant',
        'System Design',
      ),
    ],
  ],
];

// Every item the index holds, as the dialog showed it before this change: a
// topic under its section's label and a case study under "System Design".
const EVERY_ITEM = [
  ...TOPICS.map((t) => ({
    ...row(t.title, `/${t.section}/${t.slug}`, getSection(t.section)?.label ?? t.section),
    summary: t.summary,
  })),
  ...CASE_STUDIES.map((c) => ({
    ...row(c.title, `/system-design/${c.slug}`, 'System Design'),
    summary: c.summary,
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

  // docs/specs/remove-dsa-tab.md, criterion 3: with every body loaded, every
  // result is a topic or a case study the index lists, and none is a DSA entry.
  it.each(['binary search', 'heap', 'graph', 'search', 'queue'])(
    'gives only topic and case-study results for "%s"',
    async (query) => {
      await ensureFullTextSearch();
      const paths = new Set(EVERY_ITEM.map((item) => item.path));
      for (const result of searchContent(query, 50)) {
        expect(paths.has(result.path), result.path).toBe(true);
        expect(result.label).not.toBe('DSA');
      }
    },
  );

  it('holds exactly the topics and case studies, nothing else', async () => {
    await ensureFullTextSearch();
    const found = searchContent('the', 1000).map((r) => r.path);
    expect(found.length).toBeGreaterThan(20);
    const paths = new Set(EVERY_ITEM.map((item) => item.path));
    for (const path of found) expect(paths.has(path), path).toBe(true);
  });
});
