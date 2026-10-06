import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';
import { proseWordCount } from '@/lib/markdown.mjs';
import { WORD_BUDGET } from '@/lib/reading-time';

/**
 * Content-structure test for the DSA entries; the rules are in docs/dsa.md.
 * The templates are the five-minute ones (docs/specs/five-minute-templates.md,
 * criteria 9 and 10), and since docs/specs/retire-template-switch.md (criteria
 * 2, 3, 5, 6 and 7) they are the only ones: an entry's `kind` picks its
 * template, and nothing else in its frontmatter does. Each entry is rendered
 * with the real `MarkdownRenderer` with `codeTabs` on, as the entry page
 * renders it, and checked on the DOM.
 *
 * - the frontmatter keys are exactly `title`, `summary`, `date` and `kind`
 *   (an allowlist: an extra key, `template` included, or a missing one fails,
 *   naming the file and the key);
 * - a data structure's `h2`s are `Prerequisites`, `What it is`, `When to use
 *   it`, `Operations and costs`, `Implementation`, `Pitfalls`, in order (no
 *   `Invariants` or `Tricky lines`); its `Operations and costs` holds a
 *   table, and its `Implementation` holds at least one python+typescript pair;
 * - a pattern's or algorithm's `h2`s are `Prerequisites`, `The idea`, `When
 *   to use it`, `Walkthrough`, `Complexity`, `Pitfalls`, in order; its
 *   `Walkthrough` holds at least two pairs, each followed by a paragraph;
 * - every code block in `Implementation` / `Walkthrough` is part of a pair: a
 *   pair renders as one tablist over one code block, so the section has as
 *   many code blocks (copy buttons) as tablists;
 * - `Prerequisites` is not empty;
 * - `proseWordCount(body)` is at most 1,150.
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

const FILES = Object.entries(RAW);

const ALLOWED_KEYS = ['title', 'summary', 'date', 'kind'];

const TEMPLATES: Record<string, string[]> = {
  'data-structure': [
    'Prerequisites',
    'What it is',
    'When to use it',
    'Operations and costs',
    'Implementation',
    'Pitfalls',
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

/** The problems with an entry of `kind`; [] when it's right. */
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
  } else {
    problems.push(...pairProblems(page, 'Walkthrough', 2, true));
  }
  const prereqs = section(page, 'Prerequisites') ?? [];
  if (!prereqs.some((b) => b.textContent?.trim())) {
    problems.push('"Prerequisites" is empty (say "none" in prose if there are none)');
  }
  const words = proseWordCount(body);
  if (words > WORD_BUDGET) {
    problems.push(`${words} words, over the ${WORD_BUDGET}-word budget`);
  }
  return problems;
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

/** The problems with one entry file, frontmatter included. */
function fileProblems(file: string, raw: string): string[] {
  const { data, content } = parseFrontmatter(raw);
  return [...frontmatterProblems(file, data), ...structureProblems(data.kind, content)];
}

describe('DSA entry structure (retire-template-switch criteria 2, 5 and 7)', () => {
  it('has the three reference entries, one per kind', () => {
    const kinds = Object.fromEntries(ENTRIES.map(([slug, kind]) => [slug, kind]));
    expect(kinds['hash-map']).toBe('data-structure');
    expect(kinds['two-pointers']).toBe('pattern');
    expect(kinds['binary-search']).toBe('algorithm');
  });

  it.each(FILES)('%s follows its kind’s template', (file, raw) => {
    expect(fileProblems(file, raw)).toEqual([]);
  });

  it.each(FILES)('%s has no template line', (_, raw) => {
    expect(raw).not.toMatch(/^template:/m);
  });
});

describe('the structure check itself (five-minute criteria 9 and 10; retire-template-switch criteria 2, 3, 5 and 6)', () => {
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

  const TABLE = '| Operation | Cost |\n| --- | --- |\n| get | O(1) |';

  const DATA_STRUCTURE = [
    '## Prerequisites',
    'None.',
    '## What it is',
    'A thing.',
    '## When to use it',
    'Often.',
    '## Operations and costs',
    TABLE,
    '## Implementation',
    pair(1),
    'How it works.',
    '## Pitfalls',
    'Some.',
  ].join('\n\n');

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
    '## Complexity',
    'O(n).',
    '## Pitfalls',
    'Some.',
  ].join('\n\n');

  function planted(base: string, from: string, to: string): string {
    expect(base.split(from)).toHaveLength(2);
    return base.replace(from, to);
  }

  /** `base` with filler words added after `anchor` (which occurs once) until
   * it has `words`. */
  function withWords(base: string, anchor: string, words: number): string {
    const missing = words - proseWordCount(base);
    expect(missing).toBeGreaterThan(0);
    const body = planted(
      base,
      anchor,
      `${anchor} ${Array.from({ length: missing }, () => 'word').join(' ')}`,
    );
    expect(proseWordCount(body)).toBe(words);
    return body;
  }

  const FILE = '/src/dsa/entries/demo.md';

  /** `body` behind a frontmatter block of `fields`, one `key: value` each. */
  function withFrontmatter(body: string, fields: Record<string, string>): string {
    const lines = Object.entries(fields).map(([key, value]) => `${key}: ${value}`);
    return `---\n${lines.join('\n')}\n---\n\n${body}`;
  }

  const frontmatter = (kind: string): Record<string, string> => ({
    title: 'Demo',
    summary: 'A demo entry.',
    date: '2026-10-06',
    kind,
  });

  const KINDS = [
    ['data-structure', DATA_STRUCTURE],
    ['pattern', PATTERN],
    ['algorithm', PATTERN],
  ] as const;

  it('passes the good fixtures', () => {
    expect(structureProblems('data-structure', DATA_STRUCTURE)).toEqual([]);
    expect(structureProblems('pattern', PATTERN)).toEqual([]);
    expect(structureProblems('algorithm', PATTERN)).toEqual([]);
  });

  // Criterion 2: a body that passed with `template: 2` passes without it.
  it.each(KINDS)(
    '%s: passes through a file with exactly title, summary, date and kind',
    (kind, body) => {
      expect(fileProblems(FILE, withFrontmatter(body, frontmatter(kind)))).toEqual([]);
    },
  );

  // Criterion 5: the frontmatter keys are an allowlist.
  it.each([
    ['template', '2'],
    ['tags', 'x'],
  ])('fails an extra %s key, naming the file and the key', (key, value) => {
    const problems = fileProblems(
      FILE,
      withFrontmatter(PATTERN, { ...frontmatter('pattern'), [key]: value }),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(FILE);
    expect(problems[0]).toContain(`"${key}"`);
  });

  it('fails a missing kind key, naming the file and the key', () => {
    const { kind: _kind, ...rest } = frontmatter('pattern');
    const problems = fileProblems(FILE, withFrontmatter(PATTERN, rest));
    expect(problems).toContainEqual(
      expect.stringMatching(/^\/src\/dsa\/entries\/demo\.md: .*"kind"/),
    );
  });

  // Criterion 3: the old data-structure shape, with `Tricky lines`, is no
  // longer a template; it fails the heading rule.
  it('fails a data structure in the old shape, with Tricky lines, on the heading rule', () => {
    const old = [
      '## Prerequisites',
      'None.',
      '## What it is',
      'A thing.',
      '## Operations and costs',
      TABLE,
      '## Implementation',
      pair(1),
      '## Invariants',
      'Always.',
      '## Tricky lines',
      'Line `x1 = 1` matters.',
      '## When to use it',
      'Often.',
    ].join('\n\n');
    expect(
      fileProblems(FILE, withFrontmatter(old, frontmatter('data-structure'))),
    ).toContainEqual(expect.stringContaining('headings are'));
  });

  it.each([
    ['a missing heading', '## Pitfalls\n\nSome.', '', 'headings are'],
    [
      'headings out of order',
      '## What it is\n\nA thing.\n\n## When to use it',
      '## When to use it\n\nA thing.\n\n## What it is',
      'headings are',
    ],
    ['an old-template heading', '## Pitfalls', '## Tricky lines', 'headings are'],
    [
      'the old template’s extra sections',
      '## Pitfalls',
      '## Invariants\n\nAlways.\n\n## Pitfalls',
      'headings are',
    ],
    ['no table', TABLE, 'get is O(1).', '"Operations and costs" holds no table'],
    ['no implementation pair', pair(1), 'Code goes here.', 'has 0 code pair(s), need 1+'],
    [
      'a lone python fence in Implementation',
      'How it works.',
      'How it works.\n\n```python\nextra = 1\n```',
      'not part of a python+typescript pair',
    ],
  ])('fails a data structure with %s', (_, from, to, problem) => {
    expect(
      structureProblems('data-structure', planted(DATA_STRUCTURE, from, to)),
    ).toContainEqual(expect.stringContaining(problem));
  });

  it.each(['pattern', 'algorithm'])(
    '%s: fails with only one walkthrough pair',
    (kind) => {
      expect(
        structureProblems(kind, planted(PATTERN, `${pair(2)}\n\nWhy two.`, '')),
      ).toContainEqual(expect.stringContaining('has 1 code pair(s), need 2+'));
    },
  );

  it.each([
    ['a missing heading', '## Pitfalls\n\nSome.', '', 'headings are'],
    ['the data-structure template', '## The idea', '## What it is', 'headings are'],
    [
      'a pair with no explanation after it',
      'Why two.',
      '',
      'pair 2 is not followed by a paragraph',
    ],
    [
      'a lone python fence',
      'Why two.',
      'Why two.\n\n```python\nextra = 1\n```\n\nAfter.',
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

  it('fails an unknown kind', () => {
    expect(structureProblems('tree', PATTERN)).toContainEqual(
      expect.stringContaining('unknown kind'),
    );
  });

  it.each([
    ['data-structure', 'A thing.'],
    ['pattern', 'Idea.'],
    ['algorithm', 'Idea.'],
  ])(
    '%s: passes at exactly 1,150 words and fails at 1,151, naming the count (criterion 6)',
    (kind, anchor) => {
      const base = kind === 'data-structure' ? DATA_STRUCTURE : PATTERN;
      expect(structureProblems(kind, withWords(base, anchor, 1150))).toEqual([]);
      const problems = structureProblems(kind, withWords(base, anchor, 1151));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('1151');
    },
  );
});
