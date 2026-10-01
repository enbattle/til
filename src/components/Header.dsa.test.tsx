import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from './Header';

// docs/specs/dsa-tab.md, criterion 5: a third header tab, DSA, current on
// /dsa and /dsa/* only.

function renderHeader(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Header onOpenSearch={vi.fn()} onOpenNav={vi.fn()} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { name: 'Primary' });
}

const TABS = ['Catalog', 'System Design', 'DSA'] as const;

/** The names of the tabs marked aria-current="page". */
function currentTabs(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .filter((a) => a.getAttribute('aria-current') === 'page')
    .map((a) => a.textContent?.trim() ?? '');
}

describe('Header primary tabs with DSA (criterion 5)', () => {
  it('has exactly three tabs, in order Catalog, System Design, DSA', () => {
    const nav = renderHeader('/');
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent?.trim()),
    ).toEqual([...TABS]);
  });

  it('links DSA to /dsa', () => {
    const nav = renderHeader('/');
    expect(within(nav).getByRole('link', { name: 'DSA' })).toHaveAttribute(
      'href',
      '/dsa',
    );
  });

  it.each(['/dsa', '/dsa/two-pointers', '/dsa/binary-search'])(
    'marks only DSA current at %s',
    (path) => {
      expect(currentTabs(renderHeader(path))).toEqual(['DSA']);
    },
  );

  it.each(['/system-design', '/system-design/url-shortener'])(
    'marks only System Design current at %s',
    (path) => {
      expect(currentTabs(renderHeader(path))).toEqual(['System Design']);
    },
  );

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/not-found', '/dsas'])(
    'marks only Catalog current at %s',
    (path) => {
      expect(currentTabs(renderHeader(path))).toEqual(['Catalog']);
    },
  );
});
