import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { topicsBySection } from '@/lib/content';
import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('renders the home page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'til' })).toBeInTheDocument();
  });

  it('renders a section page for a known section', () => {
    renderAt('/ai-and-ml');
    expect(
      screen.getByRole('heading', { level: 1, name: 'AI & Machine Learning' }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown top-level path to the not-found page', () => {
    renderAt('/this-does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('redirects an unknown topic slug under a real section to not-found', async () => {
    renderAt('/ai-and-ml/nonexistent-topic');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('renders a real topic end-to-end through the lazy-loaded TopicPage, code block included', async () => {
    renderAt('/ai-and-ml/prompt-engineering');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Prompt Engineering/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0);
  });

  // Regression test: the breadcrumb/prev-next chrome links aren't inside
  // `.prose` (only the markdown body is), so they rely on the base `a`
  // style actually applying `underline`, not just a color change. Scoped to
  // <main> because the persistent sidebar nav (a sibling of <main>, present
  // on every page) has its own "AI & Machine Learning" link with the same
  // accessible name.
  it('renders the section breadcrumb as an underlined link, not color-only', async () => {
    renderAt('/ai-and-ml/prompt-engineering');
    const main = screen.getByRole('main');
    const breadcrumb = await within(main).findByRole('link', {
      name: /AI & Machine Learning/i,
    });
    expect(breadcrumb).not.toHaveClass('no-underline');
  });

  it('opens search on Ctrl+K and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: /search topics/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns keyboard focus to the search button after closing the dialog', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(searchButton).toHaveFocus();
  });

  // Regression test: previously, Tab could leave the open dialog and reach
  // background content (e.g. the theme toggle) that was only visually
  // dimmed by the backdrop, not actually unreachable.
  it('traps Tab navigation inside the open search dialog', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /search/i }));
    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 8; i++) {
      await user.tab();
    }

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the dialog and navigates when a search result is selected', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await user.type(screen.getByPlaceholderText(/search topics/i), 'prompt engineering');
    await user.click(await screen.findByRole('button', { name: /Prompt Engineering/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Prompt Engineering/i }),
    ).toBeInTheDocument();
  });

  // Regression: the sidebar nav is additive on every page (per the spec) —
  // the home page's pre-existing "Sections" grid and "Recently added" list
  // must keep rendering exactly as before.
  it('still renders the home page Sections grid and Recently added list unchanged', () => {
    renderAt('/');
    const sectionsHeading = screen.getByRole('heading', { level: 2, name: 'Sections' });
    const sectionsGrid = sectionsHeading.closest('section');
    expect(sectionsGrid).not.toBeNull();
    for (const { section } of topicsBySection()) {
      expect(
        within(sectionsGrid as HTMLElement).getByRole('link', {
          name: new RegExp(section.label),
        }),
      ).toBeInTheDocument();
    }

    const recentHeading = screen.getByRole('heading', {
      level: 2,
      name: 'Recently added',
    });
    const recentSection = recentHeading.closest('section');
    expect(recentSection).not.toBeNull();
    expect(
      within(recentSection as HTMLElement).getAllByRole('link').length,
    ).toBeGreaterThan(0);
  });

  it('renders the persistent section navigation on every page', () => {
    renderAt('/');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it('opens the mobile nav from the Menu button and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
  });

  it('closes the mobile nav when clicking its backdrop', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    await user.click(screen.getByRole('dialog', { name: /navigation/i }));
    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
  });

  // Regression test: SearchDialog and MobileNav are two independently
  // triggered overlays (Ctrl/Cmd+K and the Menu button) — without explicit
  // mutual exclusion, both could mount at once with two competing
  // Escape/focus-trap listeners.
  it('closes the mobile nav when Search is opened via Ctrl+K while it is open', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation/i })).toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');

    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /search topics/i })).toBeInTheDocument();
  });

  it('closes Search when the mobile nav is opened via the Menu button while it is open', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: /search topics/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /menu/i }));

    expect(
      screen.queryByRole('dialog', { name: /search topics/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /navigation/i })).toBeInTheDocument();
  });

  it('returns keyboard focus to the Menu button after closing the mobile nav', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const menuButton = screen.getByRole('button', { name: /menu/i });
    await user.click(menuButton);
    expect(screen.getByRole('dialog', { name: /navigation/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(menuButton).toHaveFocus();
  });

  it('closes the mobile nav and navigates when a topic link inside it is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: /navigation/i });
    // The home page starts with every section collapsed (section-nav
    // redesign) — expand AI & Machine Learning before its topic link is
    // queryable.
    await user.click(
      within(dialog).getByRole('button', { name: /AI & Machine Learning/i }),
    );
    const topicLink = within(dialog).getByRole('link', { name: /Prompt Engineering/i });
    await user.click(topicLink);

    expect(screen.queryByRole('dialog', { name: /navigation/i })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Prompt Engineering/i }),
    ).toBeInTheDocument();
  });

  it('marks the current topic and section links with aria-current in the sidebar nav', async () => {
    renderAt('/ai-and-ml/prompt-engineering');
    await screen.findByRole('heading', { level: 1, name: /Prompt Engineering/i });
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(
      within(nav).getByRole('link', { name: /Prompt Engineering/i }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'AI & Machine Learning' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('marks only the current section link with aria-current on a section page with no topic selected', () => {
    renderAt('/ai-and-ml');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(
      within(nav).getByRole('link', { name: 'AI & Machine Learning' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'Engineering Practices' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('marks no sidebar nav link with aria-current on the home page', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const currentLinks = within(nav)
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currentLinks).toHaveLength(0);
  });

  // Acceptance criterion 9 (section-nav redesign): the desktop sidebar's
  // scroll wrapper is on-theme and thin rather than the default browser
  // scrollbar. App.tsx applies `scrollbar-thin` directly to the className
  // it passes into SectionNav's own <nav> element (its scroll container).
  it('applies the scrollbar-thin utility to the desktop sidebar’s scroll wrapper', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav).toHaveClass('scrollbar-thin');
  });
});
