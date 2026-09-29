import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { parseFrontmatter } from '@/lib/frontmatter';
import remarkRehype from 'remark-rehype';
import { h2Headings, rehypeHeadingIds } from '@/lib/headings';
import { markdownParser } from '@/lib/diagram-refs.mjs';

/**
 * Content-structure test for docs/specs/system-design-case-studies.md
 * (criterion 12): every case study's `##` headings are exactly the template,
 * in order, with at least two `Deep dive: <topic>` sections, and the
 * `High-level architecture` section holds at least one `/diagrams/` image.
 *
 * Extended for docs/specs/case-study-at-a-glance.md (criteria 1-4): the first
 * `##` is `At a glance`, which holds the four bold lead-ins in order, with an
 * in-page link in every list item under `Key decisions` and under
 * `Likely follow-ups` (every list up to the next lead-in, including one inside
 * a blockquote, with each nested item counted on its own: the spec's Design
 * section, each decision and each follow-up links), and ends with a standalone
 * paragraph linking to `#high-level-architecture`; and every in-page link in
 * the body (any link that renders with `href="#id"`: inline, `<#id>` or
 * reference-style) names an id the rendered page keeps (the renderer's own
 * `rehypeHeadingIds` pass, which `h2Headings` also runs, plus remark-rehype's
 * footnote ids, less the ids `MarkdownRenderer`'s overrides drop). Links are
 * read from the renderer's parsed markdown tree, not by regex.
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
const DIAGRAM_IMAGE = /!\[[^\]]+\]\(\s*\/diagrams\/[^)\s]+\.svg(?:\s+"[^"]*")?\s*\)/;
const LEAD_INS = ['Requirements', 'Key numbers', 'Key decisions', 'Likely follow-ups'];
const ARCHITECTURE_ID = 'high-level-architecture';

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

/** Where the `##` headings break the template; [] when they match it. */
function templateProblems(body: string): string[] {
  const headings = sections(body).map((s) => s.heading);
  const problems: string[] = [];
  const head = headings.slice(0, BEFORE_DEEP_DIVES.length);
  const tail = headings.slice(-AFTER_DEEP_DIVES.length);
  const middle = headings.slice(
    BEFORE_DEEP_DIVES.length,
    Math.max(BEFORE_DEEP_DIVES.length, headings.length - AFTER_DEEP_DIVES.length),
  );
  if (headings[0] !== AT_A_GLANCE) {
    problems.push(`first ## is ${JSON.stringify(headings[0])}, not "${AT_A_GLANCE}"`);
  }
  if (JSON.stringify(head) !== JSON.stringify(BEFORE_DEEP_DIVES)) {
    problems.push(`opening headings are ${JSON.stringify(head)}`);
  }
  if (JSON.stringify(tail) !== JSON.stringify(AFTER_DEEP_DIVES)) {
    problems.push(`closing headings are ${JSON.stringify(tail)}`);
  }
  if (middle.length < 2) problems.push(`${middle.length} deep dive(s), need 2+`);
  for (const heading of middle) {
    if (!DEEP_DIVE.test(heading)) problems.push(`not a deep dive: ${heading}`);
  }
  if (
    headings.length !==
    BEFORE_DEEP_DIVES.length + middle.length + AFTER_DEEP_DIVES.length
  ) {
    problems.push(`${headings.length} headings in all`);
  }
  return problems;
}

/** The parts of an mdast (markdown syntax tree) node the checks below read. */
interface MdNode {
  type: string;
  depth?: number;
  value?: string;
  url?: string;
  identifier?: string;
  children?: MdNode[];
}

/** The parts of a hast (HTML syntax tree) node the id check reads. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/** `body` parsed with the renderer's own markdown stack (remark-parse +
 * remark-gfm, the `markdownParser` that `h2Headings` builds on), so a link is
 * a link here exactly when it renders as one: inline, angle-bracket or
 * reference-style, and never inside code. */
function mdTree(body: string): MdNode {
  return markdownParser().parse(body) as unknown as MdNode;
}

function mdText(node: MdNode): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value ?? '';
  return (node.children ?? []).map(mdText).join('');
}

/** The `href` every `link` and `linkReference` under `node` renders with, in
 * order, resolving references through `definitions` (first definition of an
 * identifier wins, as in the renderer). */
function linkHrefs(node: MdNode, definitions: Map<string, string>): string[] {
  if (node.type === 'link') return [node.url ?? ''];
  if (node.type === 'linkReference') {
    const url = definitions.get(node.identifier ?? '');
    return url === undefined ? [] : [url];
  }
  return (node.children ?? []).flatMap((child) => linkHrefs(child, definitions));
}

function linkDefinitions(tree: MdNode): Map<string, string> {
  const definitions = new Map<string, string>();
  const visit = (node: MdNode) => {
    if (node.type === 'definition' && !definitions.has(node.identifier ?? '')) {
      definitions.set(node.identifier ?? '', node.url ?? '');
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return definitions;
}

/** The id of every in-page link (one that renders with `href="#id"`) under
 * `node`, in order. */
function inPageLinks(node: MdNode, definitions: Map<string, string>): string[] {
  return linkHrefs(node, definitions)
    .filter((href) => href.startsWith('#'))
    .map((href) => href.slice(1));
}

/** The top-level nodes of the `At a glance` section (up to the next `##`, or
 * the end), with the body's link definitions; `null` when there's no
 * `At a glance` `##`. */
function glanceContent(
  body: string,
): { content: MdNode[]; definitions: Map<string, string> } | null {
  const tree = mdTree(body);
  const top = tree.children ?? [];
  const isH2 = (n: MdNode) => n.type === 'heading' && n.depth === 2;
  const start = top.findIndex((n) => isH2(n) && mdText(n).trim() === AT_A_GLANCE);
  if (start < 0) return null;
  const end = top.findIndex((n, i) => i > start && isH2(n));
  return {
    content: top.slice(start + 1, end < 0 ? undefined : end),
    definitions: linkDefinitions(tree),
  };
}

/** The LEAD_INS label `node` opens with, when it's a paragraph that starts
 * with a bold `Label.`; otherwise `undefined`. */
function leadInLabel(node: MdNode): string | undefined {
  const first = node.type === 'paragraph' ? node.children?.[0] : undefined;
  if (first?.type !== 'strong') return undefined;
  const text = mdText(first).trim();
  const label = text.replace(/\.$/, '');
  return text.endsWith('.') && LEAD_INS.includes(label) ? label : undefined;
}

/** The `At a glance` section's lead-ins, in the order found, each with the
 * in-page links of every list item in the blocks between it and the next
 * lead-in (or the section's end): one array per item, numbered in document
 * order across those blocks (none when no list follows). Every list in those
 * blocks counts, wherever it sits: a top-level list, a second list under the
 * same label (the bullet marker changed mid-list, which starts a new list, or a
 * short paragraph split the list), and a list inside another block, such as a
 * blockquote (`> - item`), at any depth. Only list items count, so neither a
 * paragraph between the lists nor the closing paragraph can stand in for an
 * item's link, and each item counts on its own (see `listItemLinks`). `null`
 * when there's no `At a glance` `##`. */
function glanceLeadIns(body: string): { label: string; itemLinks: string[][] }[] | null {
  const glance = glanceContent(body);
  if (!glance) return null;
  const parts: { label: string; itemLinks: string[][] }[] = [];
  for (const node of glance.content) {
    const label = leadInLabel(node);
    if (label) {
      parts.push({ label, itemLinks: [] });
    } else {
      const lists = outermostLists(node);
      parts
        .at(-1)
        ?.itemLinks.push(
          ...lists.flatMap((list) => listItemLinks(list, glance.definitions)),
        );
    }
  }
  return parts;
}

/** The lists at or under `node` that no other list holds: `node` itself when
 * it's a list, otherwise the outermost lists among its descendants (inside a
 * blockquote, say), in document order. A list inside one of those is left to
 * `listItemLinks`, so no item is counted twice. */
function outermostLists(node: MdNode): MdNode[] {
  if (node.type === 'list') return [node];
  return (node.children ?? []).flatMap(outermostLists);
}

/** The in-page links under `node` that sit outside every list under it. */
function linksOutsideLists(node: MdNode, definitions: Map<string, string>): string[] {
  if (node.type === 'list') return [];
  if (node.type === 'link' || node.type === 'linkReference') {
    return inPageLinks(node, definitions);
  }
  return (node.children ?? []).flatMap((child) => linksOutsideLists(child, definitions));
}

/** The in-page links of each item of `list`, one array per item, depth-first:
 * a nested item (in a list indented under the item, or in a list inside a
 * block the item holds, such as a blockquote) is an item of its own, and its
 * links don't count for the item it's nested in, so an unlinked bullet
 * indented under a linked one (or a linked bullet under an unlinked one) can't
 * borrow a link. */
function listItemLinks(list: MdNode, definitions: Map<string, string>): string[][] {
  return (list.children ?? []).flatMap((item) => {
    const children = item.children ?? [];
    return [
      children.flatMap((child) => linksOutsideLists(child, definitions)),
      ...children
        .flatMap(outermostLists)
        .flatMap((sub) => listItemLinks(sub, definitions)),
    ];
  });
}

/** The in-page links of the `At a glance` section's closing sentence: its last
 * block, when that's a standalone paragraph (not a lead-in, not inside a
 * list). `null` when the section ends any other way, including a closing
 * sentence folded into the last follow-up (a lazy continuation, when no blank
 * line comes before it), or when there's no `At a glance` `##`. A link
 * reference definition (`[x]: #id`) renders nothing, so one after the closing
 * paragraph doesn't count as the section's last block. */
function glanceClosingLinks(body: string): string[] | null {
  const glance = glanceContent(body);
  const last = glance?.content.filter((n) => n.type !== 'definition').at(-1);
  if (!glance || !last || last.type !== 'paragraph' || leadInLabel(last)) return null;
  return inPageLinks(last, glance.definitions);
}

/** Where the `At a glance` section breaks its shape; [] when it's right. */
function atAGlanceProblems(body: string): string[] {
  const parts = glanceLeadIns(body);
  if (!parts) return [`no "${AT_A_GLANCE}" section`];
  const problems: string[] = [];
  const labels = parts.map((p) => p.label);
  if (JSON.stringify(labels) !== JSON.stringify(LEAD_INS)) {
    problems.push(
      `lead-ins are ${JSON.stringify(labels)}, need ${JSON.stringify(LEAD_INS)}`,
    );
  }
  for (const label of ['Key decisions', 'Likely follow-ups']) {
    const part = parts.find((p) => p.label === label);
    if (!part) continue;
    if (part.itemLinks.every((links) => links.length < 1)) {
      problems.push(`"${label}" has no in-page link`);
      continue;
    }
    part.itemLinks.forEach((links, i) => {
      if (links.length < 1) problems.push(`"${label}" item ${i + 1} has no in-page link`);
    });
  }
  if (!glanceClosingLinks(body)?.includes(ARCHITECTURE_ID)) {
    problems.push(`does not end with a paragraph linking to #${ARCHITECTURE_ID}`);
  }
  return problems;
}

/** The renderer's markdown -> HTML-tree pipeline with its heading-id pass, as
 * `h2Headings` runs it: react-markdown is remark-parse + remark-gfm +
 * remark-rehype (with `allowDangerousHtml`, as react-markdown sets it), and
 * `MarkdownRenderer` adds `rehypeHeadingIds`. The ids come from that plugin,
 * not a re-implementation of its slugging. */
const renderPipeline = markdownParser()
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeHeadingIds);

/** The elements whose `MarkdownRenderer` override renders them without the id
 * the HTML tree gives them: the `a`, `p`, `img`, `table`, `pre` and `code`
 * overrides pass on no `id`. The `h1` and `h2` overrides do pass it on, and an
 * element with no override (a footnote's `li`, say) keeps its id. So the
 * footnote reference remark-rehype writes, `<a id="user-content-fnref-1">`,
 * reaches the page with no id, while the footnote itself,
 * `<li id="user-content-fn-1">`, keeps it. */
const RENDERS_WITHOUT_ID = new Set(['a', 'p', 'img', 'table', 'pre', 'code']);

/** Every id the rendered page carries, as the renderer assigns and keeps them:
 * `rehypeHeadingIds` numbers h1s and h2s together (an h1 renders as an h2 with
 * its id) and gives h3 and below no id; remark-rehype adds footnote ids; and an
 * id on an element in `RENDERS_WITHOUT_ID` is dropped. A link to any other id
 * goes nowhere. Raw HTML is not an element here (react-markdown doesn't render
 * it as HTML), so an id written in raw HTML doesn't count. The last test below
 * checks this set against the ids the real `MarkdownRenderer` puts in the DOM. */
function renderedIds(body: string): Set<string> {
  const tree = renderPipeline.runSync(renderPipeline.parse(body)) as unknown as HastNode;
  const ids = new Set<string>();
  const visit = (node: HastNode) => {
    const id = node.properties?.id;
    if (
      node.type === 'element' &&
      id !== undefined &&
      !RENDERS_WITHOUT_ID.has(node.tagName ?? '')
    ) {
      ids.add(String(id));
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return ids;
}

/** Every in-page link in `body` whose id nothing on the rendered page has. */
function brokenInPageLinks(body: string): string[] {
  const ids = renderedIds(body);
  const tree = mdTree(body);
  return inPageLinks(tree, linkDefinitions(tree)).filter((id) => !ids.has(id));
}

describe('case-study structure (criterion 12; at-a-glance criteria 1-4)', () => {
  it('has at least one case study to check', () => {
    expect(CASES.length).toBeGreaterThan(0);
  });

  it.each(CASES.map((c) => [c.slug, c.body] as const))(
    '%s has the template ## headings in order, At a glance first, with at least two deep dives',
    (_slug, body) => {
      expect(templateProblems(body)).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.slug, c.body] as const))(
    '%s has an At a glance section with the four lead-ins in order, linking into the body',
    (_slug, body) => {
      expect(atAGlanceProblems(body)).toEqual([]);
    },
  );

  it.each(CASES.map((c) => [c.slug, c.body] as const))(
    '%s has no in-page link to an id its headings do not render with',
    (_slug, body) => {
      expect(brokenInPageLinks(body)).toEqual([]);
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
  const GLANCE = [
    '**Requirements.** What it must do:',
    '- Shorten a URL; 100 million new links a day.',
    '**Key numbers.** From the estimates:',
    '- ≈ 115,000 redirects/s at peak (10× average).',
    '**Key decisions.** The three that shape it:',
    '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
    '**Likely follow-ups.** What comes next:',
    '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
    'The full picture is in [the architecture](#high-level-architecture).',
  ];
  const GOOD = [
    'Intro paragraph.',
    '## At a glance',
    ...GLANCE,
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

  /** GOOD with `from` (which must occur in it exactly once) replaced by `to`. */
  function planted(from: string, to: string): string {
    expect(GOOD.split(from)).toHaveLength(2);
    return GOOD.replace(from, to);
  }

  it('reads headings outside fences and the architecture section’s content', () => {
    const found = sections(GOOD);
    expect(found.map((s) => s.heading)).toEqual([
      ...BEFORE_DEEP_DIVES,
      'Deep dive: short codes',
      'Deep dive: the read path',
      ...AFTER_DEEP_DIVES,
    ]);
    expect(found[0].heading).toBe(AT_A_GLANCE);
    expect(found.find((s) => s.heading === 'High-level architecture')!.content).toMatch(
      DIAGRAM_IMAGE,
    );
    expect(found.find((s) => s.heading === 'Data model')!.content).not.toMatch(
      DIAGRAM_IMAGE,
    );
  });

  it('passes the GOOD fixture on every rule', () => {
    expect(templateProblems(GOOD)).toEqual([]);
    expect(atAGlanceProblems(GOOD)).toEqual([]);
    expect(brokenInPageLinks(GOOD)).toEqual([]);
  });

  // At-a-glance criterion 1.
  it('fails a case study with no At a glance heading', () => {
    const bad = planted('## At a glance', 'Summary:');
    expect(templateProblems(bad)).not.toEqual([]);
    expect(atAGlanceProblems(bad)).not.toEqual([]);
  });

  it('fails a case study whose At a glance is not the first ## heading', () => {
    const bad = GOOD.replace('## At a glance\n\n', '').replace(
      '## Back-of-the-envelope estimates',
      '## At a glance\n\n## Back-of-the-envelope estimates',
    );
    expect(sections(bad)[0].heading).toBe('Requirements');
    expect(templateProblems(bad)).not.toEqual([]);
  });

  it('still fails a renamed heading elsewhere in the template', () => {
    expect(templateProblems(planted('## Data model', '## Data'))).not.toEqual([]);
  });

  // At-a-glance criterion 2.
  it.each(LEAD_INS)(
    'fails an At a glance section missing the **%s.** lead-in',
    (label) => {
      const line = GLANCE.find((l) => l.startsWith(`**${label}.**`))!;
      expect(atAGlanceProblems(planted(line, `${label}: see below.`))).not.toEqual([]);
    },
  );

  it('fails an At a glance section with its lead-ins out of order', () => {
    const [req, reqList, nums, numsList, ...rest] = GLANCE;
    const swapped = [nums, numsList, req, reqList, ...rest].join('\n\n');
    expect(atAGlanceProblems(planted(GLANCE.join('\n\n'), swapped))).not.toEqual([]);
  });

  it('does not count a lead-in that only appears inside a code span', () => {
    const bad = planted(
      '**Key numbers.** From the estimates:',
      'Key numbers, `**Key numbers.**`:',
    );
    expect(atAGlanceProblems(bad)).not.toEqual([]);
  });

  // At-a-glance criterion 3.
  it('fails an in-page link to an id no heading renders with', () => {
    const bad = planted('(#deep-dive-the-read-path)', '(#deep-dive-read-path)');
    expect(brokenInPageLinks(bad)).toEqual(['deep-dive-read-path']);
  });

  it('fails a broken in-page link anywhere in the body, not only in At a glance', () => {
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [the failures](#failure-modes).',
    );
    expect(brokenInPageLinks(bad)).toEqual(['failure-modes']);
  });

  it('takes ids from h2Headings, so a repeated heading is linked as -1', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\n## Trade-offs\n\nSee [the second](#trade-offs-1).',
    );
    expect(h2Headings(ok).map((h) => h.id)).toContain('trade-offs-1');
    expect(brokenInPageLinks(ok)).toEqual([]);
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [a second](#trade-offs-1).',
    );
    expect(brokenInPageLinks(bad)).toEqual(['trade-offs-1']);
  });

  it('ignores an in-page link shown inside a code fence', () => {
    const ok = planted('## Not a heading, inside a fence', '[x](#nowhere)');
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('ignores an in-page link shown inside an inline code span', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\nWrite `[x](#nowhere)` to link.',
    );
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('fails a reference-style in-page link to a missing id', () => {
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [the failures][f].\n\n[f]: #failure-modes',
    );
    expect(brokenInPageLinks(bad)).toEqual(['failure-modes']);
  });

  it('passes a reference-style in-page link to an existing id', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [the failures][f] and [Data model][].\n\n[f]: #failure-modes-and-bottlenecks\n[data model]: #data-model',
    );
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('fails an angle-bracket in-page link to a missing id', () => {
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [the failures](<#failure-modes>).',
    );
    expect(brokenInPageLinks(bad)).toEqual(['failure-modes']);
  });

  it('passes an angle-bracket in-page link to an existing id', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [the failures](<#failure-modes-and-bottlenecks> "title").',
    );
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  // At-a-glance criterion 4.
  it('fails an At a glance section with no in-page link under Key decisions', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination.',
    );
    expect(atAGlanceProblems(bad)).toEqual(['"Key decisions" has no in-page link']);
  });

  it('fails an At a glance section with no in-page link under Likely follow-ups', () => {
    // The closing architecture sentence (with its link) stays in place: only
    // the follow-ups' own list counts, so it can't stand in for their link.
    const bad = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache.',
    );
    expect(bad).toContain('[the architecture](#high-level-architecture)');
    expect(atAGlanceProblems(bad)).toEqual(['"Likely follow-ups" has no in-page link']);
  });

  it('does not count a link in the Key decisions lead-in line, only in its list', () => {
    const bad = planted(
      '**Key decisions.** The three that shape it:\n\n- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '**Key decisions.** The three that [shape it](#deep-dive-short-codes):\n\n- Random codes: no coordination.',
    );
    expect(atAGlanceProblems(bad)).toEqual(['"Key decisions" has no in-page link']);
  });

  it('counts a reference-style in-page link in the follow-ups list', () => {
    const ok = planted('([more](#deep-dive-the-read-path))', '([more][read])').replace(
      '## Trade-offs',
      '## Trade-offs\n\n[read]: #deep-dive-the-read-path',
    );
    expect(atAGlanceProblems(ok)).toEqual([]);
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  // Fixture (1): the closing sentence written with no blank line before it is a
  // lazy continuation of the last follow-up, so its link lands inside that
  // item. The earlier check (one in-page link anywhere in the list) passed this
  // with every real follow-up link gone.
  it('fails unlinked follow-ups whose last item absorbs the closing sentence', () => {
    const bad = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n\nThe full picture',
      '- How are reads kept fast? A cache.\n- What if the store is down? Serve stale entries.\nThe full picture',
    );
    const followUps = glanceLeadIns(bad)!.find((p) => p.label === 'Likely follow-ups')!;
    // The only link in the list is the absorbed architecture link.
    expect(followUps.itemLinks).toEqual([[], ['high-level-architecture']]);
    expect(atAGlanceProblems(bad)).toEqual([
      '"Likely follow-ups" item 1 has no in-page link',
      'does not end with a paragraph linking to #high-level-architecture',
    ]);
  });

  // Fixture (2): the earlier check passed a decisions list where only some
  // items link, since one link anywhere in the list was enough.
  it('fails a Key decisions list where one item has no in-page link', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n- A cache in front of the store: fast reads.\n- Clicks on a queue: redirects never wait ([data](#data-model)).',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 2 has no in-page link',
    ]);
  });

  // Fixture (3): multi-item lists pass when every item of both links.
  it('passes Key decisions and Likely follow-ups lists where every item links', () => {
    const ok = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n- A cache in front of the store: fast reads ([read path](#deep-dive-the-read-path)).\n- Clicks on a queue: redirects never wait ([data](#data-model)).',
    ).replace(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n- Why a 302? Counts and expiry keep working ([API design](#api-design)).',
    );
    const parts = glanceLeadIns(ok)!;
    expect(parts.find((p) => p.label === 'Key decisions')!.itemLinks).toHaveLength(3);
    expect(parts.find((p) => p.label === 'Likely follow-ups')!.itemLinks).toHaveLength(2);
    expect(atAGlanceProblems(ok)).toEqual([]);
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('does not count an external link as an in-page link', () => {
    const bad = planted(
      '(#deep-dive-short-codes)',
      '(https://example.com/#deep-dive-short-codes)',
    );
    expect(atAGlanceProblems(bad)).toEqual(['"Key decisions" has no in-page link']);
  });

  // Fixture (4): switching the bullet marker mid-list (`-` to `*`) starts a
  // second list in CommonMark. The earlier check read only the list directly
  // after the lead-in (`content[i + 1]`), so it passed this with item 2's link
  // gone.
  it('fails a second Key decisions list (bullet marker changed) whose item has no link', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n* A cache in front of the store: fast reads.',
    );
    const lists = mdTree(bad).children!.filter((n) => n.type === 'list');
    expect(lists).toHaveLength(5); // Key decisions is now two lists.
    expect(
      glanceLeadIns(bad)!.find((p) => p.label === 'Key decisions')!.itemLinks,
    ).toEqual([['deep-dive-short-codes'], []]);
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 2 has no in-page link',
    ]);
  });

  // Fixture (5): a short paragraph between two follow-ups splits the list.
  // The earlier check read only the first list, so it passed this with
  // follow-up 2's link gone.
  it('fails a follow-up after a paragraph that split the list, when it has no link', () => {
    const bad = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n\nAlso:\n\n- What if the store is down? Serve stale entries.',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Likely follow-ups" item 2 has no in-page link',
    ]);
  });

  it('does not count a link in a paragraph between two lists as a list item’s link', () => {
    const bad = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n\nAlso ([data](#data-model)):\n\n- What if the store is down? Serve stale entries.',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Likely follow-ups" item 2 has no in-page link',
    ]);
  });

  it('passes a follow-ups list split by a paragraph when every item links', () => {
    const ok = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n\nAlso:\n\n- What if the store is down? Serve stale entries ([data](#data-model)).',
    );
    expect(
      glanceLeadIns(ok)!.find((p) => p.label === 'Likely follow-ups')!.itemLinks,
    ).toEqual([['deep-dive-the-read-path'], ['data-model']]);
    expect(atAGlanceProblems(ok)).toEqual([]);
  });

  // Fixture (6): the closing sentence folded (no blank line) into the last
  // follow-up, with every follow-up still linked. The earlier check passed
  // this: the section then ends in the list, with no closing sentence.
  it('fails a closing sentence folded into the last follow-up', () => {
    const bad = planted(
      '(#deep-dive-the-read-path)).\n\nThe full picture',
      '(#deep-dive-the-read-path)).\nThe full picture',
    );
    expect(glanceClosingLinks(bad)).toBeNull();
    expect(atAGlanceProblems(bad)).toEqual([
      'does not end with a paragraph linking to #high-level-architecture',
    ]);
  });

  it('passes a standalone closing paragraph linking to #high-level-architecture', () => {
    expect(glanceClosingLinks(GOOD)).toEqual(['high-level-architecture']);
    const ok = planted(
      'The full picture is in [the architecture](#high-level-architecture).',
      'The full picture is in [the architecture][arch].\n\n[arch]: #high-level-architecture',
    );
    expect(atAGlanceProblems(ok)).toEqual([]);
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('fails an At a glance section with no closing sentence', () => {
    const bad = planted(
      '\n\nThe full picture is in [the architecture](#high-level-architecture).',
      '',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      'does not end with a paragraph linking to #high-level-architecture',
    ]);
  });

  it('fails a closing paragraph that links somewhere other than #high-level-architecture', () => {
    const bad = planted('(#high-level-architecture)', '(#data-model)');
    expect(atAGlanceProblems(bad)).toEqual([
      'does not end with a paragraph linking to #high-level-architecture',
    ]);
  });

  it('fails an architecture link that is not the section’s last block', () => {
    const bad = planted(
      'The full picture is in [the architecture](#high-level-architecture).',
      'The full picture is in [the architecture](#high-level-architecture).\n\n- One more thought ([data](#data-model)).',
    );
    expect(atAGlanceProblems(bad)).toContain(
      'does not end with a paragraph linking to #high-level-architecture',
    );
  });

  // Fixture (7): ids come from the renderer's own pass over every heading
  // level. The earlier check took ids from h2Headings only, which leaves out
  // h1s, so it reported this valid link to an h1 (rendered as an h2 with its
  // id) as broken.
  it('passes an in-page link to a # heading, which renders with an id', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\n# Summary\n\nSee [the summary](#summary).',
    );
    expect(h2Headings(ok).map((h) => h.id)).not.toContain('summary');
    expect(renderedIds(ok)).toContain('summary');
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  it('numbers # and ## headings together, as the renderer does', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\n# Trade-offs\n\nSee [the h1](#trade-offs-1).',
    );
    expect(brokenInPageLinks(ok)).toEqual([]);
    expect(brokenInPageLinks(ok.replace('(#trade-offs-1)', '(#trade-offs-2)'))).toEqual([
      'trade-offs-2',
    ]);
  });

  // The renderer (rehypeHeadingIds; no other id pass) gives ### and below no
  // id, so a link to one goes nowhere: it's reported broken whether or not the
  // heading exists.
  it('fails an in-page link to a ### heading, which renders with no id', () => {
    const withHeading = planted(
      '## Trade-offs',
      '## Trade-offs\n\n### Hot keys\n\nSee [hot keys](#hot-keys).',
    );
    expect(renderedIds(withHeading)).not.toContain('hot-keys');
    expect(brokenInPageLinks(withHeading)).toEqual(['hot-keys']);
    const missing = planted(
      '## Trade-offs',
      '## Trade-offs\n\nSee [hot keys](#hot-keys).',
    );
    expect(brokenInPageLinks(missing)).toEqual(['hot-keys']);
  });

  // Fixture (8), found while probing: an unlinked decision indented under a
  // linked one. Both the earlier check and a flat per-list-item check pass
  // this, because the nested item's text sits inside the linked item.
  it('fails an unlinked bullet nested under a linked Key decisions item', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n  - A cache in front of the store: fast reads.',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 2 has no in-page link',
    ]);
  });

  it('does not let an unlinked item borrow the link of a bullet nested under it', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Two choices:\n  - Random codes: no coordination ([why](#deep-dive-short-codes)).',
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 1 has no in-page link',
    ]);
  });

  // Fixture (9): a bulleted list inside a blockquote renders as a bullet under
  // Key decisions. The earlier check collected only top-level lists, so it
  // passed this with the quoted decision unlinked.
  it('fails an unlinked Key decisions bullet inside a blockquote', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n> - A fourth decision with no link.\n',
    );
    expect(mdTree(bad).children!.some((n) => n.type === 'blockquote')).toBe(true);
    expect(
      glanceLeadIns(bad)!.find((p) => p.label === 'Key decisions')!.itemLinks,
    ).toEqual([['deep-dive-short-codes'], []]);
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 2 has no in-page link',
    ]);
  });

  it('passes a Key decisions bullet inside a blockquote when it links', () => {
    const ok = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n> - A fourth decision ([data](#data-model)).\n',
    );
    expect(
      glanceLeadIns(ok)!.find((p) => p.label === 'Key decisions')!.itemLinks,
    ).toEqual([['deep-dive-short-codes'], ['data-model']]);
    expect(atAGlanceProblems(ok)).toEqual([]);
  });

  // Fixture (10), probing the same rule: a list two blockquotes deep, with a
  // nested bullet under it. The earlier check passed this.
  it('fails unlinked bullets in a nested blockquote, counting each item once', () => {
    const bad = planted(
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).',
      '- How are reads kept fast? A cache ([more](#deep-dive-the-read-path)).\n\n> > - What if the store is down? ([data](#data-model))\n> >   - And if the cache is down too?',
    );
    expect(
      glanceLeadIns(bad)!.find((p) => p.label === 'Likely follow-ups')!.itemLinks,
    ).toEqual([['deep-dive-the-read-path'], ['data-model'], []]);
    expect(atAGlanceProblems(bad)).toEqual([
      '"Likely follow-ups" item 3 has no in-page link',
    ]);
  });

  // Fixture (11), probing the same rule: a blockquoted list inside a linked
  // list item. The earlier check read the blockquote as part of that item, so
  // its unlinked bullet borrowed the item's link and passed.
  it('fails an unlinked bullet in a blockquote inside a linked Key decisions item', () => {
    const bad = planted(
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).',
      '- Random codes: no coordination ([why](#deep-dive-short-codes)).\n\n  > - A quoted decision with no link.',
    );
    const decisions = mdTree(bad).children!.filter((n) => n.type === 'list')[2];
    expect(decisions.children![0].children!.some((n) => n.type === 'blockquote')).toBe(
      true,
    );
    expect(atAGlanceProblems(bad)).toEqual([
      '"Key decisions" item 2 has no in-page link',
    ]);
  });

  // Fixture (12): remark-rehype gives a footnote reference
  // `<a id="user-content-fnref-…">`, but the renderer's `a` override drops
  // the id, so a link to it goes nowhere. The earlier check read ids off every
  // element and passed this.
  it('fails an in-page link to a footnote reference, whose id the renderer drops', () => {
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\nA claim.[^n] Back to [the reference](#user-content-fnref-n).\n\n[^n]: The note.',
    );
    expect(brokenInPageLinks(bad)).toEqual(['user-content-fnref-n']);
  });

  it('passes an in-page link to a footnote itself, whose li keeps its id', () => {
    const ok = planted(
      '## Trade-offs',
      '## Trade-offs\n\nA claim.[^n] See [the note](#user-content-fn-n).\n\n[^n]: The note.',
    );
    expect(brokenInPageLinks(ok)).toEqual([]);
  });

  // Probing the same rule: an id written in raw HTML. react-markdown doesn't
  // render raw HTML as HTML, so the id never reaches the page. The earlier
  // check also reported this (raw HTML isn't an element in the tree).
  it('fails an in-page link to an id written in raw HTML', () => {
    const bad = planted(
      '## Trade-offs',
      '## Trade-offs\n\n<a id="anchor"></a>Text.\n\n<div id="block"></div>\n\nSee [a](#anchor) and [b](#block).',
    );
    expect(brokenInPageLinks(bad)).toEqual(['anchor', 'block']);
  });

  // Keeps `renderedIds` honest: its set is exactly the ids the real
  // MarkdownRenderer puts in the DOM, for a body with every heading level, a
  // repeated heading, footnotes, a table, code, a list and raw HTML.
  it('reads the same ids the real MarkdownRenderer renders', () => {
    const body = [
      '# One',
      '## Two',
      '## Two',
      '### Three',
      'Text.[^a] More.[^b] See [x](#one).',
      '| a |\n|---|\n| b |',
      '- item',
      '```js\nx\n```',
      '<span id="raw">raw</span>',
      '[^a]: Note a.',
      '[^b]: Note b.',
    ].join('\n\n');
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
    const domIds = [...container.querySelectorAll('[id]')].map((el) => el.id);
    expect([...renderedIds(body)].sort()).toEqual([...domIds].sort());
    expect(domIds).not.toContain('user-content-fnref-a');
    expect(domIds).toContain('user-content-fn-a');
  });
});
