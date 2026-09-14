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
    slug: 'languages-and-runtimes',
    label: 'Languages & Runtimes',
    description:
      'How programming languages and the runtimes underneath them actually behave.',
  },
  {
    slug: 'tools-and-workflow',
    label: 'Tools & Workflow',
    description:
      'Git, the command line, and the everyday tools that make development smoother.',
  },
];

export function getSection(slug: string): Section | undefined {
  return SECTIONS.find((section) => section.slug === slug);
}
