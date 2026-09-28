import type { Processor } from 'unified';
import type { Root } from 'mdast';

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
