import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CASE_STUDIES } from '@/lib/system-design';
import { MobileNav } from './MobileNav';

function renderMobileNav(initialPath = '/') {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileNav onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('MobileNav', () => {
  // --- Criterion 9: System Design routes show CaseStudyNav ---
  describe('on a System Design route', () => {
    it.each(['/system-design', '/system-design/url-shortener'])(
      'renders the Case studies nav, not the Sections nav, inside the dialog at %s',
      (path) => {
        renderMobileNav(path);
        const dialog = screen.getByRole('dialog', { name: 'Navigation' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const nav = within(dialog).getByRole('navigation', { name: 'Case studies' });
        expect(
          within(nav)
            .getAllByRole('link')
            .map((a) => a.getAttribute('href')),
        ).toEqual(CASE_STUDIES.map((c) => `/system-design/${c.slug}`));
        expect(
          screen.queryByRole('navigation', { name: 'Sections' }),
        ).not.toBeInTheDocument();
      },
    );

    it('marks the current case study with aria-current="page"', () => {
      renderMobileNav('/system-design/url-shortener');
      const nav = screen.getByRole('navigation', { name: 'Case studies' });
      const current = within(nav)
        .getAllByRole('link')
        .filter((a) => a.getAttribute('aria-current') === 'page');
      expect(current.map((a) => a.getAttribute('href'))).toEqual([
        '/system-design/url-shortener',
      ]);
    });

    it('closes when a case-study link is clicked', async () => {
      const user = userEvent.setup();
      const onClose = renderMobileNav('/system-design');
      const nav = screen.getByRole('navigation', { name: 'Case studies' });
      await user.click(within(nav).getAllByRole('link')[0]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the panel but not on a link', async () => {
      const user = userEvent.setup();
      const onClose = renderMobileNav('/system-design');
      await user.click(screen.getByRole('navigation', { name: 'Case studies' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('still renders the Sections nav, not Case studies, on a catalog route', () => {
    renderMobileNav('/ai-and-ml/prompt-engineering');
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(
      within(dialog).getByRole('navigation', { name: 'Sections' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Case studies' }),
    ).not.toBeInTheDocument();
  });
});
