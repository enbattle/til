// @vitest-environment node
// Tests for the logic of scripts/inbound-links.mjs
// (docs/specs/drift-and-rewrite-guards.md, criterion 6). The tool lists every
// link to a topic, so a rewrite keeps what other pages link in for.
//
// Interface assumed for scripts/inbound-links.mjs:
//
// - It exports a pure function `inboundLinks(topic, bodies, redirects)`:
//   - `topic` is `<section>/<slug>`;
//   - `bodies` is a list of `{ file, text }`, each a whole markdown file
//     (frontmatter included);
//   - `redirects` maps old `<section>/<slug>` paths to current ones, like
//     REDIRECTS in src/content/redirects.ts.
//   It returns, in body order and then document order, one `{ file, line,
//   anchor, sentence }` per inline link whose URL path is `/<section>/<slug>`
//   or an old path `redirects` maps to it (query ignored): `file` as given,
//   `line` the 1-based line of the link in the file, `anchor` the `#fragment`
//   (with its `#`) or null, and `sentence` the sentence holding the link, from
//   the plain text of its enclosing paragraph or list item.
// - Importing the module runs nothing. The CLI is covered in
//   inbound-links.cli.test.mjs.
import { describe, expect, it } from 'vitest';
import { inboundLinks } from './inbound-links.mjs';

const FRONTMATTER = '---\ntitle: A page\nsummary: A page.\ndate: 2026-10-07\n---\n\n';
// Body lines start on line 7, after the frontmatter and a blank line.
const page = (...lines) => `${FRONTMATTER}${lines.join('\n')}\n`;

const TOPIC = 's/caching';
const collapse = (text) => text.replace(/\s+/g, ' ').trim();
const find = (bodies, redirects = {}, topic = TOPIC) =>
  inboundLinks(topic, bodies, redirects);

describe('inboundLinks (criterion 6)', () => {
  it('finds a plain link, with its file, line, no anchor and its sentence', () => {
    const links = find([
      {
        file: 'src/content/s/other.md',
        text: page(
          'The intro comes first.',
          '',
          'Some prose sits here. Reads go through the [cache](/s/caching) before the',
          'database. Then a last sentence follows.',
        ),
      },
    ]);
    expect(links).toHaveLength(1);
    const [link] = links;
    expect(link.file).toBe('src/content/s/other.md');
    expect(link.line).toBe(9);
    expect(link.anchor ?? null).toBeNull();
    const sentence = collapse(link.sentence);
    expect(sentence).toContain('Reads go through the cache before the database.');
    expect(sentence).not.toContain('Some prose sits here');
    expect(sentence).not.toContain('a last sentence');
  });

  it('finds an anchored link and reports its anchor', () => {
    const [link] = find([
      { file: 'a.md', text: page('See [hit rate](/s/caching#x) for the numbers.') },
    ]);
    expect(link.anchor).toBe('#x');
    expect(link.line).toBe(7);
    expect(collapse(link.sentence)).toContain('See hit rate for the numbers.');
  });

  it('finds a link with a query, ignoring the query', () => {
    const links = find([
      {
        file: 'a.md',
        text: page(
          'One [link](/s/caching?ref=1) here.',
          '',
          'Two [more](/s/caching?ref=2#y).',
        ),
      },
    ]);
    expect(links).toHaveLength(2);
    expect(links[0].anchor ?? null).toBeNull();
    expect(links[1].anchor).toBe('#y');
    expect(links[1].line).toBe(9);
  });

  it('finds a link in a list item, taking the sentence from the item', () => {
    const [link] = find([
      {
        file: 'a.md',
        text: page(
          'Intro paragraph.',
          '',
          '- First item, no link.',
          '- A [cache](/s/caching) sits in front.',
        ),
      },
    ]);
    expect(link.line).toBe(10);
    const sentence = collapse(link.sentence);
    expect(sentence).toContain('A cache sits in front.');
    expect(sentence).not.toContain('First item');
    expect(sentence).not.toContain('Intro paragraph');
  });

  it('finds links from a case study and from a DSA entry', () => {
    const links = find([
      {
        file: 'src/system-design/case-studies/feed.md',
        text: page('The feed reads through a [cache](/s/caching).'),
      },
      {
        file: 'src/dsa/entries/lru.md',
        text: page('An LRU list backs a [cache](/s/caching#eviction).'),
      },
    ]);
    expect(links.map((link) => link.file)).toEqual([
      'src/system-design/case-studies/feed.md',
      'src/dsa/entries/lru.md',
    ]);
    expect(links[1].anchor).toBe('#eviction');
  });

  it('finds every link in a body, in document order', () => {
    const links = find([
      {
        file: 'a.md',
        text: page(
          'A [first](/s/caching) one.',
          '',
          '## Later',
          '',
          'A [second](/s/caching#z) one.',
        ),
      },
    ]);
    expect(links.map((link) => link.line)).toEqual([7, 11]);
  });

  it('finds a link to an old path that the redirects map to the topic', () => {
    const links = find(
      [
        {
          file: 'a.md',
          text: page(
            'An [old link](/s/old-cache#y) still counts.',
            '',
            'An [unrelated](/s/gone).',
          ),
        },
      ],
      { 's/old-cache': TOPIC, 's/gone': 's/elsewhere' },
    );
    expect(links).toHaveLength(1);
    expect(links[0].anchor).toBe('#y');
    expect(collapse(links[0].sentence)).toContain('An old link still counts.');
  });

  it('ignores links to other topics and to slugs sharing a prefix', () => {
    const bodies = [
      {
        file: 'a.md',
        text: page(
          'Links to [another](/s/other), [a prefix](/s/cache), [a longer slug](/s/caching-more),',
          '[another section](/t/caching), [a sub-path](/s/caching/x), the',
          '[landing page](/s), [a case study](/system-design/caching) and',
          '[an external site](https://example.com/s/caching).',
          '',
          '```md',
          '[in code](/s/caching)',
          '```',
        ),
      },
    ];
    expect(find(bodies)).toEqual([]);
    // And the other way round: `/s/caching` isn't a link to `s/cache`.
    expect(
      find([{ file: 'b.md', text: page('A [cache](/s/caching).') }], {}, 's/cache'),
    ).toEqual([]);
  });

  // Review decisions, round 1 (finding 2a): the site renders reference-style
  // links, so they count. The line is where the `[text][ref]` usage sits, and
  // the anchor comes from the definition.
  it('finds a full reference-style link, at the line of its use', () => {
    const links = find([
      {
        file: 'a.md',
        text: page(
          'Intro paragraph.',
          '',
          'Reads go through the [cache][c] first.',
          '',
          '[c]: /s/caching#hit',
        ),
      },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].line).toBe(9);
    expect(links[0].anchor).toBe('#hit');
    expect(collapse(links[0].sentence)).toContain('Reads go through the cache first.');
  });

  it('finds a collapsed reference-style link, at the line of its use', () => {
    const links = find([
      {
        file: 'a.md',
        text: page('See [caching][] for more.', '', '[caching]: /s/caching'),
      },
    ]);
    expect(links).toHaveLength(1);
    expect(links[0].line).toBe(7);
    expect(links[0].anchor ?? null).toBeNull();
  });

  it('returns nothing when no body links to the topic', () => {
    expect(find([{ file: 'a.md', text: page('No links at all.') }])).toEqual([]);
    expect(find([])).toEqual([]);
  });
});
