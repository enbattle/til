import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/lib/frontmatter';
import { isDiagramSrc, proseWordCount } from '@/lib/markdown.mjs';
import { WORD_BUDGET } from '@/lib/reading-time';
import { RAW_CASE_STUDIES } from '@/test/content';
import {
  blocksAfter,
  frontmatterProblems,
  renderBody,
  section,
  wordBudgetProblems,
} from '@/test/structure';

/**
 * Content-structure test for the System Design case studies. The rules are
 * docs/case-studies.md's; this file checks each one on the DOM the real
 * `MarkdownRenderer` produces, so a heading, link, list item or id counts
 * exactly when the reader's page has it. The shared plumbing is in
 * src/test/structure.ts.
 */

const FILES = Object.entries(RAW_CASE_STUDIES);

const REQUIRED_KEYS = ['title', 'summary', 'date', 'order'];
// docs/specs/case-study-template-3.md: `template: 3` switches a page to
// template 3; no other value is allowed, and a page without it keeps the old
// template until the switch is retired.
const OPTIONAL_KEYS = ['template'];
const TEMPLATE_3 = '3';
const IN_PAGE = 'a[href^="#"]';

function brokenInPageLinks(page: HTMLElement): string[] {
  const ids = new Set([...page.querySelectorAll('[id]')].map((el) => el.id));
  return [...page.querySelectorAll(IN_PAGE)]
    .map((a) => a.getAttribute('href')!.slice(1))
    .filter((id) => !ids.has(id));
}

/** Whether a rendered `img` is a diagram: its src, less the site's base path,
 * is a `/diagrams/` URL as `isDiagramSrc` reads one. */
function isDiagramImg(img: HTMLImageElement): boolean {
  const base = import.meta.env.BASE_URL;
  const src = img.getAttribute('src') ?? '';
  return src.startsWith(base) && isDiagramSrc(`/${src.slice(base.length)}`);
}

function diagramProblems(page: HTMLElement): string[] {
  const blocks = section(page, 'High-level architecture') ?? [];
  const diagrams = blocks
    .flatMap((b) => [
      ...(b.matches('img') ? [b as HTMLImageElement] : []),
      ...b.querySelectorAll<HTMLImageElement>('img'),
    ])
    .filter(isDiagramImg);
  if (diagrams.length === 0)
    return ['no /diagrams/ image inside High-level architecture'];
  return diagrams.some((img) => (img.getAttribute('alt') ?? '').trim())
    ? []
    : ['the High-level architecture diagram has no alt text'];
}

const DECISION = /^Decision: \S.*$/;
const TEMPLATE: (string | RegExp)[] = [
  'Requirements',
  'Key numbers',
  'High-level architecture',
  'API and data model',
  DECISION,
  DECISION,
  DECISION,
  'Likely follow-ups',
];

/** The text of the bold that `block` (a list item or paragraph) opens with,
 * looking through a loose item's paragraph; `undefined` when it doesn't open
 * with bold. */
function openingBold(block: Element): string | undefined {
  let node = block.firstChild;
  while (node && node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
    node = node.nextSibling;
  }
  if (!(node instanceof HTMLElement)) return undefined;
  if (node.tagName === 'P' && block.tagName === 'LI') return openingBold(node);
  return node.tagName === 'STRONG' ? (node.textContent?.trim() ?? '') : undefined;
}

function introProblems(page: HTMLElement): string[] {
  const first = page.querySelector('h2');
  if (!first) return ['no h2 at all'];
  for (let el = first.previousElementSibling; el; el = el.previousElementSibling) {
    if (el.tagName === 'P') return [];
  }
  return ['no paragraph before the first h2'];
}

const START_SIMPLE = /^Start simple(: \S.*)?$/;
const TEMPLATE_3_HEADINGS: (string | RegExp)[] = [
  'Requirements',
  START_SIMPLE,
  'High-level architecture',
  'Key numbers',
  'API and data model',
  DECISION,
  DECISION,
  DECISION,
  'Likely follow-ups',
];

const OLD_NEED =
  'need Requirements, Key numbers, High-level architecture, API and data model, three "Decision: <topic>", Likely follow-ups';
const TEMPLATE_3_NEED =
  'need Requirements, Start simple, High-level architecture, Key numbers, API and data model, three "Decision: <topic>", Likely follow-ups';

/** The heading rule: the page's h2s are exactly `template`, in order. */
function headingProblems(
  page: HTMLElement,
  template: (string | RegExp)[] = TEMPLATE,
  need = OLD_NEED,
): string[] {
  const headings = [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());
  const matches =
    headings.length === template.length &&
    template.every((want, i) =>
      typeof want === 'string' ? headings[i] === want : want.test(headings[i] ?? ''),
    );
  return matches ? [] : [`headings are ${JSON.stringify(headings)}, ${need}`];
}

/** Template 3's "Start simple" section holds at least one paragraph and at
 * least one code block, fenced or indented (the worked arithmetic). */
function startSimpleProblems(page: HTMLElement): string[] {
  const h2 = [...page.querySelectorAll('h2')].find((h) =>
    START_SIMPLE.test(h.textContent?.trim() ?? ''),
  );
  if (!h2) return ['no "Start simple" section'];
  const blocks = blocksAfter(h2);
  const problems: string[] = [];
  if (!blocks.some((b) => b.tagName === 'P')) {
    problems.push('"Start simple" has no paragraph');
  }
  if (!blocks.some((b) => b.matches('pre') || b.querySelector('pre'))) {
    problems.push('"Start simple" has no code block');
  }
  return problems;
}

/** Problems with the one list `heading` must hold: `min`-`max` top-level
 * items, each opening with bold that `opens` accepts (when given). */
function listProblems(
  page: HTMLElement,
  heading: string,
  min: number,
  max: number,
  opens?: { test: (bold: string | undefined) => boolean; what: string },
): string[] {
  const blocks = section(page, heading);
  if (!blocks) return [`no "${heading}" section`];
  const lists = blocks.filter((b) => b.tagName === 'UL' || b.tagName === 'OL');
  if (lists.length !== 1) return [`"${heading}" has ${lists.length} lists, need 1`];
  const items = [...lists[0].children].filter((c) => c.tagName === 'LI');
  const problems: string[] = [];
  if (items.length < min || items.length > max) {
    problems.push(`"${heading}" has ${items.length} items, need ${min}-${max}`);
  }
  if (opens) {
    items.forEach((li, i) => {
      if (!opens.test(openingBold(li))) {
        problems.push(`"${heading}" item ${i + 1} does not open with ${opens.what}`);
      }
    });
  }
  return problems;
}

function keyNumbersProblems(page: HTMLElement): string[] {
  const blocks = section(page, 'Key numbers');
  const problems: string[] = [];
  if (blocks && blocks[0]?.tagName !== 'P') {
    problems.push('"Key numbers" does not open with a paragraph');
  }
  return [
    ...problems,
    ...listProblems(page, 'Key numbers', 4, 5, {
      test: (bold) => bold !== undefined && /^[^\s:][^:]*:/.test(bold),
      what: 'bold "Label:"',
    }),
  ];
}

function decisionProblems(page: HTMLElement): string[] {
  return [...page.querySelectorAll('h2')]
    .filter((h2) => DECISION.test(h2.textContent?.trim() ?? ''))
    .flatMap((h2) => {
      const last = blocksAfter(h2).at(-1);
      const name = h2.textContent?.trim();
      const rule = last?.tagName === 'P' ? openingBold(last) : undefined;
      if (rule !== 'Rule of thumb.') {
        return [
          `"${name}" does not end with a paragraph opening with bold "Rule of thumb."`,
        ];
      }
      const text = last?.textContent?.trim() ?? '';
      return text.slice(text.indexOf(rule) + rule.length).trim()
        ? []
        : [`"${name}" has a "Rule of thumb." paragraph with no rule after it`];
    });
}

/** Every structure rule's problems for `body`, on the old template or (with
 * `template` "3") template 3; [] when it's right. */
function structureProblems(body: string, template?: string): string[] {
  const page = renderBody(body);
  const isTemplate3 = template === TEMPLATE_3;
  return [
    ...introProblems(page),
    ...(isTemplate3
      ? [
          ...headingProblems(page, TEMPLATE_3_HEADINGS, TEMPLATE_3_NEED),
          ...startSimpleProblems(page),
        ]
      : headingProblems(page)),
    ...listProblems(page, 'Requirements', 4, 6),
    ...keyNumbersProblems(page),
    ...decisionProblems(page),
    ...listProblems(page, 'Likely follow-ups', 4, 6, {
      test: (bold) => bold !== undefined && bold !== '',
      what: 'bold text',
    }),
    ...diagramProblems(page),
    ...brokenInPageLinks(page).map((id) => `broken in-page link #${id}`),
    ...wordBudgetProblems(body, WORD_BUDGET),
  ];
}

/** The problems with one case-study file, frontmatter included. */
function fileProblems(file: string, raw: string): string[] {
  const { data, content } = parseFrontmatter(raw);
  const badTemplate =
    'template' in data && data.template !== TEMPLATE_3
      ? [
          `${file}: frontmatter key "template" must be ${TEMPLATE_3}, got ${JSON.stringify(data.template)}`,
        ]
      : [];
  return [
    ...frontmatterProblems(file, data, REQUIRED_KEYS, OPTIONAL_KEYS),
    ...badTemplate,
    ...structureProblems(content, data.template),
  ];
}

// Each file is checked on the template its frontmatter names: `template: 3`
// on template 3, no `template` on the old one (case-study-template-3
// criterion 8).
describe('case-study structure (retire-template-switch criteria 1, 4 and 7; case-study-template-3 criterion 8)', () => {
  it('has at least one case study to check', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s follows the template', (file, raw) => {
    expect(fileProblems(file, raw)).toEqual([]);
  });
});

describe('the structure check itself (five-minute criteria 8 and 10; retire-template-switch criteria 1, 3, 4 and 6; case-study-template-3 criteria 2, 4 and 5)', () => {
  const INTRO = 'A URL shortener turns a long link into a short one.';
  const REQUIREMENTS = [
    '- Shorten a URL to a seven-character code.',
    '- Redirect a code to its URL fast.',
    '- Keep links for ten years.',
    '- Take 100 million new links a day.',
  ].join('\n');
  const KEY_NUMBERS = [
    '- **Writes:** about 1,200 a second.',
    '- **Reads: about 116,000 a second at peak.** Ten times the average.',
    '- **Storage:** 18 TB over ten years.',
    '- **Cache:** 20 GB holds the hot set.',
  ].join('\n');
  const FOLLOW_UPS = [
    '- **Custom aliases?** A uniqueness check ([codes](#decision-short-codes)).',
    '- **Analytics?** A click stream to a warehouse.',
    '- **Abuse?** Rate limits per key.',
    '- **Expiry?** A TTL column.',
  ].join('\n');
  const RULE_1 = '**Rule of thumb.** Prefer codes that need no coordination.';
  // Each section on its own, so GOOD (the old template) and GOOD_3 (template
  // 3) share every section's text and the same planted case fits both.
  const S_REQUIREMENTS = ['## Requirements', 'What it must do:', REQUIREMENTS].join(
    '\n\n',
  );
  const S_KEY_NUMBERS = [
    '## Key numbers',
    'The estimates that size it:',
    KEY_NUMBERS,
  ].join('\n\n');
  const ARCHITECTURE_PARAGRAPH = 'Writes go to the store; reads go through a cache.';
  const S_ARCHITECTURE = [
    '## High-level architecture',
    '![The architecture](/diagrams/demo/architecture.svg)',
  ].join('\n\n');
  const S_API = ['## API and data model', 'One table, keyed by code.'].join('\n\n');
  const S_DECISIONS = [
    '## Decision: short codes',
    'Random codes, checked on insert.',
    RULE_1,
    '## Decision: the read path',
    'A cache in front of the store.',
    '**Rule of thumb.** Cache the hot set, not everything.',
    '## Decision: storage',
    'A key-value store.',
    '**Rule of thumb.** Use the simplest store that holds the data.',
  ].join('\n\n');
  const S_FOLLOW_UPS = ['## Likely follow-ups', FOLLOW_UPS].join('\n\n');
  const GOOD = [
    INTRO,
    S_REQUIREMENTS,
    S_KEY_NUMBERS,
    S_ARCHITECTURE,
    S_API,
    S_DECISIONS,
    S_FOLLOW_UPS,
  ].join('\n\n');

  // Template 3 (docs/specs/case-study-template-3.md): "Start simple" second,
  // with a paragraph and the worked arithmetic as a code block, then
  // the architecture (diagram plus short paragraphs) before Key numbers.
  const START_PARAGRAPH = 'One database and no cache: every redirect reads it.';
  const START_CODE = [
    '```text',
    'peak reads   = 116,000 a second',
    'one database = 10,000 reads a second',
    'databases    = 116,000 / 10,000 = 12',
    '```',
  ].join('\n');
  const S_START = ['## Start simple', START_PARAGRAPH, START_CODE].join('\n\n');
  const S_ARCHITECTURE_3 = `${S_ARCHITECTURE}\n\n${ARCHITECTURE_PARAGRAPH}`;
  const SECTIONS_3 = [
    INTRO,
    S_REQUIREMENTS,
    S_START,
    S_ARCHITECTURE_3,
    S_KEY_NUMBERS,
    S_API,
    S_DECISIONS,
    S_FOLLOW_UPS,
  ];
  const GOOD_3 = SECTIONS_3.join('\n\n');

  /** `base` with `from` (which must occur in it exactly once) replaced by `to`. */
  function plantedIn(base: string, from: string, to: string): string {
    expect(base.split(from)).toHaveLength(2);
    return base.replace(from, to);
  }

  /** GOOD with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted(from: string, to: string): string {
    return plantedIn(GOOD, from, to);
  }

  /** GOOD_3 with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted3(from: string, to: string): string {
    return plantedIn(GOOD_3, from, to);
  }

  /** `base` (GOOD by default) with filler words added to its intro until it
   * has `words`. */
  function withWords(words: number, base = GOOD): string {
    const missing = words - proseWordCount(base);
    expect(missing).toBeGreaterThan(0);
    const body = plantedIn(
      base,
      INTRO,
      `${INTRO} ${Array.from({ length: missing }, () => 'word').join(' ')}`,
    );
    expect(proseWordCount(body)).toBe(words);
    return body;
  }

  const FILE = '/src/system-design/case-studies/demo.md';
  const FRONTMATTER: Record<string, string> = {
    title: 'Design a Demo',
    summary: 'A demo case study.',
    date: '2026-10-06',
    order: '1',
  };

  /** `body` behind a frontmatter block of `fields`, one `key: value` each. */
  function withFrontmatter(body: string, fields = FRONTMATTER): string {
    const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
    return `---\n${lines.join('\n')}\n---\n\n${body}`;
  }

  it('passes the GOOD fixture on every rule', () => {
    expect(structureProblems(GOOD)).toEqual([]);
  });

  // Criterion 1: a body that passed with `template: 2` passes without it.
  it('passes GOOD through a file with exactly title, summary, date and order', () => {
    expect(fileProblems(FILE, withFrontmatter(GOOD))).toEqual([]);
  });

  // Criterion 4 (and template-3 criterion 4): the frontmatter keys are an
  // allowlist; `template` is allowed only with the value 3.
  it.each([
    ['template', '2'],
    ['template', 'three'],
    ['template', ''],
    ['tags', 'x'],
  ])('fails an extra %s key of %j, naming the file and the key', (key, value) => {
    const problems = fileProblems(
      FILE,
      withFrontmatter(GOOD, { ...FRONTMATTER, [key]: value }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(FILE);
    expect(problems[0]).toContain(`"${key}"`);
  });

  it('fails a missing order key, naming the file and the key', () => {
    const { order: _order, ...rest } = FRONTMATTER;
    const problems = fileProblems(FILE, withFrontmatter(GOOD, rest));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(FILE);
    expect(problems[0]).toContain('"order"');
  });

  // Criterion 3: the old shape (`At a glance` first, `Deep dive:` sections)
  // is no longer a template; it fails the heading rule.
  it('fails a body in the old shape on the heading rule', () => {
    const old = [
      'Intro paragraph.',
      '## At a glance',
      '**Requirements.** What it must do:',
      '- Shorten a URL ([codes](#deep-dive-short-codes)).',
      'The full picture is in [the architecture](#high-level-architecture).',
      '## Requirements',
      '## Back-of-the-envelope estimates',
      '## Data model',
      '## API design',
      '## High-level architecture',
      '![The architecture](/diagrams/demo/architecture.svg)',
      '## Deep dive: short codes',
      '## Deep dive: the read path',
      '## Failure modes and bottlenecks',
      '## Trade-offs',
    ].join('\n\n');
    expect(fileProblems(FILE, withFrontmatter(old))).toContainEqual(
      expect.stringContaining('headings are'),
    );
  });

  /** [name, from, to, problem]: GOOD with `from` planted as `to` fails with a
   * problem containing `problem`. */
  const CASES: [string, string, string, string][] = [
    [
      'no paragraph before the first h2',
      `${INTRO}\n\n`,
      '',
      'no paragraph before the first h2',
    ],
    [
      'a missing heading',
      '## API and data model\n\nOne table, keyed by code.\n\n',
      '',
      'headings are',
    ],
    [
      'an old-template heading',
      '## Key numbers',
      '## Back-of-the-envelope estimates',
      'headings are',
    ],
    [
      'headings out of order',
      '## Requirements\n\nWhat it must do:\n\n' + REQUIREMENTS + '\n\n## Key numbers',
      '## Key numbers\n\nWhat it must do:\n\n' + REQUIREMENTS + '\n\n## Requirements',
      'headings are',
    ],
    ['two decisions', '## Decision: storage', 'Storage, too:', 'headings are'],
    [
      'four decisions',
      '## Likely follow-ups',
      '## Decision: ids\n\nIds.\n\n**Rule of thumb.** Short.\n\n## Likely follow-ups',
      'headings are',
    ],
    [
      'a decision heading with no topic',
      '## Decision: storage',
      '## Decision:',
      'headings are',
    ],
    [
      'three requirements',
      '\n- Keep links for ten years.',
      '',
      '"Requirements" has 3 items, need 4-6',
    ],
    [
      'seven requirements',
      '- Keep links for ten years.',
      '- Keep links for ten years.\n- One.\n- Two.\n- Three.',
      '"Requirements" has 7 items, need 4-6',
    ],
    [
      'requirements as two lists',
      '- Keep links for ten years.',
      '- Keep links for ten years.\n\nAlso:\n\n- More.',
      '"Requirements" has 2 lists, need 1',
    ],
    [
      'requirements in prose',
      REQUIREMENTS,
      'It shortens URLs.',
      '"Requirements" has 0 lists, need 1',
    ],
    [
      'key numbers with no paragraph first',
      'The estimates that size it:\n\n',
      '',
      '"Key numbers" does not open with a paragraph',
    ],
    [
      'three key numbers',
      '\n- **Cache:** 20 GB holds the hot set.',
      '',
      '"Key numbers" has 3 items, need 4-5',
    ],
    [
      'six key numbers',
      '- **Cache:** 20 GB holds the hot set.',
      '- **Cache:** 20 GB holds the hot set.\n- **Servers:** 10.\n- **Bandwidth:** 1 Gb/s.',
      '"Key numbers" has 6 items, need 4-5',
    ],
    [
      'a key number with no bold',
      '- **Storage:** 18 TB over ten years.',
      '- Storage: 18 TB over ten years.',
      '"Key numbers" item 3 does not open with bold "Label:"',
    ],
    [
      'a key number whose bold has no colon',
      '- **Storage:** 18 TB',
      '- **Storage** 18 TB',
      '"Key numbers" item 3 does not open with bold "Label:"',
    ],
    [
      'a key number with bold later in the line',
      '- **Storage:** 18 TB over ten years.',
      '- About **Storage:** 18 TB over ten years.',
      '"Key numbers" item 3 does not open with bold "Label:"',
    ],
    [
      'a decision with no rule of thumb',
      `\n\n${RULE_1}`,
      '',
      '"Decision: short codes" does not end with a paragraph opening with bold "Rule of thumb."',
    ],
    [
      'a rule of thumb that is not the last block',
      RULE_1,
      `${RULE_1}\n\nOne more thought.`,
      '"Decision: short codes" does not end with a paragraph opening with bold "Rule of thumb."',
    ],
    [
      'a rule of thumb that is not bold',
      RULE_1,
      'Rule of thumb. Prefer codes that need no coordination.',
      '"Decision: short codes" does not end',
    ],
    [
      'a rule of thumb with no rule after the bold label',
      RULE_1,
      '**Rule of thumb.**',
      '"Decision: short codes" has a "Rule of thumb." paragraph with no rule after it',
    ],
    [
      'three follow-ups',
      '\n- **Expiry?** A TTL column.',
      '',
      '"Likely follow-ups" has 3 items, need 4-6',
    ],
    [
      'seven follow-ups',
      '- **Expiry?** A TTL column.',
      '- **Expiry?** A TTL column.\n- **A?** A.\n- **B?** B.\n- **C?** C.',
      '"Likely follow-ups" has 7 items, need 4-6',
    ],
    [
      'a follow-up with no bold',
      '- **Abuse?** Rate limits per key.',
      '- Abuse? Rate limits per key.',
      '"Likely follow-ups" item 3 does not open with bold text',
    ],
    [
      'no architecture diagram',
      '![The architecture](/diagrams/demo/architecture.svg)',
      'A diagram belongs here.',
      'no /diagrams/ image inside High-level architecture',
    ],
    [
      'an architecture image that is not a /diagrams/ SVG',
      '![The architecture](/diagrams/demo/architecture.svg)',
      '![The architecture](/images/architecture.png)',
      'no /diagrams/ image inside High-level architecture',
    ],
    [
      'an architecture diagram with no alt text',
      '![The architecture](/diagrams/demo/architecture.svg)',
      '![](/diagrams/demo/architecture.svg)',
      'has no alt text',
    ],
    [
      'a broken in-page link',
      '(#decision-short-codes)',
      '(#decision-codes)',
      'broken in-page link #decision-codes',
    ],
  ];

  // template-3 criterion 5: on a page without `template`, every old-template
  // planted case still fails exactly as before.
  it.each(CASES)('fails %s', (_, from, to, problem) => {
    expect(structureProblems(planted(from, to))).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  // template-3 criterion 6, last bullet: every rule but the heading rule
  // fails a template-3 page as it does an old-template one. The heading cases
  // are template 3's own, below.
  it.each(CASES.filter(([, , , problem]) => problem !== 'headings are'))(
    'fails %s on a template-3 page',
    (_, from, to, problem) => {
      expect(structureProblems(planted3(from, to), '3')).toContainEqual(
        expect.stringContaining(problem),
      );
    },
  );

  // template-3 criterion 2: the ten-minute budget, 2,300 words, on both
  // templates.
  it.each([
    ['the old template', GOOD, undefined],
    ['template 3', GOOD_3, '3'],
  ] as const)('passes a body of exactly 2,300 words on %s', (_, base, template) => {
    expect(structureProblems(withWords(2300, base), template)).toEqual([]);
  });

  it.each([
    ['the old template', GOOD, undefined],
    ['template 3', GOOD_3, '3'],
  ] as const)(
    'fails a body of 2,301 words on %s, naming the count',
    (_, base, template) => {
      const problems = structureProblems(withWords(2301, base), template);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('2301');
    },
  );

  describe('template 3 (case-study-template-3 criteria 4, 6 and 7)', () => {
    it('passes the GOOD_3 fixture on every rule', () => {
      expect(structureProblems(GOOD_3, '3')).toEqual([]);
    });

    it('passes GOOD_3 through a file with title, summary, date, order and template: 3', () => {
      expect(
        fileProblems(FILE, withFrontmatter(GOOD_3, { ...FRONTMATTER, template: '3' })),
      ).toEqual([]);
    });

    it('accepts "Start simple: the naive feed" as the heading', () => {
      expect(
        structureProblems(
          planted3('## Start simple', '## Start simple: the naive feed'),
          '3',
        ),
      ).toEqual([]);
    });

    /** SECTIONS_3 with the sections at `from` and `to` swapped, joined. */
    function swapped(from: string, to: string): string {
      const sections = [...SECTIONS_3];
      const [i, j] = [sections.indexOf(from), sections.indexOf(to)];
      expect(i).toBeGreaterThan(-1);
      expect(j).toBeGreaterThan(-1);
      [sections[i], sections[j]] = [sections[j], sections[i]];
      return sections.join('\n\n');
    }

    it.each([
      ['the old order', GOOD],
      ['no "Start simple"', SECTIONS_3.filter((s) => s !== S_START).join('\n\n')],
      [
        '"Key numbers" before "High-level architecture"',
        swapped(S_ARCHITECTURE_3, S_KEY_NUMBERS),
      ],
      ['"Start simple" after the architecture', swapped(S_START, S_ARCHITECTURE_3)],
      ['two decisions', GOOD_3.replace('## Decision: storage', 'Storage, too:')],
      [
        'four decisions',
        GOOD_3.replace(
          '## Likely follow-ups',
          '## Decision: ids\n\nIds.\n\n**Rule of thumb.** Short.\n\n## Likely follow-ups',
        ),
      ],
      [
        '"Start simple:" with no topic',
        GOOD_3.replace('## Start simple', '## Start simple:'),
      ],
    ])('fails %s on the template-3 heading rule', (_, body) => {
      expect(body).not.toBe(GOOD_3);
      expect(structureProblems(body, '3')).toContainEqual(
        expect.stringContaining(TEMPLATE_3_NEED),
      );
    });

    it.each([
      ['with no code block', `\n\n${START_CODE}`, '', '"Start simple" has no code block'],
      [
        'with no paragraph',
        `${START_PARAGRAPH}\n\n`,
        '',
        '"Start simple" has no paragraph',
      ],
    ])('fails a "Start simple" section %s', (_, from, to, problem) => {
      expect(structureProblems(planted3(from, to), '3')).toContainEqual(problem);
    });

    it('does not count a code block outside "Start simple"', () => {
      const body = planted3(`\n\n${START_CODE}`, '').replace(
        ARCHITECTURE_PARAGRAPH,
        `${ARCHITECTURE_PARAGRAPH}\n\n${START_CODE}`,
      );
      expect(structureProblems(body, '3')).toContainEqual(
        '"Start simple" has no code block',
      );
    });

    // Criterion 7: no cross-over between the templates.
    it('fails a page without template laid out in the template-3 order, on the old heading rule', () => {
      expect(fileProblems(FILE, withFrontmatter(GOOD_3))).toContainEqual(
        expect.stringContaining(OLD_NEED),
      );
    });

    it('fails a template: 3 page in the old order, on the template-3 heading rule', () => {
      expect(
        fileProblems(FILE, withFrontmatter(GOOD, { ...FRONTMATTER, template: '3' })),
      ).toContainEqual(expect.stringContaining(TEMPLATE_3_NEED));
    });
  });
});
