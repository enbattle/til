import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/lib/frontmatter';

/**
 * Content-structure test for docs/specs/system-design-case-studies.md
 * (criterion 12): every case study's `##` headings are exactly the template,
 * in order, with at least two `Deep dive: <topic>` sections, and the
 * `High-level architecture` section holds at least one `/diagrams/` image.
 */

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const CASES = Object.entries(RAW).map(([filePath, raw]) => ({
  slug: filePath.replace(/^.*\/([^/]+)\.md$/, '$1'),
  body: parseFrontmatter(raw).content,
}));

const BEFORE_DEEP_DIVES = [
  'Requirements',
  'Back-of-the-envelope estimates',
  'Data model',
  'API design',
  'High-level architecture',
];
const AFTER_DEEP_DIVES = ['Failure modes and bottlenecks', 'Trade-offs'];
const DEEP_DIVE = /^Deep dive: \S.*$/;
const DIAGRAM_IMAGE = /!\[[^\]]+\]\(\s*\/diagrams\/[^)\s]+\.svg(?:\s+"[^"]*")?\s*\)/;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** Every level-2 ATX heading in `body`, in order, with the lines of the section
 * under it (up to the next `##`), skipping fenced code. */
function sections(body: string): { heading: string; content: string }[] {
  const result: { heading: string; lines: string[] }[] = [];
  let fence: { char: string; length: number } | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = FENCE_OPEN.exec(line);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) {
        fence = null;
      }
      result.at(-1)?.lines.push(line);
      continue;
    }
    if (marker) {
      fence = { char: marker[1][0], length: marker[1].length };
      result.at(-1)?.lines.push(line);
      continue;
    }
    const heading = /^ {0,3}##[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (heading) {
      result.push({ heading: heading[1].trim(), lines: [] });
    } else {
      result.at(-1)?.lines.push(line);
    }
  }
  return result.map(({ heading, lines }) => ({ heading, content: lines.join('\n') }));
}

describe('case-study structure (criterion 12)', () => {
  it('has at least one case study to check', () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it.each(CASES.map((c) => [c.slug, c.body] as const))(
    '%s has the template ## headings in order, with at least two deep dives',
    (_slug, body) => {
      const headings = sections(body).map((s) => s.heading);
      const head = headings.slice(0, BEFORE_DEEP_DIVES.length);
      const tail = headings.slice(-AFTER_DEEP_DIVES.length);
      const middle = headings.slice(
        BEFORE_DEEP_DIVES.length,
        headings.length - AFTER_DEEP_DIVES.length,
      );
      expect(head).toEqual(BEFORE_DEEP_DIVES);
      expect(tail).toEqual(AFTER_DEEP_DIVES);
      expect(middle.length).toBeGreaterThanOrEqual(2);
      for (const heading of middle) expect(heading).toMatch(DEEP_DIVE);
      expect(headings.length).toBe(
        BEFORE_DEEP_DIVES.length + middle.length + AFTER_DEEP_DIVES.length,
      );
    },
  );

  it.each(CASES.map((c) => [c.slug, c.body] as const))(
    '%s has a /diagrams/ image inside High-level architecture',
    (_slug, body) => {
      const architecture = sections(body).find(
        (s) => s.heading === 'High-level architecture',
      );
      expect(architecture).toBeDefined();
      expect(architecture!.content).toMatch(DIAGRAM_IMAGE);
    },
  );
});

describe('the structure check itself', () => {
  const GOOD = [
    'Intro paragraph.',
    '## Requirements',
    '## Back-of-the-envelope estimates',
    '## Data model',
    '## API design',
    '## High-level architecture',
    '![The architecture](/diagrams/demo/architecture.svg)',
    '## Deep dive: short codes',
    '```md',
    '## Not a heading, inside a fence',
    '```',
    '## Deep dive: the read path',
    '## Failure modes and bottlenecks',
    '## Trade-offs',
  ].join('\n\n');

  it('reads headings outside fences and the architecture section’s content', () => {
    const found = sections(GOOD);
    expect(found.map((s) => s.heading)).toEqual([
      ...BEFORE_DEEP_DIVES,
      'Deep dive: short codes',
      'Deep dive: the read path',
      ...AFTER_DEEP_DIVES,
    ]);
    expect(found.find((s) => s.heading === 'High-level architecture')!.content).toMatch(
      DIAGRAM_IMAGE,
    );
    expect(found.find((s) => s.heading === 'Data model')!.content).not.toMatch(
      DIAGRAM_IMAGE,
    );
  });
});
