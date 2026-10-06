import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';
import { proseWordCount } from '@/lib/markdown.mjs';
import { WORD_BUDGET } from '@/lib/reading-time';

/**
 * Content-structure test for the System Design case studies; the rules are in
 * docs/case-studies.md. The template is the five-minute one
 * (docs/specs/five-minute-templates.md, criteria 8 and 10), and since
 * docs/specs/retire-template-switch.md (criteria 1, 3, 4, 6 and 7) it is the
 * only one: nothing in a page's frontmatter picks it. Each case study is
 * rendered with the real `MarkdownRenderer` and checked on the DOM it
 * produces, so a heading, link, list item or id counts exactly when the
 * reader's page has it.
 *
 * - the frontmatter keys are exactly `title`, `summary`, `date` and `order`
 *   (an allowlist: an extra key, `template` included, or a missing one fails,
 *   naming the file and the key);
 * - at least one paragraph before the first `h2`;
 * - the `h2`s exactly: `Requirements`, `Key numbers`, `High-level
 *   architecture`, `API and data model`, three `Decision: <topic>`, `Likely
 *   follow-ups`;
 * - `Requirements`: one list of 4-6 top-level items;
 * - `Key numbers`: a paragraph first, then one list of 4-5 top-level items,
 *   each opening with bold text that begins with a label and a colon;
 * - each `Decision:` section ends with a paragraph opening with bold
 *   `Rule of thumb.`, with a rule after it;
 * - `Likely follow-ups`: one list of 4-6 top-level items, each opening with
 *   bold text;
 * - `High-level architecture` holds a `/diagrams/` image with alt text;
 * - every `href="#id"` link names an id the page has;
 * - `proseWordCount(body)` is at most 1,150.
 */

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FILES = Object.entries(RAW);

const ALLOWED_KEYS = ['title', 'summary', 'date', 'order'];
const IN_PAGE = 'a[href^="#"]';

function renderBody(body: string): HTMLElement {
  const { container } = render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        ThemeProvider,
        null,
        createElement(MarkdownRenderer, { content: body }),
      ),
    ),
  );
  return container;
}

/** The blocks after `h2`, up to the next `h2`. */
function blocksAfter(h2: Element): Element[] {
  const blocks: Element[] = [];
  for (let el = h2.nextElementSibling; el && el.tagName !== 'H2';) {
    blocks.push(el);
    el = el.nextElementSibling;
  }
  return blocks;
}

/** The blocks after the `h2` titled `heading`, up to the next `h2`; `null`
 * when there's no such `h2`. */
function section(page: HTMLElement, heading: string): Element[] | null {
  const h2 = [...page.querySelectorAll('h2')].find(
    (h) => h.textContent?.trim() === heading,
  );
  return h2 ? blocksAfter(h2) : null;
}

function brokenInPageLinks(page: HTMLElement): string[] {
  const ids = new Set([...page.querySelectorAll('[id]')].map((el) => el.id));
  return [...page.querySelectorAll(IN_PAGE)]
    .map((a) => a.getAttribute('href')!.slice(1))
    .filter((id) => !ids.has(id));
}

function diagramProblems(page: HTMLElement): string[] {
  const blocks = section(page, 'High-level architecture') ?? [];
  const diagrams = blocks
    .flatMap((b) => [
      ...(b.matches('img') ? [b as HTMLImageElement] : []),
      ...b.querySelectorAll<HTMLImageElement>('img'),
    ])
    .filter((img) => /\/diagrams\/.+\.svg$/.test(img.getAttribute('src') ?? ''));
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

function headingProblems(page: HTMLElement): string[] {
  const headings = [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());
  const matches =
    headings.length === TEMPLATE.length &&
    TEMPLATE.every((want, i) =>
      typeof want === 'string' ? headings[i] === want : want.test(headings[i] ?? ''),
    );
  return matches
    ? []
    : [
        `headings are ${JSON.stringify(headings)}, need Requirements, Key numbers, High-level architecture, API and data model, three "Decision: <topic>", Likely follow-ups`,
      ];
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

function budgetProblems(body: string): string[] {
  const words = proseWordCount(body);
  return words <= WORD_BUDGET
    ? []
    : [`${words} words, over the ${WORD_BUDGET}-word budget`];
}

/** Every structure rule's problems for `body`; [] when it's right. */
function structureProblems(body: string): string[] {
  const page = renderBody(body);
  return [
    ...introProblems(page),
    ...headingProblems(page),
    ...listProblems(page, 'Requirements', 4, 6),
    ...keyNumbersProblems(page),
    ...decisionProblems(page),
    ...listProblems(page, 'Likely follow-ups', 4, 6, {
      test: (bold) => bold !== undefined && bold !== '',
      what: 'bold text',
    }),
    ...diagramProblems(page),
    ...brokenInPageLinks(page).map((id) => `broken in-page link #${id}`),
    ...budgetProblems(body),
  ];
}

/** Problems with `file`'s frontmatter keys: each key not in the allowlist,
 * and each allowed key that's missing. */
function frontmatterProblems(file: string, data: Record<string, string>): string[] {
  const keys = Object.keys(data);
  return [
    ...keys
      .filter((key) => !ALLOWED_KEYS.includes(key))
      .map((key) => `${file}: unexpected frontmatter key "${key}"`),
    ...ALLOWED_KEYS.filter((key) => !keys.includes(key)).map(
      (key) => `${file}: missing frontmatter key "${key}"`,
    ),
  ];
}

/** The problems with one case-study file, frontmatter included. */
function fileProblems(file: string, raw: string): string[] {
  const { data, content } = parseFrontmatter(raw);
  return [...frontmatterProblems(file, data), ...structureProblems(content)];
}

describe('case-study structure (retire-template-switch criteria 1, 4 and 7)', () => {
  it('has at least one case study to check', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s follows the template', (file, raw) => {
    expect(fileProblems(file, raw)).toEqual([]);
  });

  it.each(FILES)('%s has no template line', (_, raw) => {
    expect(raw).not.toMatch(/^template:/m);
  });
});

describe('the structure check itself (five-minute criteria 8 and 10; retire-template-switch criteria 1, 3, 4 and 6)', () => {
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
  const GOOD = [
    INTRO,
    '## Requirements',
    'What it must do:',
    REQUIREMENTS,
    '## Key numbers',
    'The estimates that size it:',
    KEY_NUMBERS,
    '## High-level architecture',
    '![The architecture](/diagrams/demo/architecture.svg)',
    '## API and data model',
    'One table, keyed by code.',
    '## Decision: short codes',
    'Random codes, checked on insert.',
    RULE_1,
    '## Decision: the read path',
    'A cache in front of the store.',
    '**Rule of thumb.** Cache the hot set, not everything.',
    '## Decision: storage',
    'A key-value store.',
    '**Rule of thumb.** Use the simplest store that holds the data.',
    '## Likely follow-ups',
    FOLLOW_UPS,
  ].join('\n\n');

  /** GOOD with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted(from: string, to: string): string {
    expect(GOOD.split(from)).toHaveLength(2);
    return GOOD.replace(from, to);
  }

  /** GOOD with filler words added to its intro until it has `words`. */
  function withWords(words: number): string {
    const missing = words - proseWordCount(GOOD);
    expect(missing).toBeGreaterThan(0);
    const body = planted(
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

  // Criterion 4: the frontmatter keys are an allowlist.
  it.each([
    ['template', '2'],
    ['tags', 'x'],
  ])('fails an extra %s key, naming the file and the key', (key, value) => {
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

  it.each([
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
  ])('fails %s', (_, from, to, problem) => {
    expect(structureProblems(planted(from, to))).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  it('passes a body of exactly 1,150 words (criterion 6)', () => {
    expect(structureProblems(withWords(1150))).toEqual([]);
  });

  it('fails a body of 1,151 words, naming the count (criterion 6)', () => {
    const problems = structureProblems(withWords(1151));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('1151');
  });
});
