import { beforeAll, describe, expect, it } from 'vitest';
import type { Heading, Nodes, Paragraph, Root, RootContent } from 'mdast';
import { TOPICS, loadAllTopicBodies } from '@/lib/content';
import { markdownParser, proseWordCount, sectionNodes, textOf } from '@/lib/markdown.mjs';
import { CATALOG_WORD_BUDGET } from '@/lib/reading-time';
import { wordBudgetProblems } from '@/test/structure';

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
 *   before `## Where you'll meet this`;
 * - in systems-and-infrastructure, the body has exactly one `## Where you'll
 *   meet this` (straight apostrophe, depth 2), no H1 or H2 follows it, and it
 *   holds at least 25 prose words (`proseWordCount` over that section's
 *   nodes, so a code block in it doesn't count; docs/specs/where-youll-meet-this.md
 *   and docs/specs/content-dedupe.md, design item 5).
 *
 * Every topic must pass every check; there are no exceptions.
 */

const SYSTEMS = 'systems-and-infrastructure';
const WHERE = "Where you'll meet this";
const RULE = 'Rule of thumb.';
const WHERE_MIN_WORDS = 25;

interface TopicSource {
  section: string;
  title: string;
  body: string;
}

const parser = markdownParser();

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

function ruleProblems(section: string, root: Root): string[] {
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

/** The prose words in `nodes` (top-level nodes of `body`'s tree), counted
 * by `proseWordCount` over their source. */
function proseWordsIn(body: string, nodes: RootContent[]): number {
  if (nodes.length === 0) return 0;
  const start = nodes[0].position!.start.offset!;
  const end = nodes[nodes.length - 1].position!.end.offset!;
  return proseWordCount(body.slice(start, end));
}

/** Every H1 and H2 in the tree, nested ones (in a blockquote or list item)
 * included, in document order. */
function topHeadings(node: Nodes): Heading[] {
  if (node.type === 'heading') return node.depth <= 2 ? [node] : [];
  return 'children' in node ? node.children.flatMap((c) => topHeadings(c)) : [];
}

/** A systems-and-infrastructure topic's closing section: exactly one `##`
 * heading named WHERE at the top level (an H1 of that name is not the
 * section, as `sectionNodes` only opens one at depth 2), no H1 or H2 after it
 * anywhere in the tree (a nested one still renders after the section), and at
 * least WHERE_MIN_WORDS prose words. */
function whereProblems(section: string, body: string, root: Root): string[] {
  if (section !== SYSTEMS) return [];
  const isWhere = (h: Nodes) =>
    h.type === 'heading' && h.depth === 2 && textOf(h).trim() === WHERE;
  const count = root.children.filter(isWhere).length;
  if (count !== 1) return [`${count} "## ${WHERE}" sections, need exactly 1`];
  if (!isWhere(topHeadings(root).at(-1)!))
    return [`"## ${WHERE}" is not the last section`];
  const words = proseWordsIn(body, sectionNodes(root, WHERE));
  return words >= WHERE_MIN_WORDS
    ? []
    : [`"## ${WHERE}" holds ${words} prose words, need ${WHERE_MIN_WORDS}+`];
}

/** Every catalog-standard problem with one topic; [] when it's on the
 * standard. */
function structureProblems({ section, title, body }: TopicSource): string[] {
  const root = parser.parse(body);
  return [
    ...wordBudgetProblems(body, CATALOG_WORD_BUDGET, 'catalog'),
    ...titleProblems(title),
    ...ruleProblems(section, root),
    ...whereProblems(section, body, root),
  ];
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
  const WHERE_PROSE = [
    'In every web stack with a read-heavy endpoint: the CDN in front of static',
    'files, the Redis tier in front of the primary database, and the in-process',
    'map a service keeps for the config it reads on every request.',
  ].join('\n');
  const WHERE_SECTION = `## ${WHERE}\n\n${WHERE_PROSE}`;
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

  // docs/specs/content-dedupe.md, design item 5 and criterion 5: the rules
  // where-youll-meet-this.test.ts used to hold, now part of this check.
  describe(`"## ${WHERE}" in systems-and-infrastructure`, () => {
    const words = (count: number) =>
      Array.from({ length: count }, () => 'word').join(' ');

    /** GOOD_SYSTEMS with its Where section's prose replaced by `prose`. */
    const whereHolding = (prose: string) => planted(GOOD_SYSTEMS, WHERE_PROSE, prose);

    it('passes a section of exactly 25 prose words', () => {
      expect(structureProblems(whereHolding(words(25)))).toEqual([]);
    });

    it('fails a section of 24 prose words, naming the count', () => {
      expect(structureProblems(whereHolding(words(24)))).toEqual([
        expect.stringContaining('holds 24 prose words, need 25+'),
      ]);
    });

    it('does not count a code block in the section', () => {
      const code = ['```ts', words(40), '```'].join('\n');
      expect(structureProblems(whereHolding(`${words(10)}\n\n${code}`))).toEqual([
        expect.stringContaining('holds 10 prose words, need 25+'),
      ]);
    });

    it('counts prose under a ### subheading inside the section', () => {
      const prose = `${words(15)}\n\n### More places\n\n${words(10)}`;
      expect(structureProblems(whereHolding(prose))).toEqual([]);
    });

    it('fails a section that is not the last ## section', () => {
      const topic = {
        ...GOOD_SYSTEMS,
        body: `${GOOD_SYSTEMS.body}\n\n## Further reading\n\nMore.`,
      };
      expect(structureProblems(topic)).toEqual([
        expect.stringContaining('is not the last section'),
      ]);
    });

    // A heading nested in a container still renders as an <h2> after the
    // section, so it counts as a following section (the deleted
    // where-youll-meet-this.test.ts walked the whole tree too).
    it.each([
      ['in a blockquote', '> ## Further reading\n>\n> More.'],
      ['in a list item', '- ## Further reading\n\n  More.'],
      ['as an H1 in a blockquote', '> # Further reading'],
    ])('fails a section followed by a nested heading %s', (_, after) => {
      const topic = { ...GOOD_SYSTEMS, body: `${GOOD_SYSTEMS.body}\n\n${after}` };
      expect(structureProblems(topic)).toEqual([`"## ${WHERE}" is not the last section`]);
    });

    it('passes a ### subheading nested in a blockquote inside the section', () => {
      const topic = {
        ...GOOD_SYSTEMS,
        body: `${GOOD_SYSTEMS.body}\n\n> ### Further reading\n>\n> More.`,
      };
      expect(structureProblems(topic)).toEqual([]);
    });

    it('fails a section followed by a trailing H1, not calling the H1 a ## section', () => {
      const topic = {
        ...GOOD_SYSTEMS,
        body: `${GOOD_SYSTEMS.body}\n\n# Further reading\n\nMore.`,
      };
      const problems = structureProblems(topic);
      expect(problems).toEqual([`"## ${WHERE}" is not the last section`]);
    });

    it('fails an H1 "# Where you\'ll meet this" as a missing ## section', () => {
      const topic = planted(GOOD_SYSTEMS, `## ${WHERE}`, `# ${WHERE}`);
      const problems = structureProblems(topic);
      expect(problems).toContainEqual(
        expect.stringContaining(
          '0 "## Where you\'ll meet this" sections, need exactly 1',
        ),
      );
      expect(problems).not.toContainEqual(expect.stringContaining('prose words'));
    });

    it('passes an H3 after the section, which stays inside it', () => {
      const topic = {
        ...GOOD_SYSTEMS,
        body: `${GOOD_SYSTEMS.body}\n\n### Further reading\n\nMore.`,
      };
      expect(structureProblems(topic)).toEqual([]);
    });

    it('fails a topic with no such section', () => {
      expect(
        structureProblems(planted(GOOD_SYSTEMS, `\n\n${WHERE_SECTION}`, '')),
      ).toEqual([
        expect.stringContaining(
          '0 "## Where you\'ll meet this" sections, need exactly 1',
        ),
      ]);
    });

    it('fails a topic with two such sections', () => {
      const topic = { ...GOOD_SYSTEMS, body: `${GOOD_SYSTEMS.body}\n\n${WHERE_SECTION}` };
      expect(structureProblems(topic)).toContainEqual(
        expect.stringContaining(
          '2 "## Where you\'ll meet this" sections, need exactly 1',
        ),
      );
    });

    it('fails a heading with a curly apostrophe as a missing section', () => {
      const topic = planted(GOOD_SYSTEMS, `## ${WHERE}`, '## Where you’ll meet this');
      expect(structureProblems(topic)).toContainEqual(
        expect.stringContaining('0 "## Where you\'ll meet this" sections'),
      );
    });

    it('does not ask for the section outside systems-and-infrastructure', () => {
      expect(whereProblems('security', GOOD.body, parser.parse(GOOD.body))).toEqual([]);
    });
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

  it('has systems-and-infrastructure topics, so the closing-section rule runs', () => {
    expect([...topics.values()].some((t) => t.section === SYSTEMS)).toBe(true);
  });

  it('passes every check for every topic', () => {
    const failing = Object.fromEntries(
      [...topics]
        .map(([key, topic]) => [key, structureProblems(topic)] as const)
        .filter(([, problems]) => problems.length > 0),
    );
    expect(failing).toEqual({});
  });
});
