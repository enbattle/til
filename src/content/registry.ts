export interface Section {
  slug: string;
  label: string;
  description: string;
}

/**
 * Every top-level section, in the order they're shown on the home page.
 * Adding a section means adding both a folder under `src/content/` and an
 * entry here — `registry.test.ts` fails loudly if either is missing the
 * other, so this list can't silently drift from what's on disk.
 */
export const SECTIONS: Section[] = [
  {
    slug: 'engineering-practices',
    label: 'Engineering Practices',
    description:
      'How thoughtful engineering teams work — planning, decisions, and process that hold up as things grow.',
  },
  {
    slug: 'ai-and-ml',
    label: 'AI & Machine Learning',
    description:
      'How language models work under the hood, and how to actually get good results out of them.',
  },
  {
    slug: 'focus-and-attention',
    label: 'Focus & Attention',
    description:
      'How attention and dopamine actually work, why modern digital environments make focus hard, and what actually helps you concentrate and retain what you learn.',
  },
  {
    slug: 'security',
    label: 'Security',
    description:
      'Common vulnerabilities and the authentication patterns that guard against them — worth understanding before you ship anything that touches user data.',
  },
  {
    slug: 'systems-and-infrastructure',
    label: 'Systems & Infrastructure',
    description:
      'The distributed-systems and database fundamentals behind anything running at real scale — tradeoffs worth knowing before you hit them in production.',
  },
];

export function getSection(slug: string): Section | undefined {
  return SECTIONS.find((section) => section.slug === slug);
}
