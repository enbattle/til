import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';

/**
 * Content-structure test for docs/specs/system-design-case-studies.md
 * (criterion 12) and docs/specs/case-study-at-a-glance.md (criteria 1-4); the
 * rules are in docs/case-studies.md. Each case study is rendered with the real
 * `MarkdownRenderer` and checked on the DOM it produces, so a heading, link,
 * list item or id counts exactly when the reader's page has it:
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
 */

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CASES = Object.entries(RAW).map(([filePath, raw]) => [
  filePath.replace(/^.*\/([^/]+)\.md$/, '$1'),
  parseFrontmatter(raw).content,
]);

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

/** The blocks after the `h2` titled `heading`, up to the next `h2`; `null`
 * when there's no such `h2`. */
function section(page: HTMLElement, heading: string): Element[] | null {
  const h2 = [...page.querySelectorAll('h2')].find(
    (h) => h.textContent?.trim() === heading,
  );
  if (!h2) return null;
  const blocks: Element[] = [];
  for (let el = h2.nextElementSibling; el && el.tagName !== 'H2';) {
    blocks.push(el);
    el = el.nextElementSibling;
  }
  return blocks;
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

describe('case-study structure (criterion 12; at-a-glance criteria 1-4)', () => {
  it('has at least one case study to check', () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it.each(CASES)(
    '%s follows the template, At a glance rules, links and diagram',
    (_, body) => {
      expect(structureProblems(body)).toEqual([]);
    },
  );
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
});
