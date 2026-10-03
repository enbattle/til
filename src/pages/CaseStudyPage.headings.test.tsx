import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { renderAt } from '@/test/render';

// Review finding L3: the "On this page" links (formerly the Contents list)
// and the rendered h2 ids must agree for headings with inline markdown, and
// duplicate headings must get distinct ids (e.g. `notes`, `notes-1`) with no
// duplicate React key (docs/specs/on-this-page-nav.md, criterion 1).

const BODY = [
  '## Deep dive: the `user_id` index',
  '',
  'Text about the index.',
  '',
  '## Why *this* matters',
  '',
  'Text about why.',
  '',
  '## Notes',
  '',
  'First notes.',
  '',
  '## Notes',
  '',
  'Second notes.',
  '',
].join('\n');

vi.mock('@/lib/system-design', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/system-design')>('@/lib/system-design');
  const study = {
    slug: 'demo',
    title: 'Design a Demo',
    summary: 'A demo.',
    date: '2026-09-28',
    order: 1,
  };
  return {
    ...actual,
    CASE_STUDIES: [study],
    getCaseStudy: (slug: string) => (slug === 'demo' ? study : undefined),
    loadCaseStudyBody: () => Promise.resolve(BODY),
    topicsForCaseStudy: () => [],
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

function duplicateKeyErrors(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    args.some((arg) => typeof arg === 'string' && /same key|unique "key"/i.test(arg)),
  );
}

describe('MarkdownRenderer heading ids', () => {
  it('gives duplicate h2 headings distinct ids', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <MarkdownRenderer content={BODY} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const ids = [...container.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toEqual([
      'deep-dive-the-user-id-index',
      'why-this-matters',
      'notes',
      'notes-1',
    ]);
  });
});

describe('CaseStudyPage "On this page"', () => {
  // Through the real App, so the shell's right column exists for the right
  // nav. Both copies are checked: the disclosure inside <main> and the right
  // nav outside it.
  async function renderPage() {
    const utils = renderAt('/system-design/demo');
    await screen.findByRole('heading', { level: 1, name: 'Design a Demo' });
    const main = screen.getByRole('main');
    await waitFor(() => expect(main.querySelectorAll('.prose h2').length).toBe(4));
    const navs = await waitFor(() => {
      const found = screen.getAllByRole('navigation', { name: 'On this page' });
      expect(found.filter((nav) => !main.contains(nav))).toHaveLength(1);
      expect(found.filter((nav) => main.contains(nav))).toHaveLength(1);
      return found;
    });
    return { ...utils, main, navs };
  }

  it('links every entry to the id of the h2 it names, in both copies', async () => {
    const { main, navs } = await renderPage();
    const headings = [...main.querySelectorAll('.prose h2')];
    for (const nav of navs) {
      const links = within(nav).getAllByRole('link');
      expect(links).toHaveLength(headings.length);
      links.forEach((link, i) => {
        expect(link).toHaveAttribute('href', `#${headings[i].id}`);
        expect(headings[i].id).not.toBe('');
        expect(document.querySelector(`[id="${headings[i].id}"]`)).toBe(headings[i]);
      });
    }
  });

  it('labels an entry with the heading as it renders', async () => {
    const { navs } = await renderPage();
    for (const nav of navs) {
      const labels = within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent);
      expect(labels).toEqual([
        'Deep dive: the user_id index',
        'Why this matters',
        'Notes',
        'Notes',
      ]);
    }
  });

  it('gives two identical headings distinct ids and links, with no duplicate-key warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { navs } = await renderPage();
    for (const nav of navs) {
      const hrefs = within(nav)
        .getAllByRole('link', { name: 'Notes' })
        .map((link) => link.getAttribute('href'));
      expect(hrefs).toEqual(['#notes', '#notes-1']);
    }
    expect(duplicateKeyErrors(error)).toEqual([]);
  });

  it('renders no "Contents" navigation', async () => {
    await renderPage();
    expect(
      screen.queryByRole('navigation', { name: 'Contents' }),
    ).not.toBeInTheDocument();
  });
});
