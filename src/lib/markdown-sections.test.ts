import { describe, expect, it } from 'vitest';
import type { RootContent } from 'mdast';
import { markdownParser, sectionNodes, textOf } from './markdown.mjs';

// docs/specs/content-dedupe.md, design item 3 and criterion 3: one `textOf`
// and one "blocks under `## X`" walk, exported from markdown.mjs for
// dsaPrerequisites, code-regions.mjs and the structure tests.

const parse = (markdown: string) => markdownParser().parse(markdown);

/** Each node's type and text, so a failure shows what was picked. */
function shapes(nodes: RootContent[]): string[] {
  return nodes.map((node) => `${node.type}: ${textOf(node)}`);
}

describe('textOf (content-dedupe criterion 3)', () => {
  it('is the text of a text node', () => {
    const [paragraph] = parse('Plain words.').children;
    expect(textOf(paragraph)).toBe('Plain words.');
  });

  it('joins nested inline formatting without adding spaces', () => {
    const [heading] = parse('## Use *a* **hash** `map`').children;
    expect(textOf(heading)).toBe('Use a hash map');
  });

  it('reads a link’s text, not its URL', () => {
    const [paragraph] = parse('See [binary search](/dsa/binary-search).').children;
    expect(textOf(paragraph)).toBe('See binary search.');
  });

  it('reads the value of a code block and of inline code', () => {
    const [code] = parse('```ts\nconst x = 1;\n```').children;
    expect(textOf(code)).toBe('const x = 1;');
    const [paragraph] = parse('Call `load()` once.').children;
    expect(textOf(paragraph)).toBe('Call load() once.');
  });

  it('joins a whole tree’s text', () => {
    expect(textOf(parse('# A\n\nB *c*\n'))).toBe('AB c');
  });

  it('is empty for a node with neither value nor children', () => {
    const [rule] = parse('---').children;
    expect(rule.type).toBe('thematicBreak');
    expect(textOf(rule)).toBe('');
  });
});

describe('sectionNodes (content-dedupe criterion 3)', () => {
  const BODY = [
    'Intro.',
    '',
    '## Prerequisites',
    '',
    'First.',
    '',
    '- a list',
    '',
    '## The idea',
    '',
    'Idea text.',
    '',
    '## Pitfalls',
    '',
    'Last words.',
    '',
  ].join('\n');

  it('returns the top-level nodes under the heading, up to the next ##', () => {
    expect(shapes(sectionNodes(parse(BODY), 'Prerequisites'))).toEqual([
      'paragraph: First.',
      'list: a list',
    ]);
    expect(shapes(sectionNodes(parse(BODY), 'The idea'))).toEqual([
      'paragraph: Idea text.',
    ]);
  });

  it('runs to the end of the file for the last section', () => {
    expect(shapes(sectionNodes(parse(BODY), 'Pitfalls'))).toEqual([
      'paragraph: Last words.',
    ]);
  });

  it('is empty for a heading at the very end of the file', () => {
    expect(sectionNodes(parse('Intro.\n\n## Pitfalls\n'), 'Pitfalls')).toEqual([]);
    expect(sectionNodes(parse('Intro.\n\n## Pitfalls'), 'Pitfalls')).toEqual([]);
  });

  it('is empty when there is no such section', () => {
    expect(sectionNodes(parse(BODY), 'Walkthrough')).toEqual([]);
    expect(sectionNodes(parse(''), 'Walkthrough')).toEqual([]);
  });

  it('keeps a deeper subheading and what follows it inside the section', () => {
    const body =
      '## Idea\n\nOne.\n\n### Detail\n\nTwo.\n\n#### Finer\n\nThree.\n\n## Next\n\nOut.';
    expect(shapes(sectionNodes(parse(body), 'Idea'))).toEqual([
      'paragraph: One.',
      'heading: Detail',
      'paragraph: Two.',
      'heading: Finer',
      'paragraph: Three.',
    ]);
  });

  it('ends the section at a # heading too', () => {
    const body = '## Idea\n\nOne.\n\n# Part two\n\nOut.';
    expect(shapes(sectionNodes(parse(body), 'Idea'))).toEqual(['paragraph: One.']);
  });

  it('matches a ## heading only, by its trimmed text, not a ### or # one', () => {
    expect(sectionNodes(parse('### Idea\n\nNo.'), 'Idea')).toEqual([]);
    expect(sectionNodes(parse('# Idea\n\nNo.'), 'Idea')).toEqual([]);
    expect(shapes(sectionNodes(parse('## *Idea* \n\nYes.'), 'Idea'))).toEqual([
      'paragraph: Yes.',
    ]);
    expect(sectionNodes(parse('## Ideas\n\nNo.'), 'Idea')).toEqual([]);
  });

  it('reads a setext ## heading as the parser does', () => {
    expect(shapes(sectionNodes(parse('Idea\n----\n\nYes.'), 'Idea'))).toEqual([
      'paragraph: Yes.',
    ]);
  });

  it('ignores a "## heading" line inside a code fence', () => {
    const body = '```md\n## Idea\n\nfenced\n```\n\nAfter.';
    expect(sectionNodes(parse(body), 'Idea')).toEqual([]);
  });

  it('returns the tree’s own nodes, in order', () => {
    const tree = parse(BODY);
    const nodes = sectionNodes(tree, 'Prerequisites');
    const start = tree.children.indexOf(nodes[0]);
    expect(start).toBeGreaterThan(0);
    expect(nodes).toEqual(tree.children.slice(start, start + nodes.length));
    nodes.forEach((node, i) => expect(node).toBe(tree.children[start + i]));
  });
});
