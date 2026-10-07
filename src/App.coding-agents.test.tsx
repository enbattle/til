import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getTopic } from '@/lib/content';
import { renderAt } from '@/test/render';

// docs/specs/catalog-standard.md, criterion 4: the "Working with Coding
// Agents" section shows on the home page and in the sidebar right after AI
// and Machine Learning, holds the four moved topics, and its topics' prev/next
// stays inside it. Labels and slugs are pinned here, not read from the
// registry, so a missing section fails these tests rather than passing them.

const LABEL = 'Working with Coding Agents';
const MOVED = [
  'context-is-a-budget',
  'documentation-vs-skill-vs-hook',
  'keeping-ai-native-docs-from-going-stale',
  'triaging-ai-code-review',
];
const ORDER = [
  'engineering-practices',
  'ai-and-ml',
  'coding-agents',
  'focus-and-attention',
  'security',
  'systems-and-infrastructure',
];
const LABELS = [
  'Computing Fundamentals',
  'Engineering Practices',
  'AI and Machine Learning',
  LABEL,
  'Focus and Attention',
  'Security',
  'Systems and Infrastructure',
];

describe('the Working with Coding Agents section (catalog-standard criterion 4)', () => {
  it('has each moved topic under coding-agents and none under ai-and-ml', () => {
    for (const slug of MOVED) {
      expect(getTopic('coding-agents', slug), slug).toBeDefined();
      expect(getTopic('ai-and-ml', slug), slug).toBeUndefined();
    }
  });

  it('lists the sections on the home page in order, the new one right after AI and Machine Learning', () => {
    renderAt('/');
    const main = screen.getByRole('main');
    const sections = within(main)
      .getByRole('heading', { level: 2, name: 'Sections' })
      .closest('section') as HTMLElement;
    expect(
      within(sections)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(LABELS);
    expect(
      within(sections).getByRole('link', { name: new RegExp(LABEL) }),
    ).toHaveAttribute('href', '/coding-agents');
  });

  it('lists the sections in the sidebar in the same order', () => {
    renderAt('/');
    const main = screen.getByRole('main');
    const wanted = new Set(ORDER.map((slug) => `/${slug}`));
    const hrefs = [...document.querySelectorAll('a')]
      .filter((a) => !main.contains(a))
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => wanted.has(href));
    expect([...new Set(hrefs)]).toEqual(ORDER.map((slug) => `/${slug}`));
    expect(screen.getAllByRole('link', { name: LABEL }).length).toBeGreaterThan(0);
  });

  it('lists exactly the four moved topics on its section page', () => {
    renderAt('/coding-agents');
    expect(screen.getByRole('heading', { level: 1, name: LABEL })).toBeInTheDocument();
    const main = screen.getByRole('main');
    const topicHrefs = within(main)
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')
      .filter((href) => href.startsWith('/coding-agents/'))
      .sort();
    expect(topicHrefs).toEqual(MOVED.map((slug) => `/coding-agents/${slug}`));
  });

  it.each(MOVED)(
    'keeps prev/next inside the section on /coding-agents/%s',
    async (slug) => {
      expect(getTopic('coding-agents', slug), slug).toBeDefined();
      renderAt(`/coding-agents/${slug}`);
      const pager = await screen.findByRole(
        'navigation',
        { name: `More in ${LABEL}` },
        { timeout: 5000 },
      );
      const hrefs = within(pager)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href') ?? '');
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        expect(href).toMatch(/^\/coding-agents\/[^/]+$/);
        expect(MOVED).toContain(href.slice('/coding-agents/'.length));
      }
    },
  );
});
