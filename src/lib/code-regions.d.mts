export interface CodeRegion {
  name: string;
  text: string;
  /** The 1-based line of the region's opening marker. */
  line: number;
}

export function parseRegions(
  source: string,
  language: 'python' | 'typescript',
): CodeRegion[];

export function resolveCodeRegions(
  markdown: string,
  files: { python?: string; typescript?: string; label: string },
): string;
