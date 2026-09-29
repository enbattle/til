import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { h2Headings } from '@/lib/headings';
import { CaseStudyPage } from './CaseStudyPage';

// Review finding L4: headings with no ASCII letters or digits slug to nothing
// under a plain a-z0-9 rule. Each must still render with a non-empty id, the
// Contents list must link to exactly those ids, and no link may be `href="#"`.

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const BODY = [
  '## 日本語',
  '',
  'First.',
  '',
  '## —',
  '',
  'Second.',
  '',
  '## !!!',
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

describe('MarkdownRenderer ids for headings with no ASCII letters or digits', () => {
  it('renders distinct, non-empty h2 ids equal to h2Headings', () => {
    const { container } = render(
      <MemoryRouter>
        <ThemeProvider>
          <MarkdownRenderer content={BODY} />
        </ThemeProvider>
      </MemoryRouter>,
    );
    const ids = [...container.querySelectorAll('h2')].map((h) => h.id);
    expect(ids).toHaveLength(3);
    ids.forEach((id) => expect(id).toMatch(ID));
    expect(new Set(ids).size).toBe(3);
    expect(h2Headings(BODY).map((h) => h.id)).toEqual(ids);
  });
});

describe('CaseStudyPage Contents for headings with no ASCII letters or digits', () => {
  it('links each entry to its rendered h2 and never to "#"', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/system-design/demo']}>
        <ThemeProvider>
          <Routes>
            <Route path="/system-design/:slug" element={<CaseStudyPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );
    const contents = await screen.findByRole('navigation', { name: 'Contents' });
    await waitFor(() => expect(container.querySelectorAll('h2').length).toBe(3));
    const links = within(contents).getAllByRole('link');
    const headings = [...container.querySelectorAll('h2')];
    expect(links).toHaveLength(3);
    links.forEach((link, i) => {
      expect(link.getAttribute('href')).not.toBe('#');
      expect(headings[i].id).toMatch(ID);
      expect(link).toHaveAttribute('href', `#${headings[i].id}`);
    });
  });
});
