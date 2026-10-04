import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CASE_STUDIES } from '@/lib/system-design';
import { renderAt } from '@/test/render';
import { CaseStudyNav } from './CaseStudyNav';

function renderNav(
  initialPath = '/system-design',
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return renderAt(initialPath, <CaseStudyNav {...extra} />);
}

function nav() {
  return screen.getByRole('navigation', { name: 'Case studies' });
}

describe('CaseStudyNav (criterion 9)', () => {
  it('is a navigation landmark named Case studies', () => {
    renderNav();
    expect(nav()).toBeInTheDocument();
  });

  it('lists exactly one link per case study, in order, each to its page', () => {
    renderNav();
    const links = within(nav()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      CASE_STUDIES.map((c) => `/system-design/${c.slug}`),
    );
    CASE_STUDIES.forEach((caseStudy, i) => {
      expect(links[i]).toHaveTextContent(caseStudy.title);
    });
  });

  it('is a flat list with no disclosure buttons', () => {
    renderNav('/system-design/url-shortener');
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });

  // docs/specs/dsa-kind-groups.md, criterion 5: grouping is DSA-only.
  it('renders one flat numbered list, 1..N, with no group labels', () => {
    renderNav('/system-design/url-shortener');
    const lists = within(nav()).getAllByRole('list');
    expect(lists).toHaveLength(1);
    expect(lists[0].tagName).toBe('OL');
    expect(lists[0]).not.toHaveAttribute('aria-labelledby');
    expect(lists[0]).toHaveAccessibleName('');
    // The only label is the nav's own small heading above the list.
    expect(
      [...nav().querySelectorAll('p, h2, h3, h4')].map((el) => el.textContent?.trim()),
    ).toEqual(['Case studies']);
    const links = within(lists[0]).getAllByRole('link');
    expect(links).toHaveLength(CASE_STUDIES.length);
    links.forEach((link, i) => {
      expect(link.querySelector('[aria-hidden="true"]')?.textContent?.trim()).toBe(
        `${i + 1}.`,
      );
    });
  });

  it('marks no link current on the landing page', () => {
    renderNav('/system-design');
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it.each(CASE_STUDIES.map((c) => [c.slug] as const))(
    'marks only %s current (aria-current, bold, accent border) on its page',
    (slug) => {
      renderNav(`/system-design/${slug}`);
      for (const link of within(nav()).getAllByRole('link')) {
        if (link.getAttribute('href') === `/system-design/${slug}`) {
          expect(link).toHaveAttribute('aria-current', 'page');
          expect(link).toHaveClass('font-bold');
          expect(link).toHaveClass('border-accent');
        } else {
          expect(link).not.toHaveAttribute('aria-current');
        }
      }
    },
  );

  it('calls onNavigate and navigates when a link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const [first] = CASE_STUDIES;
    renderNav('/system-design', { onNavigate });
    await user.click(within(nav()).getAllByRole('link')[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/system-design/${first.slug}`,
    );
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/system-design', { className: 'my-custom-class' });
    expect(nav()).toHaveClass('my-custom-class');
  });
});
