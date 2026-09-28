import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CaseStudyPage } from './CaseStudyPage';

// Review finding L3: the Contents list's links and the rendered h2 ids must
// agree for headings with inline markdown, and duplicate headings must get
// distinct ids (e.g. `notes`, `notes-1`) with no duplicate React key.

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

vi.mock('@/lib/system-design', () => {
  const study = {
    slug: 'demo',
    title: 'Design a Demo',
    summary: 'A demo.',
    date: '2026-09-28',
    order: 1,
  };
  return {
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

describe('CaseStudyPage Contents', () => {
  async function renderPage() {
    const utils = render(
      <MemoryRouter initialEntries={['/system-design/demo']}>
        <ThemeProvider>
          <Routes>
            <Route path="/system-design/:slug" element={<CaseStudyPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );
    const contents = await screen.findByRole('navigation', { name: 'Contents' });
    await waitFor(() => expect(utils.container.querySelectorAll('h2').length).toBe(4));
    return { ...utils, contents };
  }

  it('links every entry to the id of the h2 it names', async () => {
    const { container, contents } = await renderPage();
    const links = within(contents).getAllByRole('link');
    const headings = [...container.querySelectorAll('h2')];
    expect(links).toHaveLength(headings.length);
    links.forEach((link, i) => {
      expect(link).toHaveAttribute('href', `#${headings[i].id}`);
      expect(headings[i].id).not.toBe('');
      expect(container.querySelector(`[id="${headings[i].id}"]`)).toBe(headings[i]);
    });
  });

  it('labels an entry with the heading as it renders', async () => {
    const { contents } = await renderPage();
    const labels = within(contents)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual([
      'Deep dive: the user_id index',
      'Why this matters',
      'Notes',
      'Notes',
    ]);
  });

  it('gives two identical headings distinct ids and links, with no duplicate-key warning', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { contents } = await renderPage();
    const hrefs = within(contents)
      .getAllByRole('link', { name: 'Notes' })
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['#notes', '#notes-1']);
    expect(duplicateKeyErrors(error)).toEqual([]);
  });
});
