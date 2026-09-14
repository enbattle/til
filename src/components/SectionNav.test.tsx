import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

function renderNav(initialPath = '/', onNavigate?: () => void) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SectionNav onNavigate={onNavigate} />
      <LocationDisplay />
    </MemoryRouter>,
  );
}

describe('SectionNav', () => {
  it('renders every section and topic from the real registry/content data', () => {
    renderNav('/');
    for (const { section, topics } of topicsBySection()) {
      expect(screen.getByRole('link', { name: section.label })).toHaveAttribute(
        'href',
        `/${section.slug}`,
      );
      for (const topic of topics) {
        expect(screen.getByRole('link', { name: topic.title })).toHaveAttribute(
          'href',
          `/${section.slug}/${topic.slug}`,
        );
      }
    }
  });

  it('navigates to the section path when a section link is clicked', async () => {
    const user = userEvent.setup();
    renderNav('/');
    const [{ section }] = topicsBySection();
    await user.click(screen.getByRole('link', { name: section.label }));
    expect(screen.getByTestId('location-display')).toHaveTextContent(`/${section.slug}`);
  });

  it('navigates to the topic path when a topic link is clicked', async () => {
    const user = userEvent.setup();
    renderNav('/');
    const [{ section, topics }] = topicsBySection();
    const topic = topics[0];
    await user.click(screen.getByRole('link', { name: topic.title }));
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/${section.slug}/${topic.slug}`,
    );
  });

  it('calls onNavigate after a link is clicked, for callers that need to react (e.g. closing an overlay)', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderNav('/', onNavigate);
    const [{ topics }] = topicsBySection();
    await user.click(screen.getByRole('link', { name: topics[0].title }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('does not require onNavigate — the persistent desktop copy omits it', async () => {
    const user = userEvent.setup();
    renderNav('/');
    const [{ topics }] = topicsBySection();
    // Should not throw when clicked without an onNavigate prop supplied.
    await expect(
      user.click(screen.getByRole('link', { name: topics[0].title })),
    ).resolves.not.toThrow();
  });

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
