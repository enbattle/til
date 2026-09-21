import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TOPICS } from '@/lib/content';

/**
 * Content-structure test for docs/specs/where-youll-meet-this.md: every topic
 * under src/content/systems-and-infrastructure/ ends with a final `##` section
 * named exactly `Where you'll meet this` (straight apostrophe), holding at
 * least MIN_WORDS words.
 */

const SECTION = 'systems-and-infrastructure';
const HEADING = "Where you'll meet this";
const MIN_WORDS = 25;

const CONTENT_DIR = path.dirname(fileURLToPath(import.meta.url));

interface Heading {
  /** Zero-based index of the heading's line within the body's lines. */
  line: number;
  /** Heading text, trimmed. Compared case-sensitively and character-for-character. */
  text: string;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Returns every level-2 (`##`) ATX heading in `body`, in order, skipping any
 * line inside a fenced code block (``` or ~~~, closed by a fence of the same
 * character at least as long, per CommonMark). `###` and deeper are not level 2.
 * An unclosed fence swallows the rest of the body, as in CommonMark.
 */
function findH2Headings(body: string): Heading[] {
  const lines = body.split(/\r?\n/);
  const headings: Heading[] = [];
  let fence: { char: string; length: number } | null = null;

  lines.forEach((line, index) => {
    if (fence) {
      const close = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
        fence = null;
      }
      return;
    }
    const open = FENCE_OPEN.exec(line);
    if (open) {
      fence = { char: open[1][0], length: open[1].length };
      return;
    }
    // Exactly two hashes, then whitespace: `###` fails because the third `#`
    // is not whitespace. Trailing whitespace on the line is trimmed.
    const heading = /^ {0,3}##[ \t]+(.*?)[ \t]*$/.exec(line);
    if (heading) headings.push({ line: index, text: heading[1] });
  });

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

// ---------------------------------------------------------------------------
// The helpers themselves, against fixture strings.
// ---------------------------------------------------------------------------

describe('findH2Headings (helper)', () => {
  it('finds a level-2 heading and its line index', () => {
    expect(findH2Headings('Intro.\n\n## First\n\nText.\n\n## Second\n')).toEqual([
      { line: 2, text: 'First' },
      { line: 6, text: 'Second' },
    ]);
  });

  it('ignores a heading inside a ``` fenced block but counts ones after it', () => {
    const body = [
      '## Real',
      '',
      '```bash',
      '## not a heading',
      '```',
      '',
      '## After',
    ].join('\n');
    expect(findH2Headings(body).map((h) => h.text)).toEqual(['Real', 'After']);
  });

  it('ignores a heading inside a ~~~ fenced block', () => {
    const body = ['~~~', '## hidden', '~~~', '## shown'].join('\n');
    expect(findH2Headings(body).map((h) => h.text)).toEqual(['shown']);
  });

  it('does not let a ~~~ fence be closed by a ``` line, or vice versa', () => {
    const tildeBody = ['~~~', '```', '## still inside', '~~~', '## out'].join('\n');
    expect(findH2Headings(tildeBody).map((h) => h.text)).toEqual(['out']);
    const tickBody = ['```', '~~~', '## still inside', '```', '## out'].join('\n');
    expect(findH2Headings(tickBody).map((h) => h.text)).toEqual(['out']);
  });

  it('keeps a longer fence open until a fence at least as long closes it', () => {
    const body = ['````md', '```', '## inside', '```', '````', '## out'].join('\n');
    expect(findH2Headings(body).map((h) => h.text)).toEqual(['out']);
  });

  it('treats an unclosed fence as running to the end of the body', () => {
    expect(findH2Headings('## Before\n```\n## Inside\n')).toEqual([
      { line: 0, text: 'Before' },
    ]);
  });

  it('does not treat ### (or deeper) as a ## heading', () => {
    expect(findH2Headings('### Three\n#### Four\n# One\n')).toEqual([]);
    expect(findH2Headings("### Where you'll meet this\n")).toEqual([]);
  });

  it('requires whitespace after the hashes', () => {
    expect(findH2Headings('##NoSpace\n')).toEqual([]);
  });

  it('ignores trailing whitespace on the heading line', () => {
    expect(findH2Headings("## Where you'll meet this   \t\n")).toEqual([
      { line: 0, text: "Where you'll meet this" },
    ]);
  });

  it('handles CRLF line endings', () => {
    expect(findH2Headings('## One\r\n\r\ntext\r\n## Two\r\n').map((h) => h.text)).toEqual(
      ['One', 'Two'],
    );
  });

  it('distinguishes the exact heading text: curly apostrophe and casing do not match', () => {
    const texts = (s: string) => findH2Headings(s).map((h) => h.text);
    expect(texts("## Where you'll meet this")).toContain(HEADING);
    expect(texts('## Where you’ll meet this')).not.toContain(HEADING);
    expect(texts("## where you'll meet this")).not.toContain(HEADING);
    expect(texts("## Where You'll Meet This")).not.toContain(HEADING);
    expect(texts("## Where you'll meet this too")).not.toContain(HEADING);
  });
});

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

  it('covers exactly the topic files on disk under the section folder', () => {
    const onDisk = readdirSync(path.join(CONTENT_DIR, SECTION))
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, ''))
      .sort();
    expect(systemsTopics.map((topic) => topic.slug).sort()).toEqual(onDisk);
  });

  it('includes every TOPICS entry whose section is systems-and-infrastructure', () => {
    const expected = TOPICS.filter((t) => t.section === SECTION).map((t) => t.slug);
    expect(systemsTopics.map((t) => t.slug)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Criterion 4: other sections are not held to the convention.
// ---------------------------------------------------------------------------

describe('scope of the check (criterion 4)', () => {
  it('enumerates only systems-and-infrastructure topics', () => {
    for (const topic of systemsTopics) {
      expect(topic.section).toBe(SECTION);
    }
  });

  it('leaves out every topic from other sections, so they cannot fail this check', () => {
    const others = TOPICS.filter((topic) => topic.section !== SECTION);
    expect(
      others.length,
      'expected at least one topic in another section',
    ).toBeGreaterThan(0);
    const enumerated = new Set(systemsTopics.map((t) => `${t.section}/${t.slug}`));
    for (const topic of others) {
      expect(enumerated.has(`${topic.section}/${topic.slug}`)).toBe(false);
    }
    expect(systemsTopics.length + others.length).toBe(TOPICS.length);
  });
});

// ---------------------------------------------------------------------------
// Criteria 1-3, one test per real topic so a failure names it.
// ---------------------------------------------------------------------------

describe.each(systemsTopics.map((topic) => [topic.slug, topic] as const))(
  'systems topic %s',
  (_slug, topic) => {
    const h2s = findH2Headings(topic.body);
    const matches = h2s.filter((h) => h.text === HEADING);

    it(`has exactly one "## ${HEADING}" heading (criterion 1)`, () => {
      expect(
        matches.length,
        `found ${matches.length}; ## headings present: ${JSON.stringify(h2s.map((h) => h.text))}`,
      ).toBe(1);
    });

    it(`has "## ${HEADING}" as its last ## heading (criterion 2)`, () => {
      expect(matches.length, 'no such heading (see criterion 1)').toBeGreaterThan(0);
      expect(h2s[h2s.length - 1].text).toBe(HEADING);
    });

    it(`has at least ${MIN_WORDS} words under "## ${HEADING}" (criterion 3)`, () => {
      expect(matches.length, 'no such heading (see criterion 1)').toBeGreaterThan(0);
      const heading = matches[matches.length - 1];
      expect(wordsAfter(topic.body, heading.line)).toBeGreaterThanOrEqual(MIN_WORDS);
    });
  },
);
