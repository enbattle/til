import { beforeAll, describe, expect, it } from 'vitest';
import type { Heading, Nodes, Paragraph, Root, RootContent } from 'mdast';
import { TOPICS, loadAllTopicBodies, parseTopicMeta } from '@/lib/content';
import { parseFrontmatter } from '@/lib/frontmatter';
import { markdownParser, proseWordCount } from '@/lib/markdown.mjs';
import { CATALOG_WORD_BUDGET } from '@/lib/reading-time';
import contentReviewFixtures, {
  BASE_HEADING,
  extractEvalFixtures,
  scenariosText,
  type TopicDraft,
} from '@/test/eval-fixtures';
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

// textOf and sectionNodes used to come from src/lib/markdown.mjs; that module
// drops them (docs/specs/remove-dsa-tab.md, criterion 7), so this test keeps
// its own.

/** The text of a markdown node and everything under it, joined with nothing
 * added: a text or code node's value, or its children's text. */
function textOf(node: Nodes): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map((c) => textOf(c)).join('') : '';
}

/** The top-level nodes of `tree` under its `## heading` (matched by the
 * heading's trimmed text), up to the next `#` or `##` heading; a deeper
 * heading inside stays part of the section. [] when there's no such section. */
function sectionNodes(tree: Root, heading: string): RootContent[] {
  const nodes: RootContent[] = [];
  let inSection = false;
  for (const node of tree.children) {
    if (node.type === 'heading' && node.depth <= 2) {
      inSection = node.depth === 2 && textOf(node).trim() === heading;
    } else if (inSection) {
      nodes.push(node);
    }
  }
  return nodes;
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

// ---------------------------------------------------------------------------
// The content-review eval's CR drafts (docs/specs/eval-fixture-structure-check.md,
// criteria 1, 2, 3 and 5): every `### CR-` draft in
// evals/content-review/scenarios.md passes the same rules as a real topic.
// ---------------------------------------------------------------------------

/** The draft's frontmatter checked by `parseTopicMeta`, the contract every
 * published topic meets (required fields, no others), as if the draft were
 * `src/content/<section>/<id>.md`; [] when it passes, else its error. */
function draftMetaProblems(draft: TopicDraft, data: Record<string, string>): string[] {
  try {
    parseTopicMeta(`/src/content/${draft.section}/${draft.id.toLowerCase()}.md`, data);
    return [];
  } catch (error) {
    return [(error as Error).message];
  }
}

/** Every frontmatter and catalog-standard problem with each draft, keyed by
 * its ID; only the drafts with a problem appear. The title is the draft's
 * frontmatter title. */
function draftProblems(drafts: TopicDraft[]): Record<string, string[]> {
  return Object.fromEntries(
    drafts
      .map((draft) => {
        const { data, content } = parseFrontmatter(draft.raw);
        const problems = [
          ...draftMetaProblems(draft, data),
          ...(data.title === undefined
            ? []
            : structureProblems({
                section: draft.section,
                title: data.title,
                body: content,
              })),
        ];
        return [draft.id, problems] as const;
      })
      .filter(([, problems]) => problems.length > 0),
  );
}

describe('the content-review CR drafts (eval-fixture-structure-check criteria 1, 2, 3 and 5)', () => {
  const BASE = [
    `### ${BASE_HEADING}`,
    '````markdown\n---\ntitle: Design a Demo\n---\n\nA demo.\n````',
  ].join('\n\n');
  const DRAFT = [
    '---',
    'title: Caching',
    'summary: A copy of hot data close to the code that reads it.',
    'date: 2026-10-15',
    '---',
    '',
    'A cache keeps a copy of hot data close to the code that reads it.',
    '',
    '## How it works',
    '',
    '```ts',
    'const value = cache.get(key) ?? db.get(key);',
    '```',
    '',
    'A read checks the cache first and falls back to the database on a miss.',
    '',
    '**Rule of thumb.** Cache what is read often and changes rarely.',
  ].join('\n');

  /** One CR scenario block as scenarios.md writes one: the heading, the
   * `**Section:**` paragraph (unless `section` is null) and the draft fenced
   * with four backticks (unless `draft` is null). */
  function scenario(id: string, section: string | null, draft: string | null): string {
    return [
      `### ${id} — a planted problem`,
      ...(section === null
        ? []
        : [`**Section:** \`${section}\`\n**Planted violation:** one.`]),
      ...(draft === null ? [] : [`\`\`\`\`markdown\n${draft}\n\`\`\`\``]),
      '**Expected finding:** it.',
    ].join('\n\n');
  }

  /** A scenarios file: a header, `blocks`, then the case-study base. */
  function scenariosFile(...blocks: string[]): string {
    return [
      '# Content-review scenarios',
      'Intro.',
      ...blocks,
      '## Case-study scenarios',
      BASE,
    ].join('\n\n');
  }

  describe('extraction', () => {
    it('returns one draft per `### CR-` heading, in file order, with its ID and section', () => {
      const text = scenariosFile(
        scenario('CR-01', 'security', DRAFT),
        scenario('CR-02', 'systems-and-infrastructure', DRAFT),
      );
      expect(extractEvalFixtures(text).topics).toEqual([
        { id: 'CR-01', section: 'security', raw: DRAFT },
        { id: 'CR-02', section: 'systems-and-infrastructure', raw: DRAFT },
      ]);
    });

    it('takes the first inline code of the "Section:" paragraph as the section', () => {
      const block = scenario('CR-01', 'security', DRAFT).replace(
        '`security`',
        '`security`, not `ai-and-ml`',
      );
      expect(extractEvalFixtures(scenariosFile(block)).topics[0].section).toBe(
        'security',
      );
    });

    it('takes the first `markdown` block, skipping code in another language', () => {
      const block = scenario('CR-01', 'security', DRAFT)
        .replace('````markdown', '```text\nnot a draft\n```\n\n````markdown')
        .replace(
          '**Expected finding:**',
          '```markdown\n---\ntitle: Second\n---\n```\n\n**Expected finding:**',
        );
      expect(extractEvalFixtures(scenariosFile(block)).topics[0].raw).toBe(DRAFT);
    });

    // Review decisions: a `### CR-` heading under a retired block used to be
    // skipped silently, and the last retired block runs to the end of the
    // file, so a new scenario appended there dropped out of the check.
    it('throws, naming it, for a `### CR-` heading under a `##` heading marked retired', () => {
      const text = scenariosFile(
        scenario('CR-01', 'security', DRAFT),
        '## CR-07 — retired',
        '### CR-07 — the old one',
        'No draft any more.',
      );
      expect(() => extractEvalFixtures(text)).toThrow(/CR-07.*retired/);
    });

    it('throws for a new CR scenario appended after the last retired block', () => {
      const text = [
        scenariosFile(scenario('CR-01', 'security', DRAFT)),
        '## DS-* — retired',
        scenario('CR-08', 'security', DRAFT),
      ].join('\n\n');
      expect(() => extractEvalFixtures(text)).toThrow(/CR-08.*retired/);
    });

    it('still extracts a CR scenario after a retired block once a non-retired `##` closes it', () => {
      const text = scenariosFile(
        '## DS-* — retired',
        'Nothing here any more.',
        '## Topic scenarios',
        scenario('CR-01', 'security', DRAFT),
      );
      expect(extractEvalFixtures(text).topics.map((t) => t.id)).toEqual(['CR-01']);
    });

    // Criterion 5: a four-backtick fence around an inner triple-backtick block
    // comes out whole, as CR-01's does.
    it('extracts a four-backtick draft with an inner triple-backtick block whole', () => {
      const draft = `${DRAFT}\n\n## Where you'll meet this\n\nAfter the inner block.`;
      const [topic] = extractEvalFixtures(
        scenariosFile(scenario('CR-01', 'security', draft)),
      ).topics;
      expect(topic.raw).toBe(draft);
      expect(topic.raw).toContain('```ts\nconst value');
      expect(topic.raw).toContain('After the inner block.');
    });
  });

  // Criterion 2: the helper fails loudly, naming the scenario.
  describe('loud failures', () => {
    it('throws, naming the scenario, for a `### CR-` heading with no `markdown` block', () => {
      expect(() =>
        extractEvalFixtures(scenariosFile(scenario('CR-09', 'security', null))),
      ).toThrow(/CR-09.*markdown/);
    });

    it('throws for a CR scenario whose only code block is not `markdown`', () => {
      const block = scenario('CR-09', 'security', null).replace(
        '**Expected finding:**',
        '```text\nnot a draft\n```\n\n**Expected finding:**',
      );
      expect(() => extractEvalFixtures(scenariosFile(block))).toThrow(/CR-09.*markdown/);
    });

    it("does not borrow the next scenario's draft", () => {
      const text = scenariosFile(
        scenario('CR-09', 'security', null),
        scenario('CR-10', 'security', DRAFT),
      );
      expect(() => extractEvalFixtures(text)).toThrow(/CR-09.*markdown/);
    });

    it('throws, naming the scenario, for a CR scenario with no "Section:" paragraph', () => {
      expect(() =>
        extractEvalFixtures(scenariosFile(scenario('CR-09', null, DRAFT))),
      ).toThrow(/CR-09.*Section:/);
    });

    it('throws, naming the scenario, for a "Section:" paragraph with no inline code', () => {
      const block = scenario('CR-09', 'security', DRAFT).replace(
        '`security`',
        'security',
      );
      expect(() => extractEvalFixtures(scenariosFile(block))).toThrow(/CR-09.*Section:/);
    });

    // Review decisions: a misspelt or unknown section silently turned off
    // the systems-and-infrastructure rules.
    it.each([
      ['a misspelt section', 'systems-and-infrastucture'],
      ['a section the registry does not have', 'devops'],
    ])('throws, naming the scenario and the value, for %s', (_, section) => {
      expect(() =>
        extractEvalFixtures(scenariosFile(scenario('CR-09', section, DRAFT))),
      ).toThrow(new RegExp(`CR-09.*${section}`));
    });
  });

  // Criterion 3: the check reports a failing draft under its ID.
  describe('the check', () => {
    it('passes a draft on the standard', () => {
      const { topics } = extractEvalFixtures(
        scenariosFile(scenario('CR-01', 'security', DRAFT)),
      );
      expect(draftProblems(topics)).toEqual({});
    });

    it('reports a draft with no rule of thumb under its ID', () => {
      const broken = DRAFT.replace(
        '\n\n**Rule of thumb.** Cache what is read often and changes rarely.',
        '',
      );
      expect(broken).not.toBe(DRAFT);
      const { topics } = extractEvalFixtures(
        scenariosFile(
          scenario('CR-01', 'security', DRAFT),
          scenario('CR-02', 'security', broken),
        ),
      );
      expect(draftProblems(topics)).toEqual({
        'CR-02': [
          expect.stringContaining('no paragraph opening with bold "Rule of thumb."'),
        ],
      });
    });

    it(`applies the draft's section: a ${SYSTEMS} draft needs "${WHERE}"`, () => {
      const { topics } = extractEvalFixtures(
        scenariosFile(scenario('CR-01', SYSTEMS, DRAFT)),
      );
      expect(draftProblems(topics)).toEqual({
        'CR-01': [expect.stringContaining(`0 "## ${WHERE}" sections`)],
      });
    });

    it("checks the draft's frontmatter title", () => {
      const draft = DRAFT.replace('title: Caching', 'title: What is Caching?');
      const { topics } = extractEvalFixtures(
        scenariosFile(scenario('CR-01', 'security', draft)),
      );
      expect(draftProblems(topics)).toEqual({
        'CR-01': [expect.stringContaining('starts "What is"')],
      });
    });

    // Review decisions: the drafts' frontmatter goes through parseTopicMeta,
    // the contract every published topic's frontmatter meets.
    it.each([
      [
        'no summary',
        'summary: A copy of hot data close to the code that reads it.\n',
        '',
        'missing required frontmatter field "summary"',
      ],
      ['no date', 'date: 2026-10-15\n', '', 'missing required frontmatter field "date"'],
      ['no title', 'title: Caching\n', '', 'missing required frontmatter field "title"'],
      [
        'an extra key',
        'date: 2026-10-15\n',
        'date: 2026-10-15\ntags: [caching]\n',
        'unknown frontmatter field "tags"',
      ],
    ])("reports a draft's frontmatter with %s under its ID", (_, from, to, problem) => {
      expect(DRAFT.split(from)).toHaveLength(2);
      const draft = DRAFT.replace(from, to);
      const { topics } = extractEvalFixtures(
        scenariosFile(
          scenario('CR-01', 'security', DRAFT),
          scenario('CR-02', 'security', draft),
        ),
      );
      expect(draftProblems(topics)).toEqual({
        'CR-02': [expect.stringContaining(problem)],
      });
    });

    it('reports a real CR draft with its rule of thumb removed under its ID', () => {
      const text = scenariosText();
      const [first] = contentReviewFixtures().topics;
      const start = first.raw.indexOf('\n\n**Rule of thumb.**');
      expect(start).toBeGreaterThan(-1);
      const end = first.raw.indexOf('\n\n', start + 2);
      const broken = first.raw.slice(0, start) + (end === -1 ? '' : first.raw.slice(end));
      expect(text.split(first.raw)).toHaveLength(2);
      const { topics } = extractEvalFixtures(text.replace(first.raw, broken));
      expect(draftProblems(topics)[first.id]).toContainEqual(
        expect.stringContaining('no paragraph opening with bold "Rule of thumb."'),
      );
    });
  });

  // Criteria 1, 3 and 5 on the real scenarios file.
  describe('the real scenarios file', () => {
    /** The IDs of every line that reads like a CR scenario heading (`##` to
     * `######`, then `CR-` and a number), except a heading that itself says
     * "retired" (a `## CR-07 — retired` block). It keeps no "inside a retired
     * block" state: a draft line containing "retired" would hide every later
     * scenario, and the helper already throws for a `### CR-` under a retired
     * `##`. A raw line scan that does not track fences, on purpose: a scan
     * that reads fences the way the parser does loses the same scenario a
     * broken fence swallows. No draft holds such a line today. */
    function headingIds(text: string): string[] {
      return text
        .split('\n')
        .filter((line) => !line.toLowerCase().includes('retired'))
        .flatMap((line) => /^#{2,6} (CR-\d+)/.exec(line)?.[1] ?? []);
    }

    it('extracts a draft for every `### CR-` heading, in file order', () => {
      const ids = headingIds(scenariosText());
      expect(ids.length).toBeGreaterThan(0);
      expect(contentReviewFixtures().topics.map((t) => t.id)).toEqual(ids);
    });

    /** The real scenarios text with `from` (which must occur exactly once)
     * replaced by `to`. */
    function plantedScenarios(from: string, to: string): string {
      const text = scenariosText();
      expect(text.split(from)).toHaveLength(2);
      return text.replace(from, to);
    }

    // Review decisions: one bare four-backtick line right after CR-02's
    // closing fence swallowed CR-03 into an unclosed fence. The parser and a
    // fence-tracking scan both lost it, so the IDs still matched and every
    // test stayed green.
    it("catches a scenario swallowed by a neighbour's stray fence", () => {
      const cr02 = contentReviewFixtures().topics.find((t) => t.id === 'CR-02')!;
      const fenced = `\`\`\`\`markdown\n${cr02.raw}\n\`\`\`\``;
      const text = plantedScenarios(fenced, `${fenced}\n\`\`\`\``);
      const extracted = extractEvalFixtures(text).topics.map((t) => t.id);
      expect(extracted).not.toContain('CR-03');
      expect(headingIds(text)).toContain('CR-03');
      expect(extracted).not.toEqual(headingIds(text));
    });

    // Review decisions, round 2: a draft line containing "retired" used to
    // switch the scan's retired toggle on, hiding every later scenario behind
    // an ID mismatch that pointed at the wrong cause.
    it('gives matching IDs when a draft heading contains "retired"', () => {
      const text = plantedScenarios('## What flags cost', '## What retired flags cost');
      expect(headingIds(text)).toContain('CR-03');
      expect(extractEvalFixtures(text).topics.map((t) => t.id)).toEqual(headingIds(text));
    });

    it('catches a CR scenario heading at the wrong depth', () => {
      const text = plantedScenarios('\n### CR-02 ', '\n#### CR-02 ');
      expect(headingIds(text)).toContain('CR-02');
      expect(extractEvalFixtures(text).topics.map((t) => t.id)).not.toEqual(
        headingIds(text),
      );
    });

    it('gives every draft a section, a frontmatter title and a body', () => {
      for (const draft of contentReviewFixtures().topics) {
        const { data, content } = parseFrontmatter(draft.raw);
        expect(draft.section, draft.id).not.toBe('');
        expect(data.title, draft.id).toBeTypeOf('string');
        expect(content.trim(), draft.id).not.toBe('');
      }
    });

    // Criterion 5: CR-01 and the other four-backtick drafts hold inner code
    // blocks; each comes out as everything between its outer fences.
    it('extracts each four-backtick draft with inner code blocks whole', () => {
      const scenarios = scenariosText();
      const nested = contentReviewFixtures().topics.filter((t) =>
        t.raw.includes('\n```'),
      );
      expect(nested.map((t) => t.id)).toContain('CR-01');
      for (const draft of nested) {
        expect(scenarios, draft.id).toContain(`\`\`\`\`markdown\n${draft.raw}\n\`\`\`\``);
        expect(draft.raw.trimEnd().endsWith('```'), draft.id).toBe(false);
      }
    });

    it('passes every check for every CR draft', () => {
      expect(draftProblems(contentReviewFixtures().topics)).toEqual({});
    });
  });
});
