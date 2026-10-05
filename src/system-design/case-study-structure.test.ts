import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';
import { proseWordCount } from '@/lib/markdown.mjs';

/**
 * Content-structure test for docs/specs/system-design-case-studies.md
 * (criterion 12) and docs/specs/case-study-at-a-glance.md (criteria 1-4); the
 * rules are in docs/case-studies.md. Each case study is rendered with the real
 * `MarkdownRenderer` and checked on the DOM it produces, so a heading, link,
 * list item or id counts exactly when the reader's page has it.
 *
 * docs/specs/five-minute-templates.md (criteria 6-8, 10): a page's frontmatter
 * picks its template. With no `template` line it gets the old checks:
 *
 * - the `h2`s are the template, in order, `At a glance` first, with two or
 *   more `Deep dive: <topic>` sections;
 * - `At a glance` holds the four bold lead-ins in order; every list item (a
 *   nested one, and one in a list inside a blockquote, each on its own) under
 *   `Key decisions` and `Likely follow-ups` holds an in-page link of its own;
 *   and the section's last block is a paragraph linking to
 *   `#high-level-architecture`;
 * - every `href="#id"` link names an id the page has;
 * - `High-level architecture` holds a `/diagrams/` image.
 *
 * With `template: 2` it gets the five-minute template:
 *
 * - at least one paragraph before the first `h2`;
 * - the `h2`s exactly: `Requirements`, `Key numbers`, `High-level
 *   architecture`, `API and data model`, three `Decision: <topic>`, `Likely
 *   follow-ups`;
 * - `Requirements`: one list of 4-6 top-level items;
 * - `Key numbers`: a paragraph first, then one list of 4-5 top-level items,
 *   each opening with bold text that begins with a label and a colon;
 * - each `Decision:` section ends with a paragraph opening with bold
 *   `Rule of thumb.`;
 * - `Likely follow-ups`: one list of 4-6 top-level items, each opening with
 *   bold text;
 * - the diagram and in-page link rules above;
 * - `proseWordCount(body)` is at most 1,150.
 *
 * Any other `template` value fails, naming the file and the value.
 */

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FILES = Object.entries(RAW);

const AT_A_GLANCE = 'At a glance';
const BEFORE_DEEP_DIVES = [
  AT_A_GLANCE,
  'Requirements',
  'Back-of-the-envelope estimates',
  'Data model',
  'API design',
  'High-level architecture',
];
const AFTER_DEEP_DIVES = ['Failure modes and bottlenecks', 'Trade-offs'];
const DEEP_DIVE = /^Deep dive: \S.*$/;
const LEAD_INS = ['Requirements', 'Key numbers', 'Key decisions', 'Likely follow-ups'];
const LINKED_LEAD_INS = ['Key decisions', 'Likely follow-ups'];
const ARCHITECTURE_ID = 'high-level-architecture';
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

/** The lead-in label `block` opens with (a paragraph starting with a bold
 * `Label.`), or `undefined`. */
function leadIn(block: Element): string | undefined {
  const first = block.tagName === 'P' ? block.firstChild : null;
  if (!(first instanceof HTMLElement) || first.tagName !== 'STRONG') return undefined;
  const text = first.textContent?.trim() ?? '';
  const label = text.replace(/\.$/, '');
  return text.endsWith('.') && LEAD_INS.includes(label) ? label : undefined;
}

function templateProblems(page: HTMLElement): string[] {
  const headings = [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());
  const head = headings.slice(0, BEFORE_DEEP_DIVES.length);
  const middle = headings.slice(BEFORE_DEEP_DIVES.length, -AFTER_DEEP_DIVES.length);
  const tail = headings.slice(-AFTER_DEEP_DIVES.length);
  const problems: string[] = [];
  if (JSON.stringify(head) !== JSON.stringify(BEFORE_DEEP_DIVES)) {
    problems.push(`opening headings are ${JSON.stringify(head)}`);
  }
  if (JSON.stringify(tail) !== JSON.stringify(AFTER_DEEP_DIVES)) {
    problems.push(`closing headings are ${JSON.stringify(tail)}`);
  }
  if (middle.length < 2) problems.push(`${middle.length} deep dive(s), need 2+`);
  for (const h of middle)
    if (!DEEP_DIVE.test(h ?? '')) problems.push(`not a deep dive: ${h}`);
  return problems;
}

function atAGlanceProblems(page: HTMLElement): string[] {
  const blocks = section(page, AT_A_GLANCE);
  if (!blocks) return [`no "${AT_A_GLANCE}" section`];
  const problems: string[] = [];
  const parts: { label: string; blocks: Element[] }[] = [];
  for (const block of blocks) {
    const label = leadIn(block);
    if (label) parts.push({ label, blocks: [] });
    else parts.at(-1)?.blocks.push(block);
  }
  const labels = parts.map((p) => p.label);
  if (JSON.stringify(labels) !== JSON.stringify(LEAD_INS)) {
    problems.push(
      `lead-ins are ${JSON.stringify(labels)}, need ${JSON.stringify(LEAD_INS)}`,
    );
  }
  for (const part of parts.filter((p) => LINKED_LEAD_INS.includes(p.label))) {
    const items = part.blocks.flatMap((b) => [...b.querySelectorAll('li')]);
    if (items.length === 0) problems.push(`"${part.label}" has no list`);
    items.forEach((li, i) => {
      const own = [...li.querySelectorAll(IN_PAGE)].some((a) => a.closest('li') === li);
      if (!own) problems.push(`"${part.label}" item ${i + 1} has no in-page link`);
    });
  }
  const last = blocks.at(-1);
  const closes =
    last?.tagName === 'P' &&
    !leadIn(last) &&
    last.querySelector(`a[href="#${ARCHITECTURE_ID}"]`) !== null;
  if (!closes)
    problems.push(`does not end with a paragraph linking to #${ARCHITECTURE_ID}`);
  return problems;
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

/** Every rule's problems for `body`, rendered once; [] when it's right. */
function structureProblems(body: string): string[] {
  const page = renderBody(body);
  return [
    ...templateProblems(page),
    ...atAGlanceProblems(page),
    ...brokenInPageLinks(page).map((id) => `broken in-page link #${id}`),
    ...diagramProblems(page),
  ];
}

// ---- Template 2 (docs/specs/five-minute-templates.md, criterion 8) --------

const DECISION = /^Decision: \S.*$/;
const TEMPLATE_2: (string | RegExp)[] = [
  'Requirements',
  'Key numbers',
  'High-level architecture',
  'API and data model',
  DECISION,
  DECISION,
  DECISION,
  'Likely follow-ups',
];
const WORD_BUDGET = 1150;

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

function template2HeadingProblems(page: HTMLElement): string[] {
  const headings = [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());
  const matches =
    headings.length === TEMPLATE_2.length &&
    TEMPLATE_2.every((want, i) =>
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

/** Every template-2 rule's problems for `body`; [] when it's right. */
function template2Problems(body: string): string[] {
  const page = renderBody(body);
  return [
    ...introProblems(page),
    ...template2HeadingProblems(page),
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

/** The problems with one case-study file (frontmatter included), checked
 * against the template its `template` line picks. */
function fileProblems(file: string, raw: string): string[] {
  const { data, content } = parseFrontmatter(raw);
  if (!Object.hasOwn(data, 'template')) return structureProblems(content);
  if (data.template === '2') return template2Problems(content);
  return [`${file}: unknown template ${JSON.stringify(data.template)} (only 2 exists)`];
}

describe('case-study structure (criterion 12; at-a-glance criteria 1-4; five-minute criterion 6)', () => {
  it('has at least one case study to check', () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)('%s follows the template its frontmatter picks', (file, raw) => {
    expect(fileProblems(file, raw)).toEqual([]);
  });
});

describe('the structure check itself', () => {
  const DECISION = '- Random codes: no coordination ([why](#deep-dive-short-codes)).';
  const FOLLOW_UP =
    '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).';
  const CLOSING = 'The full picture is in [the architecture](#high-level-architecture).';
  const GOOD = [
    'Intro paragraph.',
    '## At a glance',
    '**Requirements.** What it must do:',
    '- Shorten a URL; 100 million new links a day.',
    '**Key numbers.** From the estimates:',
    '- ≈ 115,000 redirects/s at peak (10× average).',
    '**Key decisions.** The three that shape it:',
    DECISION,
    '**Likely follow-ups.** What comes next:',
    FOLLOW_UP,
    CLOSING,
    '## Requirements',
    '## Back-of-the-envelope estimates',
    '## Data model',
    '## API design',
    '## High-level architecture',
    '![The architecture](/diagrams/demo/architecture.svg)',
    '## Deep dive: short codes',
    '```md\n## Not a heading, inside a fence\n```',
    '## Deep dive: the read path',
    '## Failure modes and bottlenecks',
    '## Trade-offs',
  ].join('\n\n');

  /** GOOD with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted(from: string, to: string): string {
    expect(GOOD.split(from)).toHaveLength(2);
    return GOOD.replace(from, to);
  }

  it('passes the GOOD fixture on every rule', () => {
    expect(structureProblems(GOOD)).toEqual([]);
  });

  it.each([
    ['no At a glance heading', '## At a glance', 'Summary:', 'no "At a glance" section'],
    [
      'lead-ins out of order',
      '**Requirements.** What it must do:\n\n- Shorten a URL; 100 million new links a day.\n\n**Key numbers.** From the estimates:',
      '**Key numbers.** From the estimates:\n\n- Shorten a URL; 100 million new links a day.\n\n**Requirements.** What it must do:',
      'lead-ins are ["Key numbers","Requirements","Key decisions","Likely follow-ups"]',
    ],
    [
      'a follow-up with no link',
      FOLLOW_UP,
      `${FOLLOW_UP}\n- What if the store is down? Serve stale entries.`,
      '"Likely follow-ups" item 2 has no in-page link',
    ],
    [
      'an unlinked decision nested under a linked one',
      DECISION,
      `${DECISION}\n  - A cache in front of the store: fast reads.`,
      '"Key decisions" item 2 has no in-page link',
    ],
    [
      'an unlinked decision in a blockquoted list',
      DECISION,
      `${DECISION}\n\n> - A fourth decision with no link.`,
      '"Key decisions" item 2 has no in-page link',
    ],
    [
      'a closing sentence folded into the last follow-up',
      `${FOLLOW_UP}\n\n${CLOSING}`,
      `${FOLLOW_UP}\n${CLOSING}`,
      'does not end with a paragraph linking to #high-level-architecture',
    ],
    [
      'a broken in-page link',
      '(#deep-dive-the-read-path)',
      '(#deep-dive-read-path)',
      'broken in-page link #deep-dive-read-path',
    ],
    [
      'a link to a ### heading, which renders with no id',
      '## Trade-offs',
      '## Trade-offs\n\n### Hot keys\n\nSee [hot keys](#hot-keys).',
      'broken in-page link #hot-keys',
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
  ])('fails %s', (_, from, to, problem) => {
    expect(structureProblems(planted(from, to))).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  // Five-minute criterion 6: with no `template` line, a file gets exactly
  // these checks, and no word budget.
  describe('a file with no template line (five-minute criterion 6)', () => {
    const FILE = '/src/system-design/case-studies/demo.md';
    const withFrontmatter = (body: string) =>
      `---\ntitle: Design a Demo\norder: 1\n---\n\n${body}`;

    it('passes the GOOD fixture', () => {
      expect(fileProblems(FILE, withFrontmatter(GOOD))).toEqual([]);
    });

    it('fails an old-template rule as before', () => {
      expect(
        fileProblems(FILE, withFrontmatter(planted('## At a glance', 'Summary:'))),
      ).toContainEqual(expect.stringContaining('no "At a glance" section'));
    });

    it('has no word budget', () => {
      const long = planted(
        'Intro paragraph.',
        `Intro paragraph. ${Array.from({ length: 3000 }, () => 'word').join(' ')}`,
      );
      expect(fileProblems(FILE, withFrontmatter(long))).toEqual([]);
    });
  });

  // Five-minute criterion 7.
  it.each(['3', 'two', '1', '02'])(
    'fails template: %s, naming the file and the value (five-minute criterion 7)',
    (value) => {
      const file = '/src/system-design/case-studies/demo.md';
      const raw = `---\ntitle: Design a Demo\ntemplate: ${value}\n---\n\n${GOOD}`;
      const problems = fileProblems(file, raw);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some((p) => p.includes(file) && p.includes(value))).toBe(true);
    },
  );
});

describe('the template-2 structure check itself (five-minute criteria 8 and 10)', () => {
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
  const GOOD_2 = [
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

  /** GOOD_2 with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted(from: string, to: string): string {
    expect(GOOD_2.split(from)).toHaveLength(2);
    return GOOD_2.replace(from, to);
  }

  /** GOOD_2 with filler words added to its intro until it has `words`. */
  function withWords(words: number): string {
    const missing = words - proseWordCount(GOOD_2);
    expect(missing).toBeGreaterThan(0);
    const body = planted(
      INTRO,
      `${INTRO} ${Array.from({ length: missing }, () => 'word').join(' ')}`,
    );
    expect(proseWordCount(body)).toBe(words);
    return body;
  }

  it('passes the GOOD_2 fixture on every rule', () => {
    expect(template2Problems(GOOD_2)).toEqual([]);
  });

  it('passes GOOD_2 through a file with template: 2', () => {
    const raw = `---\ntitle: Design a Demo\ntemplate: 2\n---\n\n${GOOD_2}`;
    expect(fileProblems('/src/system-design/case-studies/demo.md', raw)).toEqual([]);
  });

  it('checks a file with template: 2 against template 2, not the old template', () => {
    const file = '/src/system-design/case-studies/demo.md';
    expect(fileProblems(file, `---\ntitle: Design a Demo\n---\n\n${GOOD_2}`)).not.toEqual(
      [],
    );
    expect(fileProblems(file, `---\ntemplate: 2\n---\n\n${GOOD_2}`)).toEqual([]);
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
    expect(template2Problems(planted(from, to))).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  it('passes a body of exactly 1,150 words (criterion 10)', () => {
    expect(template2Problems(withWords(1150))).toEqual([]);
  });

  it('fails a body of 1,151 words, naming the count (criterion 10)', () => {
    const problems = template2Problems(withWords(1151));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('1151');
  });
});
