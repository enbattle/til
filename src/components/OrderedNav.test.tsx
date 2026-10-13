import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderAt } from '@/test/render';
import { OrderedNav } from './OrderedNav';

// docs/specs/ui-dedupe.md, design item 6: CaseStudyNav's shared list
// behaviour lives in OrderedNav, so it's tested here: the landmark name,
// aria-current (with the bold plus accent border signal), onNavigate,
// className, and nothing current on a landing page. CaseStudyNav.test.tsx
// keeps only its own data and order. docs/specs/remove-dsa-tab.md, criterion
// 6: OrderedNav takes only a flat item list; grouped mode is gone.

const FLAT = [
  { to: '/things/alpha', title: 'Alpha', number: 1 },
  { to: '/things/beta', title: 'Beta', number: 2 },
  { to: '/things/gamma', title: 'Gamma', number: 3 },
];

const LABEL = 'Things';

function renderNav(
  path: string,
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return renderAt(
    path,
    <OrderedNav label={LABEL} heading="Things heading" items={FLAT} {...extra} />,
  );
}

function nav() {
  return screen.getByRole('navigation', { name: LABEL });
}

describe('OrderedNav', () => {
  it('is one navigation landmark named by its label', () => {
    renderNav('/things');
    expect(screen.getAllByRole('navigation')).toEqual([nav()]);
  });

  it('links every item, in order, to its `to`', () => {
    renderNav('/things');
    expect(
      within(nav())
        .getAllByRole('link')
        .map((a) => [a.getAttribute('href'), a.textContent]),
    ).toEqual(FLAT.map(({ to, title, number }) => [to, `${number}.${title}`]));
  });

  it('marks no link current on a page that is none of its items (a landing page)', () => {
    renderNav('/things');
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
      expect(link).not.toHaveClass('font-bold');
      expect(link).toHaveClass('border-transparent');
    }
  });

  it.each(FLAT.map(({ to }) => [to] as const))(
    'marks only the link to %s current (aria-current, bold, accent border) on its page',
    (to) => {
      renderNav(to);
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
    renderNav('/things', { onNavigate });
    await user.click(within(nav()).getByRole('link', { name: /Beta/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent('/things/beta');
  });

  it('navigates without onNavigate (the persistent sidebar omits it)', async () => {
    const user = userEvent.setup();
    renderNav('/things');
    await user.click(within(nav()).getByRole('link', { name: /Gamma/ }));
    expect(screen.getByTestId('location-display')).toHaveTextContent('/things/gamma');
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/things', { className: 'my-custom-class' });
    expect(nav()).toHaveClass('my-custom-class');
  });

  it('hides the visible numbers from screen readers and has no disclosure buttons', () => {
    renderNav('/things');
    for (const [i, link] of within(nav()).getAllByRole('link').entries()) {
      expect(link.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(
        `${FLAT[i].number}.`,
      );
      expect(link).toHaveAccessibleName(FLAT[i].title);
    }
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });

  it('renders one flat numbered list, with no group labels', () => {
    renderNav('/things/beta');
    const lists = within(nav()).getAllByRole('list');
    expect(lists).toHaveLength(1);
    expect(lists[0].tagName).toBe('OL');
    expect(
      [...nav().querySelectorAll('p, h2, h3, h4')].map((el) => el.textContent?.trim()),
    ).toEqual(['Things heading']);
  });

  it('accepts only a flat item list', () => {
    const groups = [{ label: 'A group', items: FLAT }];
    // @ts-expect-error OrderedNav has no grouped mode.
    const element = <OrderedNav label={LABEL} heading="Things heading" items={groups} />;
    expect(element.type).toBe(OrderedNav);
  });
});
