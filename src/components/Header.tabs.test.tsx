import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { QUESTIONS } from '@/lib/system-design';
import { Header } from './Header';

function renderHeader(onOpenSearch = vi.fn(), onOpenNav = vi.fn(), path = '/') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <Header onOpenSearch={onOpenSearch} onOpenNav={onOpenNav} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onOpenSearch, onOpenNav };
}

describe('Header', () => {
  // --- Criteria 10-12: primary tabs ---
  describe('primary tabs', () => {
    const catalogPaths = [
      '/',
      '/ai-and-ml',
      '/ai-and-ml/prompt-engineering',
      '/not-found',
    ];
    const systemDesignPaths = ['/system-design', `/system-design/${QUESTIONS[0]?.slug}`];

    function primaryNav() {
      return screen.getByRole('navigation', { name: 'Primary' });
    }

    it.each([...catalogPaths, ...systemDesignPaths])(
      'contains Catalog (/) and System Design (/system-design) links at %s',
      (path) => {
        renderHeader(vi.fn(), vi.fn(), path);
        const nav = primaryNav();
        expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
          'href',
          '/',
        );
        expect(within(nav).getByRole('link', { name: 'System Design' })).toHaveAttribute(
          'href',
          '/system-design',
        );
      },
    );

    it.each(catalogPaths)('marks Catalog, not System Design, current at %s', (path) => {
      renderHeader(vi.fn(), vi.fn(), path);
      const nav = primaryNav();
      expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(
        within(nav).getByRole('link', { name: 'System Design' }),
      ).not.toHaveAttribute('aria-current');
    });

    it.each(systemDesignPaths)(
      'marks System Design, not Catalog, current at %s',
      (path) => {
        renderHeader(vi.fn(), vi.fn(), path);
        const nav = primaryNav();
        expect(within(nav).getByRole('link', { name: 'System Design' })).toHaveAttribute(
          'aria-current',
          'page',
        );
        expect(within(nav).getByRole('link', { name: 'Catalog' })).not.toHaveAttribute(
          'aria-current',
        );
      },
    );

    it('does not treat a path merely starting with the text "system-design" as System Design', () => {
      renderHeader(vi.fn(), vi.fn(), '/system-designs');
      const nav = primaryNav();
      expect(
        within(nav).getByRole('link', { name: 'System Design' }),
      ).not.toHaveAttribute('aria-current');
      expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });

    it('keeps the til logo linking to /', () => {
      renderHeader(vi.fn(), vi.fn(), '/system-design');
      expect(screen.getByRole('link', { name: 'til' })).toHaveAttribute('href', '/');
    });

    it('has no other landmark named Primary', () => {
      renderHeader();
      expect(screen.getAllByRole('navigation', { name: 'Primary' })).toHaveLength(1);
    });
  });
});
