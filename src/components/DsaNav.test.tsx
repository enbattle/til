import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DSA_ENTRIES } from '@/lib/dsa';
import { renderAt } from '@/test/render';
import { DsaNav } from './DsaNav';
import { MobileNav } from './MobileNav';

// docs/specs/dsa-tab.md, criterion 8: `DsaNav` is a flat ordered list of the
// entries like `CaseStudyNav`, and MobileNav shows it on DSA routes.

const NAV_NAME = 'DSA entries';

function renderNav(
  initialPath = '/dsa',
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return renderAt(initialPath, <DsaNav {...extra} />);
}

function nav() {
  return screen.getByRole('navigation', { name: NAV_NAME });
}

describe('DsaNav (criterion 8)', () => {
  it('lists exactly one link per entry, in DSA_ENTRIES order, each to its page', () => {
    renderNav();
    const links = within(nav()).getAllByRole('link');
    expect(DSA_ENTRIES.length).toBeGreaterThan(0);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      DSA_ENTRIES.map((e) => `/dsa/${e.slug}`),
    );
    DSA_ENTRIES.forEach((entry, i) => expect(links[i]).toHaveTextContent(entry.title));
  });

  it('is an ordered list with no disclosure buttons', () => {
    renderNav('/dsa/binary-search');
    expect(nav().querySelector('ol')).not.toBeNull();
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });

  it('marks no link current on the landing page', () => {
    renderNav('/dsa');
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it.each(DSA_ENTRIES.map((e) => [e.slug] as const))(
    'marks only %s current (aria-current, bold, accent border) on its page',
    (slug) => {
      renderNav(`/dsa/${slug}`);
      for (const link of within(nav()).getAllByRole('link')) {
        if (link.getAttribute('href') === `/dsa/${slug}`) {
          expect(link).toHaveAttribute('aria-current', 'page');
          expect(link).toHaveClass('font-bold');
          expect(link).toHaveClass('border-accent');
        } else {
          expect(link).not.toHaveAttribute('aria-current');
          expect(link).not.toHaveClass('font-bold');
        }
      }
    },
  );

  it('calls onNavigate and navigates when a link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderNav('/dsa', { onNavigate });
    await user.click(within(nav()).getAllByRole('link')[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/dsa/${DSA_ENTRIES[0].slug}`,
    );
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/dsa', { className: 'my-custom-class' });
    expect(nav()).toHaveClass('my-custom-class');
  });
});

describe('MobileNav on DSA routes (criterion 8)', () => {
  function renderMobileNav(path: string) {
    const onClose = vi.fn();
    renderAt(path, <MobileNav onClose={onClose} />);
    return onClose;
  }

  it.each(['/dsa', '/dsa/binary-search'])(
    'renders the DSA nav, not Sections or Case studies, in the dialog at %s',
    (path) => {
      renderMobileNav(path);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      const dsa = within(dialog).getByRole('navigation', { name: NAV_NAME });
      expect(
        within(dsa)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(DSA_ENTRIES.map((e) => `/dsa/${e.slug}`));
      expect(
        screen.queryByRole('navigation', { name: 'Sections' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Case studies' }),
      ).not.toBeInTheDocument();
    },
  );

  it('marks the current entry with aria-current="page"', () => {
    renderMobileNav('/dsa/binary-search');
    const current = within(screen.getByRole('navigation', { name: NAV_NAME }))
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/dsa/binary-search']);
  });

  it('closes when an entry link is clicked', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav('/dsa');
    const dsa = screen.getByRole('navigation', { name: NAV_NAME });
    await user.click(within(dsa).getAllByRole('link')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows Case studies, not the DSA nav, on a System Design route', () => {
    renderMobileNav('/system-design/url-shortener');
    expect(screen.getByRole('navigation', { name: 'Case studies' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: NAV_NAME })).not.toBeInTheDocument();
  });

  it('shows Sections, not the DSA nav, on a catalog route', () => {
    renderMobileNav('/ai-and-ml/prompt-engineering');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: NAV_NAME })).not.toBeInTheDocument();
  });
});
