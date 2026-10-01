import type { Processor } from 'unified';
import type { Root } from 'mdast';

export interface TopicRef {
  section: string;
  slug: string;
}

export function markdownParser(): Processor<
  Root,
  undefined,
  undefined,
  undefined,
  undefined
>;
export function isDiagramSrc(src: string | undefined): src is string;
export function diagramName(src: string): string;
export function diagramReferences(markdown: string): string[];
export function extractTopicRefs(body: string): TopicRef[];
export function extractCaseStudyRefs(body: string): string[];
export function dsaPrerequisites(markdown: string): string[];
