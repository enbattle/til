import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { topicsBySection } from '@/lib/content';
import { SectionNav } from './SectionNav';

// Renders the current pathname as text so a link click's actual navigation
// effect can be asserted without needing a full <Routes> tree — SectionNav
// itself only reads the location (via useLocation), it doesn't own routing.
function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

// A plain button that drives a real route change via useNavigate, so tests
// can exercise "navigate to a different page after mount" (e.g. following a
// cross-link or a search result) without SectionNav needing to own <Routes>.
function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go to {to}
    </button>
  );
}

function renderNav(initialPath = '/', onNavigate?: () => void) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SectionNav onNavigate={onNavigate} />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

// Accessible names for the disclosure button aren't specified beyond
// "includes the section's label" (plus, per the spec's own example, an
// Expand/Collapse verb) — match on the label only, so the test doesn't
// hardcode wording the implementation is free to choose.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionToggle(label: string) {
  return screen.getByRole('button', { name: new RegExp(escapeRegExp(label), 'i') });
}

describe('SectionNav', () => {
  // --- Acceptance criterion 1 ---
  it('starts with only the current topic’s section expanded; every other section collapsed', () => {
    const groups = topicsBySection();
    const [{ section, topics }] = groups;
    const topic = topics[0];
    renderNav(`/${section.slug}/${topic.slug}`);

    // The current section's own topics are all queryable (expanded).
    for (const t of topics) {
      expect(screen.getByRole('link', { name: t.title })).toBeInTheDocument();
    }

    // Every other section's topics are not queryable (collapsed), though
    // their section label links still are.
    for (const other of groups.slice(1)) {
      expect(screen.getByRole('link', { name: other.section.label })).toBeInTheDocument();
      for (const t of other.topics) {
        expect(screen.queryByRole('link', { name: t.title })).not.toBeInTheDocument();
      }
    }
  });

  // --- Acceptance criterion 2 ---
  it('collapses every section on the home page while section labels remain real links', () => {
    renderNav('/');
    for (const { section, topics } of topicsBySection()) {
      expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
        'href',
        `/${section.slug}`,
      );
      for (const topic of topics) {
        expect(screen.queryByRole('link', { name: topic.title })).not.toBeInTheDocument();
      }
    }
  });

  // --- Acceptance criterion 3 ---
  it('gives each section a disclosure button, distinct from its label link, with aria-expanded reflecting state and the label in its accessible name', () => {
    const [{ section }] = topicsBySection();
    const { container } = renderNav('/');

    const sectionLink = screen.getByRole('link', { name: section.label });
    const toggle = sectionToggle(section.label);

    expect(toggle).not.toBe(sectionLink);
    expect(toggle.tagName).toBe('BUTTON');
    // Home page: nothing expanded yet.
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    const controlsId = toggle.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    const controlledEl = container.querySelector(`[id="${controlsId}"]`);
    expect(controlledEl).not.toBeNull();
    expect(controlledEl?.tagName).toBe('UL');
  });

  // --- Acceptance criterion 4 ---
  it('toggles only the clicked section’s expanded state, without navigating', async () => {
    const user = userEvent.setup();
    const groups = topicsBySection();
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const [{ section: sectionA, topics: topicsA }, { topics: topicsB }] = groups;
    renderNav('/');

    const toggleA = sectionToggle(sectionA.label);
    await user.click(toggleA);

    expect(toggleA).toHaveAttribute('aria-expanded', 'true');
    for (const topic of topicsA) {
      expect(screen.getByRole('link', { name: topic.title })).toBeInTheDocument();
    }
    // The other section stays collapsed.
    for (const topic of topicsB) {
      expect(screen.queryByRole('link', { name: topic.title })).not.toBeInTheDocument();
    }
    // No navigation happened.
    expect(screen.getByTestId('location-display')).toHaveTextContent('/');

    await user.click(toggleA);
    expect(toggleA).toHaveAttribute('aria-expanded', 'false');
    for (const topic of topicsA) {
      expect(screen.queryByRole('link', { name: topic.title })).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('location-display')).toHaveTextContent('/');
  });

  // --- Acceptance criterion 5 ---
  it('still navigates to the section path when its label link is clicked (the link, not the toggle button)', async () => {
    const user = userEvent.setup();
    renderNav('/');
    const [{ section }] = topicsBySection();
    const link = screen.getByRole('link', { name: section.label });
    expect(link.tagName).toBe('A');
    await user.click(link);
    expect(screen.getByTestId('location-display')).toHaveTextContent(`/${section.slug}`);
  });

  // --- Acceptance criterion 6 ---
  it('auto-expands a newly-current section on navigation, without collapsing a section already open', async () => {
    const user = userEvent.setup();
    const groups = topicsBySection();
    expect(groups.length).toBeGreaterThanOrEqual(2);
    const [
      { section: sectionA, topics: topicsA },
      { section: sectionB, topics: topicsB },
    ] = groups;

    render(
      <MemoryRouter initialEntries={[`/${sectionA.slug}/${topicsA[0].slug}`]}>
        <SectionNav />
        <NavigateButton to={`/${sectionB.slug}/${topicsB[0].slug}`} />
      </MemoryRouter>,
    );

    // Initial state: section A (current) expanded, section B collapsed.
    expect(screen.getByRole('link', { name: topicsA[0].title })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: topicsB[0].title }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: `go to /${sectionB.slug}/${topicsB[0].slug}` }),
    );

    // After navigating to a topic in section B: B is now expanded, and A
    // (already open) was not collapsed as a side effect.
    expect(screen.getByRole('link', { name: topicsB[0].title })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: topicsA[0].title })).toBeInTheDocument();
  });

  // --- Acceptance criterion 7 ---
  it('lets the user manually collapse the section containing the current page', async () => {
    const user = userEvent.setup();
    const [{ section, topics }] = topicsBySection();
    const topic = topics[0];
    renderNav(`/${section.slug}/${topic.slug}`);

    const toggle = sectionToggle(section.label);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: topic.title })).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: topic.title })).not.toBeInTheDocument();
  });

  // --- Acceptance criterion 8 ---
  it('uses no truncation classes anywhere in the nav (long titles are meant to wrap, not truncate)', () => {
    // The topic <ul> stays in the DOM even when its section is collapsed
    // (toggled via the `hidden` attribute, not conditional rendering), so
    // this check doesn't need to expand anything first.
    const { container } = renderNav('/');
    const html = container.innerHTML;
    expect(html).not.toMatch(/\btruncate\b/);
    expect(html).not.toMatch(/line-clamp/);
    expect(html).not.toMatch(/text-ellipsis/);
    expect(html).not.toMatch(/text-overflow/);
  });

  it('navigates to the topic path when a topic link is clicked', async () => {
    const user = userEvent.setup();
    const [{ section, topics }] = topicsBySection();
    renderNav('/');
    await user.click(sectionToggle(section.label));
    const topic = topics[0];
    await user.click(screen.getByRole('link', { name: topic.title }));
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/${section.slug}/${topic.slug}`,
    );
  });

  it('calls onNavigate after a link is clicked, for callers that need to react (e.g. closing an overlay)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const [{ section, topics }] = topicsBySection();
    renderNav('/', onNavigate);
    await user.click(sectionToggle(section.label));
    await user.click(screen.getByRole('link', { name: topics[0].title }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not require onNavigate — the persistent desktop copy omits it', async () => {
    const user = userEvent.setup();
    const [{ section, topics }] = topicsBySection();
    renderNav('/');
    await user.click(sectionToggle(section.label));
    // Should not throw when clicked without an onNavigate prop supplied.
    await expect(
      user.click(screen.getByRole('link', { name: topics[0].title })),
    ).resolves.not.toThrow();
  });

  // --- Acceptance criterion 10 (pre-existing behavior) ---
  it('marks the current topic link and its parent section link with aria-current, and no others', async () => {
    const [{ section, topics }] = topicsBySection();
    const topic = topics[0];
    renderNav(`/${section.slug}/${topic.slug}`);

    const topicLink = screen.getByRole('link', { name: topic.title });
    const sectionLink = screen.getByRole('link', { name: section.label });
    expect(topicLink).toHaveAttribute('aria-current', 'page');
    expect(sectionLink).toHaveAttribute('aria-current', 'page');

    // Non-color-only signal per docs/DESIGN.md: bold weight + accent border,
    // not just a color change.
    expect(topicLink).toHaveClass('font-bold');
    expect(topicLink).toHaveClass('border-accent');

    const others = screen
      .getAllByRole('link')
      .filter((link) => link !== topicLink && link !== sectionLink);
    for (const link of others) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('marks only the section link with aria-current on a section page with no topic selected', () => {
    const [{ section, topics }] = topicsBySection();
    renderNav(`/${section.slug}`);

    expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const topic of topics) {
      expect(screen.getByRole('link', { name: topic.title })).not.toHaveAttribute(
        'aria-current',
      );
    }
  });

  it('marks no link with aria-current on the home page', () => {
    renderNav('/');
    const currentLinks = screen
      .getAllByRole('link')
      .filter((link) => link.hasAttribute('aria-current'));
    expect(currentLinks).toHaveLength(0);
  });

  it('renders as a labeled navigation landmark', () => {
    renderNav('/');
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });
});
