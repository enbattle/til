import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';
import { proseWordCount } from '@/lib/markdown.mjs';

/**
 * Content-structure test for docs/specs/dsa-tab.md (criterion 10); the rules
 * are in docs/dsa.md. Each entry is rendered with the real `MarkdownRenderer`
 * with `codeTabs` on, as the entry page renders it, and checked on the DOM.
 *
 * docs/specs/five-minute-templates.md (criteria 6, 7, 9, 10): an entry's
 * frontmatter picks its template. With no `template` line it gets the old
 * checks:
 *
 * - the `h2`s are its kind's template, in order;
 * - a data structure's `Operations and costs` holds a table, and its
 *   `Implementation` holds at least one python+typescript pair;
 * - a pattern's or algorithm's `Walkthrough` holds at least three pairs, each
 *   followed by a paragraph before anything else;
 * - every code block in `Implementation` / `Walkthrough` is part of a pair: a
 *   pair renders as one tablist over one code block, so the section has as
 *   many code blocks (copy buttons) as tablists.
 *
 * With `template: 2`:
 *
 * - a data structure's `h2`s are `Prerequisites`, `What it is`, `When to use
 *   it`, `Operations and costs`, `Implementation`, `Pitfalls`, with the same
 *   table and pair rules (no `Tricky lines`);
 * - a pattern's or algorithm's are today's, with `Walkthrough` needing at
 *   least two pairs, each followed by a paragraph;
 * - `proseWordCount(body)` is at most 1,150.
 *
 * Any other `template` value fails, naming the file and the value.
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

const TEMPLATES_2: Record<string, string[]> = {
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
const WORD_BUDGET = 1150;

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

/** The problems with an entry of `kind` against template `version` (1, the
 * old template, by default); [] when it's right. */
function structureProblems(kind: string, body: string, version: 1 | 2 = 1): string[] {
  const template = (version === 2 ? TEMPLATES_2 : TEMPLATES)[kind];
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
    if (version === 1) {
      const tricky = section(page, 'Tricky lines') ?? [];
      if (within(tricky, 'p, li').length === 0) {
        problems.push('"Tricky lines" has no prose');
      }
    }
  } else {
    problems.push(...pairProblems(page, 'Walkthrough', version === 2 ? 2 : 3, true));
  }
  const prereqs = section(page, 'Prerequisites') ?? [];
  if (!prereqs.some((b) => b.textContent?.trim())) {
    problems.push('"Prerequisites" is empty (say "none" in prose if there are none)');
  }
  if (version === 2) {
    const words = proseWordCount(body);
    if (words > WORD_BUDGET) {
      problems.push(`${words} words, over the ${WORD_BUDGET}-word budget`);
    }
  }
  return problems;
}

/** The problems with one entry file (frontmatter included), checked against
 * the template its `template` line picks. */
function fileProblems(file: string, raw: string): string[] {
  const { data, content } = parseFrontmatter(raw);
  if (!Object.hasOwn(data, 'template')) return structureProblems(data.kind, content);
  if (data.template === '2') return structureProblems(data.kind, content, 2);
  return [`${file}: unknown template ${JSON.stringify(data.template)} (only 2 exists)`];
}

describe('DSA entry structure (criterion 10; five-minute criterion 6)', () => {
  it('has the three reference entries, one per kind', () => {
    const kinds = Object.fromEntries(ENTRIES.map(([slug, kind]) => [slug, kind]));
    expect(kinds['hash-map']).toBe('data-structure');
    expect(kinds['two-pointers']).toBe('pattern');
    expect(kinds['binary-search']).toBe('algorithm');
  });

  it.each(FILES)('%s follows the template its frontmatter picks', (file, raw) => {
    expect(fileProblems(file, raw)).toEqual([]);
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

  // Five-minute criterion 6: with no `template` line, a file gets exactly
  // these checks, and no word budget.
  describe('a file with no template line (five-minute criterion 6)', () => {
    const FILE = '/src/dsa/entries/demo.md';
    const withFrontmatter = (kind: string, body: string) =>
      `---\ntitle: Demo\nkind: ${kind}\n---\n\n${body}`;

    it('passes the good fixtures', () => {
      expect(fileProblems(FILE, withFrontmatter('pattern', PATTERN))).toEqual([]);
      expect(
        fileProblems(FILE, withFrontmatter('data-structure', DATA_STRUCTURE)),
      ).toEqual([]);
    });

    it('still needs three walkthrough pairs', () => {
      const body = planted(PATTERN, `${pair(3)}\n\nWhy three.`, '');
      expect(fileProblems(FILE, withFrontmatter('pattern', body))).toContainEqual(
        expect.stringContaining('has 2 code pair(s), need 3+'),
      );
    });

    it('has no word budget', () => {
      const body = planted(
        PATTERN,
        'Idea.',
        `Idea. ${Array.from({ length: 3000 }, () => 'word').join(' ')}`,
      );
      expect(fileProblems(FILE, withFrontmatter('pattern', body))).toEqual([]);
    });
  });

  // Five-minute criterion 7.
  it.each(['3', 'two', '1', '02'])(
    'fails template: %s, naming the file and the value (five-minute criterion 7)',
    (value) => {
      const file = '/src/dsa/entries/demo.md';
      const raw = `---\ntitle: Demo\nkind: pattern\ntemplate: ${value}\n---\n\n${PATTERN}`;
      const problems = fileProblems(file, raw);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.some((p) => p.includes(file) && p.includes(value))).toBe(true);
    },
  );
});

describe('the template-2 structure check itself (five-minute criteria 9 and 10)', () => {
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

  const DATA_STRUCTURE_2 = [
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

  const PATTERN_2 = [
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

  it('passes the good fixtures', () => {
    expect(structureProblems('data-structure', DATA_STRUCTURE_2, 2)).toEqual([]);
    expect(structureProblems('pattern', PATTERN_2, 2)).toEqual([]);
    expect(structureProblems('algorithm', PATTERN_2, 2)).toEqual([]);
  });

  it('passes them through a file with template: 2', () => {
    const file = '/src/dsa/entries/demo.md';
    for (const [kind, body] of [
      ['data-structure', DATA_STRUCTURE_2],
      ['pattern', PATTERN_2],
      ['algorithm', PATTERN_2],
    ]) {
      const raw = `---\ntitle: Demo\nkind: ${kind}\ntemplate: 2\n---\n\n${body}`;
      expect(fileProblems(file, raw), kind).toEqual([]);
    }
  });

  it('checks a file with template: 2 against template 2, not the old template', () => {
    const file = '/src/dsa/entries/demo.md';
    const old = `---\nkind: data-structure\n---\n\n${DATA_STRUCTURE_2}`;
    expect(fileProblems(file, old)).not.toEqual([]);
    expect(
      fileProblems(
        file,
        `---\nkind: data-structure\ntemplate: 2\n---\n\n${DATA_STRUCTURE_2}`,
      ),
    ).toEqual([]);
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
      structureProblems('data-structure', planted(DATA_STRUCTURE_2, from, to), 2),
    ).toContainEqual(expect.stringContaining(problem));
  });

  it.each(['pattern', 'algorithm'])(
    '%s: fails with only one walkthrough pair',
    (kind) => {
      expect(
        structureProblems(kind, planted(PATTERN_2, `${pair(2)}\n\nWhy two.`, ''), 2),
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
    expect(structureProblems('pattern', planted(PATTERN_2, from, to), 2)).toContainEqual(
      expect.stringContaining(problem),
    );
  });

  it.each([
    ['data-structure', 'A thing.'],
    ['pattern', 'Idea.'],
    ['algorithm', 'Idea.'],
  ])(
    '%s: passes at exactly 1,150 words and fails at 1,151, naming the count (criterion 10)',
    (kind, anchor) => {
      const base = kind === 'data-structure' ? DATA_STRUCTURE_2 : PATTERN_2;
      expect(structureProblems(kind, withWords(base, anchor, 1150), 2)).toEqual([]);
      const problems = structureProblems(kind, withWords(base, anchor, 1151), 2);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('1151');
    },
  );
});
