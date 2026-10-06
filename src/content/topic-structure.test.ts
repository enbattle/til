import { beforeAll, describe, expect, it } from 'vitest';
import type { Nodes, Paragraph, RootContent } from 'mdast';
import { TOPICS, loadAllTopicBodies } from '@/lib/content';
import { markdownParser, proseWordCount } from '@/lib/markdown.mjs';
import { CATALOG_WORD_BUDGET } from '@/lib/reading-time';

/**
 * Content-structure test for the catalog topics under src/content/; the rules
 * are the Writing Standard's "Catalog topics" section
 * (docs/specs/catalog-standard.md, design §2 and criteria 2 and 3):
 *
 * - `proseWordCount(body)` is at most `CATALOG_WORD_BUDGET` (1,000);
 * - the title doesn't start "What is" (or "What are", "What's"), has no
 *   subtitle of any kind (colon, dash or parenthetical; a trailing all-caps
 *   acronym gloss such as "(XSS)" is not a subtitle) and uses "and", never
 *   "&";
 * - exactly one paragraph opens with bold `Rule of thumb.`, and it is the
 *   body's last block, or, in systems-and-infrastructure, the last block
 *   before `## Where you'll meet this`.
 *
 * Topics not yet rewritten to the standard are on `PENDING` and skipped. The
 * list can only shrink: an entry naming no topic fails, and so does an entry
 * whose topic already passes every check. Each content batch removes the
 * entries it rewrites; the last batch deletes the list and its handling.
 */

/** Every `section/slug` not yet on the catalog standard. Only ever remove
 * entries from this list. */
const PENDING: string[] = [
  'ai-and-ml/context-window',
  'ai-and-ml/kv-cache',
  'ai-and-ml/lora-and-qlora',
  'ai-and-ml/prompt-engineering',
  'ai-and-ml/prompt-injection',
  'ai-and-ml/tokenization',
  'ai-and-ml/tool-use-function-calling',
  'ai-and-ml/vector-search',
  'ai-and-ml/what-are-ai-agents',
  'ai-and-ml/what-are-evals',
  'ai-and-ml/what-is-mcp',
  'ai-and-ml/what-is-mlops',
  'ai-and-ml/what-is-rag',
  'ai-and-ml/when-to-finetune',
  'coding-agents/context-is-a-budget',
  'coding-agents/documentation-vs-skill-vs-hook',
  'coding-agents/keeping-ai-native-docs-from-going-stale',
  'coding-agents/triaging-ai-code-review',
  'engineering-practices/git-rebase-vs-merge',
  'engineering-practices/numbers-every-engineer-should-know',
  'engineering-practices/plan-before-you-build',
  'engineering-practices/technical-debt-vs-time-to-market',
  'engineering-practices/testing-pyramid',
  'focus-and-attention/why-you-cant-focus-anymore',
  'security/csrf',
  'security/jwt',
  'security/oauth-oidc',
  'security/session-vs-token-auth',
  'security/sql-injection',
  'security/xss',
  'systems-and-infrastructure/backpressure',
  'systems-and-infrastructure/batching-and-asynchronous-writes',
  'systems-and-infrastructure/cache-invalidation',
  'systems-and-infrastructure/caching',
  'systems-and-infrastructure/cap-theorem',
  'systems-and-infrastructure/circuit-breaker',
  'systems-and-infrastructure/consistent-hashing',
  'systems-and-infrastructure/cqrs',
  'systems-and-infrastructure/database-connection-pooling',
  'systems-and-infrastructure/database-indexing',
  'systems-and-infrastructure/dead-letter-queue',
  'systems-and-infrastructure/distributed-locks',
  'systems-and-infrastructure/exponential-backoff',
  'systems-and-infrastructure/forward-vs-reverse-proxy',
  'systems-and-infrastructure/idempotency',
  'systems-and-infrastructure/latency-vs-throughput',
  'systems-and-infrastructure/message-queues',
  'systems-and-infrastructure/monolith-vs-microservices',
  'systems-and-infrastructure/n-plus-one-queries',
  'systems-and-infrastructure/observability',
  'systems-and-infrastructure/optimistic-vs-pessimistic-locking',
  'systems-and-infrastructure/outbox-pattern',
  'systems-and-infrastructure/partitioning-vs-sharding',
  'systems-and-infrastructure/race-conditions',
  'systems-and-infrastructure/rate-limiting',
  'systems-and-infrastructure/read-replicas',
  'systems-and-infrastructure/saga-pattern',
  'systems-and-infrastructure/scaling-reads-vs-scaling-writes',
  'systems-and-infrastructure/self-healing-systems',
  'systems-and-infrastructure/sql-vs-nosql',
  'systems-and-infrastructure/thundering-herd-problem',
  'systems-and-infrastructure/websockets-vs-sse-vs-long-polling',
  'systems-and-infrastructure/worker-pools',
  'systems-and-infrastructure/workflow-engines',
];

const SYSTEMS = 'systems-and-infrastructure';
const WHERE = "Where you'll meet this";
const RULE = 'Rule of thumb.';

interface TopicSource {
  section: string;
  title: string;
  body: string;
}

const parser = markdownParser();

function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  return 'children' in node ? node.children.map(textOf).join('') : '';
}

/** Every paragraph in the tree (nested ones included) that opens with bold
 * `Rule of thumb.`. */
function ruleParagraphs(node: Nodes): Paragraph[] {
  if (node.type === 'paragraph') {
    const first = node.children[0];
    return first?.type === 'strong' && textOf(first).trim() === RULE ? [node] : [];
  }
  return 'children' in node ? node.children.flatMap((c) => ruleParagraphs(c)) : [];
}

/** A trailing all-caps acronym gloss, "(XSS)" or "(APIs)": standard naming,
 * not a subtitle. */
const ACRONYM_GLOSS = /\s\([A-Z]{2,6}s?\)$/;

function titleProblems(title: string): string[] {
  const problems: string[] = [];
  if (/^what(\s+(is|are)\b|['’]s\b)/i.test(title))
    problems.push(`title "${title}" starts "What is"`);
  if (title.includes(':')) problems.push(`title "${title}" has a colon subtitle`);
  if (/[—–]|\s-\s|--/.test(title)) problems.push(`title "${title}" has a dash subtitle`);
  if (/\(.*\)/.test(title.replace(ACRONYM_GLOSS, ''))) {
    problems.push(`title "${title}" has a parenthetical subtitle`);
  }
  if (title.includes('&')) problems.push(`title "${title}" uses "&", not "and"`);
  return problems;
}

function budgetProblems(body: string): string[] {
  const words = proseWordCount(body);
  return words <= CATALOG_WORD_BUDGET
    ? []
    : [`${words} words, over the ${CATALOG_WORD_BUDGET}-word catalog budget`];
}

function ruleProblems(section: string, body: string): string[] {
  const root = parser.parse(body);
  const rules = ruleParagraphs(root);
  if (rules.length === 0) return [`no paragraph opening with bold "${RULE}"`];
  if (rules.length > 1) {
    return [`${rules.length} paragraphs open with bold "${RULE}", need exactly 1`];
  }
  const blocks: RootContent[] = root.children;
  const where =
    section === SYSTEMS
      ? blocks.findIndex(
          (b) => b.type === 'heading' && b.depth === 2 && textOf(b).trim() === WHERE,
        )
      : -1;
  const expected = where >= 0 ? blocks[where - 1] : blocks.at(-1);
  if (expected === rules[0]) return [];
  return where >= 0
    ? [`the "${RULE}" paragraph is not the last block before "## ${WHERE}"`]
    : [`the "${RULE}" paragraph is not the body's last block`];
}

/** Every catalog-standard problem with one topic; [] when it's on the
 * standard. */
function structureProblems({ section, title, body }: TopicSource): string[] {
  return [
    ...budgetProblems(body),
    ...titleProblems(title),
    ...ruleProblems(section, body),
  ];
}

/** Problems with the `pending` list itself against `topics` (keyed
 * `section/slug`): an entry naming no topic, or naming a topic that already
 * passes every check. */
function pendingProblems(pending: string[], topics: Map<string, TopicSource>): string[] {
  return pending.flatMap((path) => {
    const topic = topics.get(path);
    if (!topic) return [`${path} is on PENDING but no such topic exists`];
    return structureProblems(topic).length === 0
      ? [`${path} is on PENDING but already passes every check; remove it`]
      : [];
  });
}

// ---------------------------------------------------------------------------
// Criterion 2: the checks, against one passing fixture and planted failures.
// ---------------------------------------------------------------------------

describe('the topic-structure check itself (catalog-standard criterion 2)', () => {
  const INTRO = 'A cache keeps a copy of hot data close to the code that reads it.';
  const RULE_PARAGRAPH =
    '**Rule of thumb.** Cache what is read often and changes rarely.';
  const BODY = [
    INTRO,
    '## How it works',
    'A read checks the cache first and falls back to the database on a miss.',
    '- A hit returns at once.\n- A miss fills the cache.',
    '```ts\nconst value = cache.get(key) ?? db.get(key);\n```',
    '## When it goes wrong',
    'Stale entries are the price of speed.',
    RULE_PARAGRAPH,
  ].join('\n\n');
  const WHERE_SECTION = `## ${WHERE}\n\nIn every web stack with a read-heavy endpoint.`;
  const GOOD: TopicSource = { section: 'security', title: 'Caching', body: BODY };
  const GOOD_SYSTEMS: TopicSource = {
    section: SYSTEMS,
    title: 'Caching',
    body: `${BODY}\n\n${WHERE_SECTION}`,
  };

  /** `topic` with `from` (which must occur in its body exactly once) replaced
   * by `to`. */
  function planted(topic: TopicSource, from: string, to: string): TopicSource {
    expect(topic.body.split(from)).toHaveLength(2);
    return { ...topic, body: topic.body.replace(from, to) };
  }

  /** GOOD with filler words added to its intro until it has `words`. */
  function withWords(words: number): TopicSource {
    const missing = words - proseWordCount(GOOD.body);
    expect(missing).toBeGreaterThan(0);
    const topic = planted(
      GOOD,
      INTRO,
      `${INTRO} ${Array.from({ length: missing }, () => 'word').join(' ')}`,
    );
    expect(proseWordCount(topic.body)).toBe(words);
    return topic;
  }

  it('passes the GOOD fixture on every rule', () => {
    expect(structureProblems(GOOD)).toEqual([]);
  });

  it('passes the systems-and-infrastructure fixture, rule before "Where you\'ll meet this"', () => {
    expect(structureProblems(GOOD_SYSTEMS)).toEqual([]);
  });

  it('passes a body of exactly 1,000 words', () => {
    expect(structureProblems(withWords(1000))).toEqual([]);
  });

  it('fails a body of 1,001 words, naming the count', () => {
    expect(structureProblems(withWords(1001))).toEqual([
      expect.stringContaining('1001 words'),
    ]);
  });

  it.each([
    ['a title starting "What is"', 'What is Caching?', 'starts "What is"'],
    ['a title starting "What are"', 'What are Caches?', 'starts "What is"'],
    [
      'a title with a colon subtitle',
      'Caching: Placement and Eviction',
      'colon subtitle',
    ],
    ['a title with "&"', 'Caching & Eviction', 'uses "&"'],
    ['a title starting "What\'s"', "What's RAG", 'starts "What is"'],
    [
      'a title with an em-dash subtitle',
      'Caching — Placement and Eviction',
      'dash subtitle',
    ],
    ['a title with an en-dash subtitle', 'Caching – Placement', 'dash subtitle'],
    ['a title with a spaced-hyphen subtitle', 'Caching - Placement', 'dash subtitle'],
    ['a title with a double-hyphen subtitle', 'Caching -- Placement', 'dash subtitle'],
    [
      'a title with a parenthetical subtitle',
      'Caching (And Why It Matters)',
      'parenthetical subtitle',
    ],
    [
      'a title with a lowercase parenthetical',
      'Caching (beta)',
      'parenthetical subtitle',
    ],
  ])('fails %s', (_, title, problem) => {
    expect(structureProblems({ ...GOOD, title })).toEqual([
      expect.stringContaining(problem),
    ]);
  });

  it.each([
    'Latency vs. Throughput',
    'Caching and Eviction',
    'Optimistic vs. Pessimistic Locking',
    'Read-Through Caching',
    'Write-Ahead Log',
    'Whatever Works',
    'Cross-Site Scripting (XSS)',
    'JSON Web Tokens (JWT)',
    'Cross-Site Request Forgery (CSRF)',
    'Rate Limiting Public (APIs)',
  ])('passes the title "%s"', (title) => {
    expect(structureProblems({ ...GOOD, title })).toEqual([]);
  });

  it.each([
    [
      'no "Rule of thumb." paragraph',
      GOOD,
      `\n\n${RULE_PARAGRAPH}`,
      '',
      'no paragraph opening with bold "Rule of thumb."',
    ],
    [
      'a rule of thumb that is not bold',
      GOOD,
      RULE_PARAGRAPH,
      'Rule of thumb. Cache what is read often and changes rarely.',
      'no paragraph opening with bold "Rule of thumb."',
    ],
    [
      'two "Rule of thumb." paragraphs',
      GOOD,
      'Stale entries are the price of speed.',
      '**Rule of thumb.** Expect stale entries.',
      '2 paragraphs open with bold "Rule of thumb.", need exactly 1',
    ],
    [
      'a rule paragraph that is not the last block',
      GOOD,
      RULE_PARAGRAPH,
      `${RULE_PARAGRAPH}\n\nOne more thought.`,
      "is not the body's last block",
    ],
    [
      'a rule paragraph after "Where you\'ll meet this" in systems-and-infrastructure',
      GOOD_SYSTEMS,
      `${RULE_PARAGRAPH}\n\n${WHERE_SECTION}`,
      `${WHERE_SECTION}\n\n${RULE_PARAGRAPH}`,
      'is not the last block before "## Where you\'ll meet this"',
    ],
  ])('fails %s', (_, topic, from, to, problem) => {
    expect(structureProblems(planted(topic, from, to))).toEqual([
      expect.stringContaining(problem),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Criterion 3: the PENDING list's own rules, on planted lists.
// ---------------------------------------------------------------------------

describe('the PENDING rules (catalog-standard criterion 3)', () => {
  const PASSING: TopicSource = {
    section: 'security',
    title: 'Caching',
    body: 'A cache keeps hot data close.\n\n**Rule of thumb.** Cache what is read often.',
  };
  const FAILING: TopicSource = { ...PASSING, body: 'A cache keeps hot data close.' };
  const TOPICS_BY_PATH = new Map([
    ['security/passing', PASSING],
    ['security/failing', FAILING],
  ]);

  it('accepts an entry whose topic still fails a check', () => {
    expect(pendingProblems(['security/failing'], TOPICS_BY_PATH)).toEqual([]);
  });

  it('fails an entry naming no topic, naming it', () => {
    expect(
      pendingProblems(['security/gone', 'security/failing'], TOPICS_BY_PATH),
    ).toEqual([expect.stringContaining('security/gone')]);
  });

  it('fails an entry whose topic already passes every check, naming it', () => {
    expect(
      pendingProblems(['security/passing', 'security/failing'], TOPICS_BY_PATH),
    ).toEqual([expect.stringContaining('security/passing')]);
  });
});

// ---------------------------------------------------------------------------
// Criterion 3: the real topics.
// ---------------------------------------------------------------------------

describe('the real topics (catalog-standard criterion 3)', () => {
  let topics: Map<string, TopicSource>;
  beforeAll(async () => {
    const bodies = await loadAllTopicBodies();
    topics = new Map(
      TOPICS.map((t) => {
        const key = `${t.section}/${t.slug}`;
        return [key, { section: t.section, title: t.title, body: bodies.get(key)! }];
      }),
    );
  });

  it('has a body for every topic', () => {
    expect(topics.size).toBeGreaterThan(0);
    for (const [key, topic] of topics) expect(topic.body, key).toBeTypeOf('string');
  });

  it('lists no path twice on PENDING', () => {
    expect(PENDING.filter((p, i) => PENDING.indexOf(p) !== i)).toEqual([]);
  });

  it('keeps PENDING honest: every entry is a topic that still fails a check', () => {
    expect(pendingProblems(PENDING, topics)).toEqual([]);
  });

  it('passes every check for every topic not on PENDING', () => {
    const failing = Object.fromEntries(
      [...topics]
        .filter(([key]) => !PENDING.includes(key))
        .map(([key, topic]) => [key, structureProblems(topic)] as const)
        .filter(([, problems]) => problems.length > 0),
    );
    expect(failing).toEqual({});
  });
});
