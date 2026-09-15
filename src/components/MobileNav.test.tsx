import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { topicsBySection } from '@/lib/content';
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

// Accessible name for the disclosure button isn't specified beyond
// "includes the section's label" — match on the label only.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('MobileNav', () => {
  it('renders as a labeled modal dialog', () => {
    renderMobileNav();
    const dialog = screen.getByRole('dialog', { name: /navigation/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('renders the section nav inside the dialog, using real registry/content data', () => {
    renderMobileNav();
    const [{ section }] = topicsBySection();
    const dialog = screen.getByRole('dialog', { name: /navigation/i });
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(dialog).toContainElement(screen.getByRole('link', { name: section.label }));
  });

  // Acceptance criterion 2 (via the mobile overlay): the home page starts
  // fully collapsed, so a section's topics aren't queryable until its
  // disclosure button is expanded.
  it('reveals a section’s topics inside the dialog once its disclosure button is expanded', async () => {
    const user = userEvent.setup();
    renderMobileNav();
    const [{ section, topics }] = topicsBySection();
    const dialog = screen.getByRole('dialog', { name: /navigation/i });

    expect(screen.queryByRole('link', { name: topics[0].title })).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('button', {
        name: new RegExp(escapeRegExp(section.label), 'i'),
      }),
    );

    expect(dialog).toContainElement(screen.getByRole('link', { name: topics[0].title }));
  });

  it('traps Tab navigation inside the open nav', async () => {
    const user = userEvent.setup();
    renderMobileNav();
    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 8; i++) {
      await user.tab();
    }

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the backdrop', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav();
    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the panel but not on a link', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav();
    await user.click(screen.getByRole('navigation', { name: 'Sections' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when a section link inside the nav is clicked (via onNavigate)', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav();
    const [{ section }] = topicsBySection();
    await user.click(screen.getByRole('link', { name: section.label }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when a topic link inside the nav is clicked (via onNavigate)', async () => {
    const user = userEvent.setup();
    const onClose = renderMobileNav();
    const [{ section, topics }] = topicsBySection();
    const dialog = screen.getByRole('dialog', { name: /navigation/i });
    await user.click(
      within(dialog).getByRole('button', {
        name: new RegExp(escapeRegExp(section.label), 'i'),
      }),
    );
    await user.click(screen.getByRole('link', { name: topics[0].title }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // --- Acceptance criterion 9 (mobile overlay panel) ---
  it('applies the scrollbar-thin utility to the overlay panel', () => {
    renderMobileNav();
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    expect(nav.parentElement).toHaveClass('scrollbar-thin');
  });
});
