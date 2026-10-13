import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CASE_STUDIES } from '@/lib/system-design';
import { renderAt } from '@/test/render';
import { CaseStudyNav } from './CaseStudyNav';
import { DsaNav } from './DsaNav';

// CaseStudyNav's own data and order (criterion 9). The behaviour it shares with
// DsaNav (landmark, aria-current, onNavigate, className, nothing current on the
// landing page) is tested once in OrderedNav.test.tsx (docs/specs/ui-dedupe.md,
// design item 6). OrderedNav.test.tsx can't see whether each wrapper forwards
// className and onNavigate to it, so the last block here checks that for both
// CaseStudyNav and DsaNav; App.tabs.test.tsx checks that App and MobileNav pass
// them in.

function nav() {
  return screen.getByRole('navigation', { name: 'Case studies' });
}

describe('CaseStudyNav (criterion 9)', () => {
  // docs/specs/ui-dedupe.md, criterion 2: each link is the case study's path.
  it('lists exactly one link per case study, in order, each to its path', () => {
    renderAt('/system-design', <CaseStudyNav />);
    const links = within(nav()).getAllByRole('link');
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      CASE_STUDIES.map((c) => c.path),
    );
    CASE_STUDIES.forEach((caseStudy, i) => {
      expect(links[i]).toHaveTextContent(caseStudy.title);
    });
  });

  // docs/specs/dsa-kind-groups.md, criterion 5: grouping is DSA-only.
  it('renders one flat numbered list, 1..N, with no group labels and no disclosure buttons', () => {
    renderAt('/system-design/url-shortener', <CaseStudyNav />);
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
    expect(within(nav()).queryAllByRole('button')).toHaveLength(0);
  });
});

// docs/specs/ui-dedupe.md, design item 6: each wrapper forwards the props
// OrderedNav handles.
describe.each([
  {
    name: 'CaseStudyNav',
    Nav: CaseStudyNav,
    label: 'Case studies',
    path: '/system-design',
  },
  { name: 'DsaNav', Nav: DsaNav, label: 'DSA entries', path: '/dsa' },
])('$name forwards className and onNavigate to OrderedNav', ({ Nav, label, path }) => {
  it('puts the given className on the nav element and calls onNavigate on a link click', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderAt(path, <Nav className="given-class lg:block" onNavigate={onNavigate} />);
    const navEl = screen.getByRole('navigation', { name: label });
    expect(navEl.className).toBe('given-class lg:block');
    expect(onNavigate).not.toHaveBeenCalled();
    await user.click(within(navEl).getAllByRole('link')[0]);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
