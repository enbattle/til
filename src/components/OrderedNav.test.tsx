import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import { OrderedNav } from './OrderedNav';

// docs/specs/ui-dedupe.md, design item 6: the behaviour CaseStudyNav and DsaNav
// share lives in OrderedNav, so it's tested here once, on a flat list and on a
// grouped one: the landmark name, aria-current (with the bold plus accent
// border signal), onNavigate, className, and nothing current on a landing
// page. CaseStudyNav.test.tsx and DsaNav.test.tsx keep only their own data and
// order.

const FLAT = [
  { to: '/things/alpha', title: 'Alpha', number: 1 },
  { to: '/things/beta', title: 'Beta', number: 2 },
  { to: '/things/gamma', title: 'Gamma', number: 3 },
];

const GROUPED = [
  { label: 'First group', items: FLAT.slice(0, 2) },
  { label: 'Second group', items: FLAT.slice(2) },
];

const SHAPES = [
  { shape: 'flat', items: FLAT },
  { shape: 'grouped', items: GROUPED },
] as const;

const LABEL = 'Things';

function renderNav(
  path: string,
  items: (typeof SHAPES)[number]['items'],
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return renderAt(
    path,
    <OrderedNav label={LABEL} heading="Things heading" items={items} {...extra} />,
  );
}

function nav() {
  return screen.getByRole('navigation', { name: LABEL });
}

describe.each(SHAPES)('OrderedNav, $shape', ({ items }) => {
  it('is one navigation landmark named by its label', () => {
    renderNav('/things', items);
    expect(screen.getAllByRole('navigation')).toEqual([nav()]);
  });

  it('links every item, in order, to its `to`', () => {
    renderNav('/things', items);
    expect(
      within(nav())
        .getAllByRole('link')
        .map((a) => [a.getAttribute('href'), a.textContent]),
    ).toEqual(FLAT.map(({ to, title, number }) => [to, `${number}.${title}`]));
  });

  it('marks no link current on a page that is none of its items (a landing page)', () => {
    renderNav('/things', items);
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).not.toHaveClass('font-bold');
      expect(link).toHaveClass('border-transparent');
    }
  });

  it.each(FLAT.map(({ to }) => [to] as const))(
    'marks only the link to %s current (aria-current, bold, accent border) on its page',
    (to) => {
      renderNav(to, items);
      for (const link of within(nav()).getAllByRole('link')) {
        if (link.getAttribute('href') === to) {
          expect(link).toHaveAttribute('aria-current', 'page');
          expect(link).toHaveClass('font-bold', 'border-accent');
        } else {
          expect(link).not.toHaveAttribute('aria-current');
          expect(link).not.toHaveClass('font-bold');
        }
      }
    },
  );

  it('calls onNavigate once and navigates when a link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderNav('/things', items, { onNavigate });
    await user.click(within(nav()).getByRole('link', { name: /Beta/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/things/beta');
  });

  it('navigates without onNavigate (the persistent sidebar omits it)', async () => {
    const user = userEvent.setup();
    renderNav('/things', items);
    await user.click(within(nav()).getByRole('link', { name: /Gamma/ }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/things/gamma');
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/things', items, { className: 'my-custom-class' });
    expect(nav()).toHaveClass('my-custom-class');
  });

  it('hides the visible numbers from screen readers and has no disclosure buttons', () => {
    renderNav('/things', items);
    for (const [i, link] of within(nav()).getAllByRole('link').entries()) {
      expect(link.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(
        `${FLAT[i].number}.`,
      );
      expect(link).toHaveAccessibleName(FLAT[i].title);
    }
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });
});
