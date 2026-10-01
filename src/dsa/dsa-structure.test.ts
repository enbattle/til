import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';

/**
 * Content-structure test for docs/specs/dsa-tab.md (criterion 10); the rules
 * are in docs/dsa.md. Each entry is rendered with the real `MarkdownRenderer`
 * with `codeTabs` on, as the entry page renders it, and checked on the DOM:
 *
 * - the `h2`s are its kind's template, in order;
 * - a data structure's `Operations and costs` holds a table, and its
 *   `Implementation` holds at least one python+typescript pair;
 * - a pattern's or algorithm's `Walkthrough` holds at least three pairs, each
 *   followed by a paragraph before anything else;
 * - every code block in `Implementation` / `Walkthrough` is part of a pair: a
 *   pair renders as one tablist over one code block, so the section has as
 *   many code blocks (copy buttons) as tablists.
 */

const RAW = import.meta.glob('/src/dsa/entries/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const ENTRIES = Object.entries(RAW).map(([filePath, raw]) => {
  const { data, content } = parseFrontmatter(raw);
  return [filePath.replace(/^.*\/([^/]+)\.md$/, '$1'), data.kind, content] as const;
});

const TEMPLATES: Record<string, string[]> = {
  'data-structure': [
    'Prerequisites',
    'What it is',
    'Operations and costs',
    'Implementation',
    'Invariants',
    'Tricky lines',
    'When to use it',
  ],
  pattern: [
    'Prerequisites',
    'The idea',
    'When to use it',
    'Walkthrough',
    'Complexity',
    'Pitfalls',
  ],
  algorithm: [
    'Prerequisites',
    'The idea',
    'When to use it',
    'Walkthrough',
    'Complexity',
    'Pitfalls',
  ],
};

afterEach(() => {
  localStorage.clear();
});

function renderBody(body: string): HTMLElement {
  const { container } = render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        ThemeProvider,
        null,
        createElement(
          CodeLanguageProvider,
          null,
          createElement(MarkdownRenderer, { content: body, codeTabs: true }),
        ),
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

function within(blocks: Element[], selector: string): Element[] {
  return blocks.flatMap((b) => [
    ...(b.matches(selector) ? [b] : []),
    ...b.querySelectorAll(selector),
  ]);
}

function copyButtons(blocks: Element[]): Element[] {
  return within(blocks, 'button').filter((b) => /copy/i.test(b.textContent ?? ''));
}

/** Problems with the code pairs in `heading`, needing at least `min` pairs,
 * each followed by a paragraph when `explained`. */
function pairProblems(
  page: HTMLElement,
  heading: string,
  min: number,
  explained: boolean,
): string[] {
  const blocks = section(page, heading);
  if (!blocks) return [`no "${heading}" section`];
  const problems: string[] = [];
  const pairBlocks = blocks.filter((b) =>
    b.matches('[role="tablist"]') ? true : b.querySelector('[role="tablist"]') !== null,
  );
  if (pairBlocks.length < min) {
    problems.push(`"${heading}" has ${pairBlocks.length} code pair(s), need ${min}+`);
  }
  const tablists = within(blocks, '[role="tablist"]').length;
  const codeBlocks = copyButtons(blocks).length;
  if (codeBlocks !== tablists) {
    problems.push(
      `"${heading}" has ${codeBlocks - tablists} code block(s) that are not part of a python+typescript pair`,
    );
  }
  if (explained) {
    pairBlocks.forEach((b, i) => {
      if (b.nextElementSibling?.tagName !== 'P') {
        problems.push(`"${heading}" pair ${i + 1} is not followed by a paragraph`);
      }
    });
  }
  return problems;
}

function structureProblems(kind: string, body: string): string[] {
  const template = TEMPLATES[kind];
  if (!template) return [`unknown kind ${JSON.stringify(kind)}`];
  const page = renderBody(body);
  const problems: string[] = [];
  const headings = [...page.querySelectorAll('h2')].map((h) => h.textContent?.trim());
  if (JSON.stringify(headings) !== JSON.stringify(template)) {
    problems.push(
      `headings are ${JSON.stringify(headings)}, need ${JSON.stringify(template)}`,
    );
  }
  if (kind === 'data-structure') {
    const ops = section(page, 'Operations and costs') ?? [];
    if (within(ops, 'table').length === 0) {
      problems.push('"Operations and costs" holds no table');
    }
    problems.push(...pairProblems(page, 'Implementation', 1, false));
    const tricky = section(page, 'Tricky lines') ?? [];
    if (within(tricky, 'p, li').length === 0) {
      problems.push('"Tricky lines" has no prose');
    }
  } else {
    problems.push(...pairProblems(page, 'Walkthrough', 3, true));
  }
  const prereqs = section(page, 'Prerequisites') ?? [];
  if (!prereqs.some((b) => b.textContent?.trim())) {
    problems.push('"Prerequisites" is empty (say "none" in prose if there are none)');
  }
  return problems;
}

describe('DSA entry structure (criterion 10)', () => {
  it('has the three reference entries, one per kind', () => {
    const kinds = Object.fromEntries(ENTRIES.map(([slug, kind]) => [slug, kind]));
    expect(kinds['hash-map']).toBe('data-structure');
    expect(kinds['two-pointers']).toBe('pattern');
    expect(kinds['binary-search']).toBe('algorithm');
  });

  it.each(ENTRIES)('%s (%s) follows its kind’s template', (_slug, kind, body) => {
    expect(structureProblems(kind, body)).toEqual([]);
  });
});

describe('the structure check itself', () => {
  function pair(n: number): string {
    return [
      '```python',
      `x${n} = ${n}`,
      '```',
      '',
      '```typescript',
      `const x${n} = ${n};`,
      '```',
    ].join('\n');
  }

  const PATTERN = [
    '## Prerequisites',
    'None.',
    '## The idea',
    'Idea.',
    '## When to use it',
    'When.',
    '## Walkthrough',
    pair(1),
    'Why one.',
    pair(2),
    'Why two.',
    pair(3),
    'Why three.',
    '## Complexity',
    'O(n).',
    '## Pitfalls',
    'Some.',
  ].join('\n\n');

  const DATA_STRUCTURE = [
    '## Prerequisites',
    'None.',
    '## What it is',
    'A thing.',
    '## Operations and costs',
    '| Operation | Cost |\n| --- | --- |\n| get | O(1) |',
    '## Implementation',
    pair(1),
    '## Invariants',
    'Always.',
    '## Tricky lines',
    'Line `x1 = 1` matters.',
    '## When to use it',
    'Often.',
  ].join('\n\n');

  function planted(base: string, from: string, to: string): string {
    expect(base.split(from)).toHaveLength(2);
    return base.replace(from, to);
  }

  it('passes the good fixtures', () => {
    expect(structureProblems('pattern', PATTERN)).toEqual([]);
    expect(structureProblems('algorithm', PATTERN)).toEqual([]);
    expect(structureProblems('data-structure', DATA_STRUCTURE)).toEqual([]);
  });

  it.each([
    ['a missing heading', '## Pitfalls\n\nSome.', '', 'headings are'],
    [
      'headings out of order',
      '## The idea\n\nIdea.\n\n## When to use it',
      '## When to use it\n\nIdea.\n\n## The idea',
      'headings are',
    ],
    ['only two pairs', `${pair(3)}\n\nWhy three.`, '', 'has 2 code pair(s), need 3+'],
    [
      'a pair with no explanation after it',
      'Why two.',
      '',
      'pair 2 is not followed by a paragraph',
    ],
    [
      'a lone python fence',
      'Why three.',
      'Why three.\n\n```python\nextra = 1\n```\n\nAfter.',
      'not part of a python+typescript pair',
    ],
    [
      'a pair in the wrong order',
      pair(2),
      ['```typescript', 'const x2 = 2;', '```', '', '```python', 'x2 = 2', '```'].join(
        '\n',
      ),
      'not part of a python+typescript pair',
    ],
  ])('fails a pattern with %s', (_, from, to, problem) => {
    expect(structureProblems('pattern', planted(PATTERN, from, to))).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  it.each([
    [
      'no table',
      '| Operation | Cost |\n| --- | --- |\n| get | O(1) |',
      'get is O(1).',
      'holds no table',
    ],
    ['no implementation pair', pair(1), 'Code goes here.', 'has 0 code pair(s), need 1+'],
    ['the pattern template', '## Invariants', '## Pitfalls', 'headings are'],
  ])('fails a data structure with %s', (_, from, to, problem) => {
    expect(
      structureProblems('data-structure', planted(DATA_STRUCTURE, from, to)),
    ).toContainEqual(expect.stringContaining(problem));
  });

  it('fails an unknown kind', () => {
    expect(structureProblems('tree', PATTERN)).toContainEqual(
      expect.stringContaining('unknown kind'),
    );
  });
});
