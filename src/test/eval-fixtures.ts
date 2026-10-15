import type { Nodes, RootContent } from 'mdast';
import { getSection } from '@/content/registry';
import { markdownParser } from '@/lib/markdown.mjs';

// The content-review eval's drafts, read out of evals/content-review/scenarios.md
// so the structure tests can run the published pages' rules on them
// (docs/specs/eval-fixture-structure-check.md). The file is parsed with the
// site's own markdown parser, never searched with a regex, so a draft fenced
// with four backticks around an inner triple-backtick block comes out whole.

/** One `### CR-` scenario's draft: its ID ("CR-01"), the section its
 * `**Section:**` paragraph names, and the draft, frontmatter included. */
export interface TopicDraft {
  id: string;
  section: string;
  raw: string;
}

/** The case-study scenarios' shared base draft, frontmatter included. */
interface CaseStudyDraft {
  raw: string;
}

export interface EvalFixtures {
  topics: TopicDraft[];
  caseStudyBase: CaseStudyDraft;
}

export const SCENARIOS_PATH = '/evals/content-review/scenarios.md';
export const BASE_HEADING = 'Base draft (the CS-03 control, verbatim)';

const SCENARIO_FILES = import.meta.glob('/evals/content-review/scenarios.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const parser = markdownParser();

/** The text of a markdown node and everything under it. */
function textOf(node: Nodes): string {
  if ('value' in node) return node.value;
  return 'children' in node ? node.children.map((c) => textOf(c)).join('') : '';
}

/** The top-level nodes after `nodes[index]` (a heading), up to the next
 * heading of depth 3 or less. */
function scenarioRange(nodes: RootContent[], index: number): RootContent[] {
  const range: RootContent[] = [];
  for (const node of nodes.slice(index + 1)) {
    if (node.type === 'heading' && node.depth <= 3) break;
    range.push(node);
  }
  return range;
}

/** The value of the first fenced code node with lang `markdown` in `range`. */
function markdownDraft(range: RootContent[]): string | undefined {
  for (const node of range) {
    if (node.type === 'code' && node.lang === 'markdown') return node.value;
  }
  return undefined;
}

/** The first inline code in the paragraph of `range` that opens with bold
 * `Section:`; throws, naming `id`, when there's no such paragraph, it names
 * no section, or the section isn't in the registry (an unknown one would
 * silently skip the systems-and-infrastructure rules). */
function sectionOf(id: string, range: RootContent[]): string {
  const paragraph = range.find((node) => {
    if (node.type !== 'paragraph') return false;
    const first = node.children[0];
    return first?.type === 'strong' && textOf(first).trim() === 'Section:';
  });
  if (!paragraph || paragraph.type !== 'paragraph') {
    throw new Error(`${id} has no "**Section:**" paragraph`);
  }
  const code = paragraph.children.find((c) => c.type === 'inlineCode');
  if (!code || code.type !== 'inlineCode') {
    throw new Error(`${id}'s "**Section:**" paragraph names no section in inline code`);
  }
  if (!getSection(code.value)) {
    throw new Error(`${id}'s section "${code.value}" is not a registered section`);
  }
  return code.value;
}

/**
 * The content-review drafts in `scenarios` (the text of a scenarios file):
 * one per `### CR-` heading, in file order, and the case-study base under
 * `### BASE_HEADING`. Throws, naming the scenario, when a CR scenario has no
 * `markdown` draft or no registered section, or sits under a `##` heading
 * marked retired (the last retired block runs to the end of the file, so a
 * scenario appended there would otherwise drop out); or when the base
 * heading or its draft is missing. No fixture silently drops out of the
 * structure check.
 */
export function extractEvalFixtures(scenarios: string): EvalFixtures {
  const nodes = parser.parse(scenarios).children;
  const topics: TopicDraft[] = [];
  let caseStudyBase: CaseStudyDraft | undefined;
  let baseSeen = false;
  let retired = false;
  nodes.forEach((node, index) => {
    if (node.type !== 'heading') return;
    const text = textOf(node).trim();
    if (node.depth <= 2) {
      retired = text.toLowerCase().includes('retired');
      return;
    }
    if (node.depth !== 3) return;
    if (text.startsWith('CR-')) {
      const id = text.split(' ')[0];
      if (retired) throw new Error(`${id} sits under a \`##\` heading marked retired`);
      const range = scenarioRange(nodes, index);
      const raw = markdownDraft(range);
      if (raw === undefined) throw new Error(`${id} has no \`markdown\` draft`);
      topics.push({ id, section: sectionOf(id, range), raw });
    } else if (text === BASE_HEADING && !baseSeen) {
      baseSeen = true;
      const raw = markdownDraft(scenarioRange(nodes, index));
      if (raw === undefined) {
        throw new Error(`"### ${BASE_HEADING}" has no \`markdown\` draft`);
      }
      caseStudyBase = { raw };
    }
  });
  if (!caseStudyBase) throw new Error(`no "### ${BASE_HEADING}" heading`);
  return { topics, caseStudyBase };
}

/** The text of the real evals/content-review/scenarios.md. */
export function scenariosText(): string {
  const text = SCENARIO_FILES[SCENARIOS_PATH];
  if (text === undefined) throw new Error(`no raw file for ${SCENARIOS_PATH}`);
  return text;
}

/** The drafts in the real evals/content-review/scenarios.md. */
export default function contentReviewFixtures(): EvalFixtures {
  return extractEvalFixtures(scenariosText());
}
