import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECTIONS } from './registry';

const CONTENT_DIR = path.dirname(fileURLToPath(import.meta.url));

describe('section registry', () => {
  it('has exactly one entry per folder under src/content', () => {
    const folders = readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const registered = SECTIONS.map((section) => section.slug).sort();

    expect(registered).toEqual(folders);
  });

  it('has a non-empty label and description for every section', () => {
    for (const section of SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.description.length).toBeGreaterThan(0);
    }
  });

  // Criterion 8: /system-design and /not-found are static routes in App.tsx;
  // a section with either slug would be shadowed (or shadow them).
  it('does not use a slug reserved by a static route', () => {
    const slugs = SECTIONS.map((section) => section.slug);
    expect(slugs).not.toContain('system-design');
    expect(slugs).not.toContain('not-found');
  });
});

// docs/specs/catalog-standard.md, criteria 4 and 5.
describe('the Working with Coding Agents section (catalog-standard criterion 4)', () => {
  const MOVED = [
    'context-is-a-budget',
    'documentation-vs-skill-vs-hook',
    'keeping-ai-native-docs-from-going-stale',
    'triaging-ai-code-review',
  ];

  it('is registered as coding-agents, right after ai-and-ml', () => {
    const slugs = SECTIONS.map((section) => section.slug);
    const section = SECTIONS.find((s) => s.slug === 'coding-agents');
    expect(section?.label).toBe('Working with Coding Agents');
    expect(section?.description.length).toBeGreaterThan(0);
    expect(slugs.indexOf('coding-agents')).toBe(slugs.indexOf('ai-and-ml') + 1);
  });

  it('holds exactly the four moved topics on disk, none of them left in ai-and-ml', () => {
    const files = (dir: string) =>
      readdirSync(path.join(CONTENT_DIR, dir))
        .filter((name) => name.endsWith('.md'))
        .map((name) => name.replace(/\.md$/, ''))
        .sort();
    expect(files('coding-agents')).toEqual(MOVED);
    for (const slug of MOVED) expect(files('ai-and-ml')).not.toContain(slug);
    // prompt-engineering stays in ai-and-ml (spec scope).
    expect(files('ai-and-ml')).toContain('prompt-engineering');
  });
});

describe('section labels and slugs (catalog-standard criterion 5)', () => {
  it('has no label containing "&"', () => {
    expect(SECTIONS.filter((s) => s.label.includes('&')).map((s) => s.label)).toEqual([]);
  });

  it('keeps every slug and its order, with coding-agents added after ai-and-ml', () => {
    expect(SECTIONS.map((s) => s.slug)).toEqual([
      'engineering-practices',
      'ai-and-ml',
      'coding-agents',
      'focus-and-attention',
      'security',
      'systems-and-infrastructure',
    ]);
  });

  it('spells the renamed labels with "and"', () => {
    expect(Object.fromEntries(SECTIONS.map((s) => [s.slug, s.label]))).toEqual({
      'engineering-practices': 'Engineering Practices',
      'ai-and-ml': 'AI and Machine Learning',
      'coding-agents': 'Working with Coding Agents',
      'focus-and-attention': 'Focus and Attention',
      security: 'Security',
      'systems-and-infrastructure': 'Systems and Infrastructure',
    });
  });
});
