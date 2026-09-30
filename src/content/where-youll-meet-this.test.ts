import { beforeAll, describe, expect, it } from 'vitest';
import type { Nodes } from 'mdast';
import { TOPICS, loadAllTopicBodies } from '@/lib/content';
import { markdownParser } from '@/lib/diagram-refs.mjs';

/**
 * Content-structure test for docs/specs/where-youll-meet-this.md: every topic
 * under src/content/systems-and-infrastructure/ ends with a final `##` section
 * named exactly `Where you'll meet this` (straight apostrophe), holding at
 * least MIN_WORDS words.
 */

const SECTION = 'systems-and-infrastructure';
const HEADING = "Where you'll meet this";
const MIN_WORDS = 25;

const parser = markdownParser();

function textOf(node: Nodes): string {
  if ('value' in node && typeof node.value === 'string') return node.value;
  return 'children' in node ? node.children.map(textOf).join('') : '';
}

/**
 * Every level-2 heading in `body` as the site's own markdown parser reads it
 * (ATX or setext, fenced code skipped), in order: its rendered text and the
 * zero-based index of its last source line.
 */
function level2Headings(body: string): { text: string; line: number }[] {
  const headings: { text: string; line: number }[] = [];
  const visit = (node: Nodes) => {
    if (node.type === 'heading' && node.depth === 2) {
      headings.push({ text: textOf(node).trim(), line: node.position!.end.line - 1 });
      return;
    }
    if ('children' in node) node.children.forEach(visit);
  };
  visit(parser.parse(body));
  return headings;
}

/**
 * Word count of everything after `headingLine` to the end of the body.
 * A word is a whitespace-separated token containing at least one letter or
 * digit, so bare markers (`-`, `*`, `>`, `|`, a lone ``` fence) do not count,
 * while list-item text and code-block text do.
 */
function wordsAfter(body: string, headingLine: number): number {
  return body
    .split(/\r?\n/)
    .slice(headingLine + 1)
    .join('\n')
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

const systemsTopics = TOPICS.filter((topic) => topic.section === SECTION);

// Topic bodies load on demand (`section/slug` -> frontmatter-stripped markdown).
let bodies: Map<string, string>;
beforeAll(async () => {
  bodies = await loadAllTopicBodies();
});

function bodyOf(topic: { section: string; slug: string }): string {
  const body = bodies.get(`${topic.section}/${topic.slug}`);
  if (body === undefined)
    throw new Error(`no body loaded for ${topic.section}/${topic.slug}`);
  return body;
}

// ---------------------------------------------------------------------------
// The helpers themselves, against fixture strings.
// ---------------------------------------------------------------------------

describe('wordsAfter (helper)', () => {
  it('counts whitespace-separated words after the heading to the end of the body', () => {
    const body = '## H\n\none two three\nfour five\n';
    expect(wordsAfter(body, 0)).toBe(5);
  });

  it('does not count the heading line itself or text before it', () => {
    const body = 'before before before\n## Heading words here\nafter\n';
    expect(wordsAfter(body, 1)).toBe(1);
  });

  it('counts list-item text but not bare list markers', () => {
    const body = '## H\n\n- alpha beta\n- gamma\n* delta\n1. epsilon\n> zeta\n';
    expect(wordsAfter(body, 0)).toBe(7);
  });

  it('returns 0 when nothing follows the heading', () => {
    expect(wordsAfter('## H\n', 0)).toBe(0);
    expect(wordsAfter('## H', 0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Criterion 5: enumerate from the real content (via TOPICS).
// ---------------------------------------------------------------------------

describe('enumeration of systems-and-infrastructure topics (criterion 5)', () => {
  it('is non-empty', () => {
    expect(systemsTopics.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Criteria 1-3, one test per real topic so a failure names it.
// ---------------------------------------------------------------------------

describe.each(systemsTopics.map((topic) => [topic.slug, topic] as const))(
  'systems topic %s',
  (_slug, topic) => {
    // Bodies are loaded on demand, so they're read from the map `beforeAll`
    // fills rather than off the topic itself.
    const headings = () => {
      const h2s = level2Headings(bodyOf(topic));
      return { h2s, matches: h2s.filter((h) => h.text === HEADING) };
    };

    it(`has exactly one "## ${HEADING}" heading (criterion 1)`, () => {
      const { h2s, matches } = headings();
      expect(
        matches.length,
        `found ${matches.length}; ## headings present: ${JSON.stringify(h2s.map((h) => h.text))}`,
      ).toBe(1);
    });

    it(`has "## ${HEADING}" as its last ## heading (criterion 2)`, () => {
      const { h2s, matches } = headings();
      expect(matches.length, 'no such heading (see criterion 1)').toBeGreaterThan(0);
      expect(h2s[h2s.length - 1].text).toBe(HEADING);
    });

    it(`has at least ${MIN_WORDS} words under "## ${HEADING}" (criterion 3)`, () => {
      const { matches } = headings();
      expect(matches.length, 'no such heading (see criterion 1)').toBeGreaterThan(0);
      const heading = matches[matches.length - 1];
      expect(wordsAfter(bodyOf(topic), heading.line)).toBeGreaterThanOrEqual(MIN_WORDS);
    });
  },
);
