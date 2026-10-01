import { describe, expect, it } from 'vitest';
import { TOPICS, getTopic } from './content';
import { RAW_CASE_STUDIES as RAW, rawCaseStudy as rawFor, without } from '@/test/content';
import { parseFrontmatter } from './frontmatter';
import { extractTopicRefs } from './markdown.mjs';
import {
  CASE_STUDIES,
  caseStudiesForTopic,
  getCaseStudy,
  isSystemDesignPath,
  loadCaseStudyBody,
  parseCaseStudy,
  topicsForCaseStudy,
} from './system-design';

// The test's own view of the real case-study files (RAW, rawFor) comes from
// src/test/content.ts, independent of the app's loaders.

function slugOf(filePath: string): string {
  return filePath.replace(/^.*\/([^/]+)\.md$/, '$1');
}

const REAL = Object.entries(RAW).map(([filePath, raw]) => ({
  slug: slugOf(filePath),
  body: parseFrontmatter(raw).content,
}));

const VALID_PATH = '/src/system-design/case-studies/my-case.md';

const VALID_FIELDS: Record<string, string> = {
  title: 'Design a Widget Service (like a widget store)',
  summary: 'A one-line hook.',
  date: '2026-09-28',
  order: '3',
};

// `parseCaseStudy(filePath, data)` takes the file path and its already-parsed
// frontmatter (what the `?meta` query yields), like `parseTopicMeta`.
describe('parseCaseStudy (criterion 3)', () => {
  it('returns slug, title, summary, date and a numeric order, and no body', () => {
    const caseStudy = parseCaseStudy(VALID_PATH, VALID_FIELDS);
    expect(caseStudy).toEqual({
      slug: 'my-case',
      title: 'Design a Widget Service (like a widget store)',
      summary: 'A one-line hook.',
      date: '2026-09-28',
      order: 3,
    });
    expect(typeof caseStudy.order).toBe('number');
    expect(caseStudy).not.toHaveProperty('body');
  });

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws naming the file and the field when %s is missing',
    (field) => {
      expect(() => parseCaseStudy(VALID_PATH, without(VALID_FIELDS, field))).toThrow(
        /my-case\.md/,
      );
      expect(() => parseCaseStudy(VALID_PATH, without(VALID_FIELDS, field))).toThrow(
        new RegExp(field),
      );
    },
  );

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws naming the file and the field when %s is present but empty',
    (field) => {
      const data = { ...VALID_FIELDS, [field]: '' };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(new RegExp(field));
    },
  );

  it.each(['0', '-1', '-7', '1.5', '2.0001', 'abc', 'two', ' 3', '3x', '1e2'])(
    'throws naming the file and "order" when order is %j',
    (order) => {
      const data = { ...VALID_FIELDS, order };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/order/);
    },
  );

  it('accepts a larger positive integer order', () => {
    expect(parseCaseStudy(VALID_PATH, { ...VALID_FIELDS, order: '42' }).order).toBe(42);
  });

  it.each([
    '/src/content/ai-and-ml/my-case.md',
    '/src/system-design/my-case.md',
    '/src/system-design/questions/my-case.md',
    '/src/system-design/case-studies/nested/my-case.md',
    '/src/system-design/case-studies/my-case.txt',
    '/src/system-design/case-studies/.md',
    'not a path',
  ])(
    'throws naming the path when it is not /src/system-design/case-studies/<slug>.md: %s',
    (filePath) => {
      expect(() => parseCaseStudy(filePath, VALID_FIELDS)).toThrow(filePath);
    },
  );
});

describe('CASE_STUDIES and getCaseStudy (criteria 3 and 4)', () => {
  it('loads one entry per case-study file, and at least one', () => {
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
    expect(CASE_STUDIES).toHaveLength(Object.keys(RAW).length);
  });

  it('is metadata only: exactly slug, title, summary, date and order', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(Object.keys(caseStudy).sort()).toEqual([
        'date',
        'order',
        'slug',
        'summary',
        'title',
      ]);
    }
  });

  it('matches each file’s frontmatter', () => {
    for (const caseStudy of CASE_STUDIES) {
      const { data } = parseFrontmatter(rawFor(caseStudy.slug));
      expect(caseStudy.title).toBe(data.title);
      expect(caseStudy.summary).toBe(data.summary);
      expect(caseStudy.date).toBe(data.date);
      expect(caseStudy.order).toBe(Number(data.order));
    }
  });

  it('is sorted by order ascending', () => {
    for (let i = 1; i < CASE_STUDIES.length; i++) {
      expect(CASE_STUDIES[i - 1].order).toBeLessThan(CASE_STUDIES[i].order);
    }
  });

  it('has unique order values and unique slugs across the real case studies', () => {
    const orders = CASE_STUDIES.map((c) => c.order);
    expect(new Set(orders).size).toBe(orders.length);
    const slugs = CASE_STUDIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has well-formed values on every real case study', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(caseStudy.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(caseStudy.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(caseStudy.summary).not.toMatch(/\n/);
      expect(Number.isInteger(caseStudy.order)).toBe(true);
      expect(caseStudy.order).toBeGreaterThan(0);
    }
  });

  it('finds the URL shortener by slug', () => {
    const caseStudy = getCaseStudy('url-shortener');
    expect(caseStudy).toBeDefined();
    expect(caseStudy?.slug).toBe('url-shortener');
    expect(caseStudy).toBe(CASE_STUDIES.find((c) => c.slug === 'url-shortener'));
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCaseStudy('does-not-exist')).toBeUndefined();
    expect(getCaseStudy('database-cant-keep-up-with-reads')).toBeUndefined();
  });
});

describe('loadCaseStudyBody (criterion 5)', () => {
  it('resolves the real URL shortener body, frontmatter stripped', async () => {
    const body = await loadCaseStudyBody('url-shortener');
    expect(body).toBe(parseFrontmatter(rawFor('url-shortener')).content);
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body.startsWith('---')).toBe(false);
    expect(body).not.toMatch(/^order:/m);
    expect(body).not.toMatch(/^summary:/m);
  });

  it('resolves every real case study to its own body', async () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(await loadCaseStudyBody(caseStudy.slug)).toBe(
        parseFrontmatter(rawFor(caseStudy.slug)).content,
      );
    }
  });

  it('returns the same promise for the same case study', () => {
    expect(loadCaseStudyBody('url-shortener')).toBe(loadCaseStudyBody('url-shortener'));
  });

  it('rejects for an unknown slug, naming it', async () => {
    await expect(loadCaseStudyBody('no-such-case-study')).rejects.toThrow(
      /no-such-case-study/,
    );
  });
});

describe('topicsForCaseStudy (criterion 6)', () => {
  it('returns synchronously, from build-time link data, without loading a body', () => {
    const caseStudy = getCaseStudy('url-shortener')!;
    const result = topicsForCaseStudy(caseStudy);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('matches the resolved topic links of every real case study, in first-appearance order', () => {
    for (const { slug, body } of REAL) {
      const expected = extractTopicRefs(body)
        .map(({ section, slug: topicSlug }) => getTopic(section, topicSlug))
        .filter((t) => t !== undefined)
        .map((t) => `${t.section}/${t.slug}`);
      const actual = topicsForCaseStudy(getCaseStudy(slug)!).map(
        (t) => `${t.section}/${t.slug}`,
      );
      expect(actual, slug).toEqual(expected);
      expect(new Set(actual).size, slug).toBe(actual.length);
    }
  });

  it('returns full Topic objects', () => {
    const [first] = topicsForCaseStudy(getCaseStudy('url-shortener')!);
    expect(first).toEqual(getTopic(first.section, first.slug));
  });

  it('includes the caching topic for the URL shortener (its read-path deep dive)', () => {
    expect(
      topicsForCaseStudy(getCaseStudy('url-shortener')!).map(
        (t) => `${t.section}/${t.slug}`,
      ),
    ).toContain('systems-and-infrastructure/caching');
  });

  it('returns [] for a case study that is not one of the real ones', () => {
    expect(
      topicsForCaseStudy({
        slug: 'not-real',
        title: 'Not real',
        summary: 'Stub.',
        date: '2026-09-28',
        order: 999,
      }),
    ).toEqual([]);
  });
});

describe('caseStudiesForTopic (criterion 6)', () => {
  it('returns the case studies linking each topic, in order', () => {
    // Each case study's refs, parsed once rather than once per topic.
    const refsBySlug = new Map(
      CASE_STUDIES.map((c) => [
        c.slug,
        extractTopicRefs(parseFrontmatter(rawFor(c.slug)).content),
      ]),
    );
    for (const topic of TOPICS) {
      const expected = CASE_STUDIES.filter((c) =>
        refsBySlug
          .get(c.slug)!
          .some((r) => r.section === topic.section && r.slug === topic.slug),
      ).map((c) => c.slug);
      const actual = caseStudiesForTopic(topic.section, topic.slug);
      expect(Array.isArray(actual)).toBe(true);
      expect(
        actual.map((c) => c.slug),
        `${topic.section}/${topic.slug}`,
      ).toEqual(expected);
      for (let i = 1; i < actual.length; i++) {
        expect(actual[i - 1].order).toBeLessThan(actual[i].order);
      }
    }
  });

  it('lists the URL shortener for systems-and-infrastructure/caching', () => {
    expect(
      caseStudiesForTopic('systems-and-infrastructure', 'caching').map((c) => c.slug),
    ).toContain('url-shortener');
  });

  it('is consistent with topicsForCaseStudy in both directions', () => {
    for (const caseStudy of CASE_STUDIES) {
      for (const topic of topicsForCaseStudy(caseStudy)) {
        expect(caseStudiesForTopic(topic.section, topic.slug)).toContain(caseStudy);
      }
    }
  });

  it('returns [] for a topic no case study links', () => {
    expect(caseStudiesForTopic('ai-and-ml', 'prompt-engineering')).toEqual([]);
  });

  it('returns [] for a topic that does not exist', () => {
    expect(caseStudiesForTopic('no-such-section', 'no-such-topic')).toEqual([]);
  });
});

describe('isSystemDesignPath', () => {
  it.each(['/system-design', '/system-design/url-shortener'])('is true for %s', (p) => {
    expect(isSystemDesignPath(p)).toBe(true);
  });

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/system-designer'])(
    'is false for %s',
    (p) => {
      expect(isSystemDesignPath(p)).toBe(false);
    },
  );
});

// docs/specs/dedupe-app-scripts-tests.md, criterion 2: moving link extraction
// from a regex to the markdown parser changes nothing on the real corpus. These
// are the lists main produced when the change was specified (16 case studies,
// in CASE_STUDIES order, each with its catalog topics in first-appearance
// order), pinned as data rather than recomputed through the extractor.
const PINNED_TOPICS_FOR_CASE_STUDY: Record<string, string[]> = {
  'url-shortener': [
    'systems-and-infrastructure/latency-vs-throughput',
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/forward-vs-reverse-proxy',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/cache-invalidation',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/read-replicas',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/batching-and-asynchronous-writes',
    'systems-and-infrastructure/rate-limiting',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/observability',
  ],
  'rate-limiter': [
    'systems-and-infrastructure/rate-limiting',
    'systems-and-infrastructure/latency-vs-throughput',
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/observability',
  ],
  'notification-system': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/batching-and-asynchronous-writes',
    'systems-and-infrastructure/rate-limiting',
    'systems-and-infrastructure/latency-vs-throughput',
    'systems-and-infrastructure/worker-pools',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/observability',
  ],
  'social-feed': [
    'systems-and-infrastructure/cap-theorem',
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/cqrs',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/worker-pools',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/n-plus-one-queries',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/batching-and-asynchronous-writes',
    'systems-and-infrastructure/cache-invalidation',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/read-replicas',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/observability',
    'systems-and-infrastructure/scaling-reads-vs-scaling-writes',
  ],
  messaging: [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/observability',
  ],
  'file-storage': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/database-indexing',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/read-replicas',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/cache-invalidation',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/exponential-backoff',
  ],
  'video-streaming': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/batching-and-asynchronous-writes',
    'systems-and-infrastructure/workflow-engines',
    'systems-and-infrastructure/worker-pools',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/observability',
  ],
  'ride-sharing': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/observability',
  ],
  'ecommerce-checkout': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/forward-vs-reverse-proxy',
    'systems-and-infrastructure/cqrs',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/read-replicas',
    'systems-and-infrastructure/cache-invalidation',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/saga-pattern',
    'systems-and-infrastructure/workflow-engines',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/observability',
  ],
  'ticket-booking': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/rate-limiting',
    'security/jwt',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/observability',
    'systems-and-infrastructure/saga-pattern',
  ],
  'payment-system': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/sql-vs-nosql',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/race-conditions',
    'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/read-replicas',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/saga-pattern',
    'systems-and-infrastructure/workflow-engines',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/observability',
  ],
  maps: [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/database-indexing',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/cache-invalidation',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/observability',
  ],
  'ad-click-aggregator': [
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/dead-letter-queue',
    'systems-and-infrastructure/observability',
  ],
  'search-engine': [
    'ai-and-ml/vector-search',
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/database-indexing',
    'systems-and-infrastructure/forward-vs-reverse-proxy',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/circuit-breaker',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/exponential-backoff',
  ],
  'recommendation-system': [
    'ai-and-ml/what-is-mlops',
    'engineering-practices/numbers-every-engineer-should-know',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/caching',
    'systems-and-infrastructure/message-queues',
    'systems-and-infrastructure/latency-vs-throughput',
    'ai-and-ml/vector-search',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/circuit-breaker',
  ],
  'llm-chat-serving': [
    'ai-and-ml/tokenization',
    'engineering-practices/numbers-every-engineer-should-know',
    'ai-and-ml/kv-cache',
    'systems-and-infrastructure/partitioning-vs-sharding',
    'systems-and-infrastructure/idempotency',
    'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
    'systems-and-infrastructure/outbox-pattern',
    'systems-and-infrastructure/distributed-locks',
    'systems-and-infrastructure/latency-vs-throughput',
    'systems-and-infrastructure/consistent-hashing',
    'systems-and-infrastructure/thundering-herd-problem',
    'systems-and-infrastructure/backpressure',
    'systems-and-infrastructure/exponential-backoff',
    'systems-and-infrastructure/rate-limiting',
    'ai-and-ml/context-window',
  ],
};

describe('the real corpus links as before (dedupe criterion 2)', () => {
  it('has the same 16 case studies, in order', () => {
    expect(CASE_STUDIES.map((c) => c.slug)).toEqual(
      Object.keys(PINNED_TOPICS_FOR_CASE_STUDY),
    );
  });

  it.each(Object.entries(PINNED_TOPICS_FOR_CASE_STUDY))(
    'topicsForCaseStudy(%s) is unchanged',
    (slug, topics) => {
      expect(
        topicsForCaseStudy(getCaseStudy(slug)!).map((t) => `${t.section}/${t.slug}`),
      ).toEqual(topics);
    },
  );

  it('caseStudiesForTopic is unchanged for every topic', () => {
    for (const topic of TOPICS) {
      const key = `${topic.section}/${topic.slug}`;
      const expected = Object.entries(PINNED_TOPICS_FOR_CASE_STUDY)
        .filter(([, topics]) => topics.includes(key))
        .map(([slug]) => slug);
      expect(
        caseStudiesForTopic(topic.section, topic.slug).map((c) => c.slug),
        key,
      ).toEqual(expected);
    }
  });
});
