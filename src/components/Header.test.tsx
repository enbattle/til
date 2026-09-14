import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from './Header';

function renderHeader(onOpenSearch = vi.fn(), onOpenNav = vi.fn()) {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Header onOpenSearch={onOpenSearch} onOpenNav={onOpenNav} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return { onOpenSearch, onOpenNav };
}

describe('Header', () => {
  it('shows the search shortcut hint directly, not only on hover', () => {
    renderHeader();
    // Visible text, not an aria-only label — discoverable without hovering.
    expect(screen.getByText('Ctrl/⌘ K')).toBeVisible();
  });

  it('opens search when the search button is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenSearch } = renderHeader();
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });

  it('shows a labeled Menu button, not icon-only, for opening the nav', () => {
    renderHeader();
    // Visible text label, per this repo's "controls aren't icon-only" rule.
    expect(screen.getByText('Menu')).toBeVisible();
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });

  it('opens the nav when the Menu button is clicked', async () => {
    const user = userEvent.setup();
    const { onOpenNav } = renderHeader();
    await user.click(screen.getByRole('button', { name: /menu/i }));
    expect(onOpenNav).toHaveBeenCalledTimes(1);
  });

  it('places the Menu button before the til logo link', () => {
    renderHeader();
    const menuButton = screen.getByRole('button', { name: /menu/i });
    const logoLink = screen.getByRole('link', { name: 'til' });
    // DOM order determines both visual order and tab order here — no
    // explicit ordering styles are expected, so source order is the check.
    expect(
      menuButton.compareDocumentPosition(logoLink) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
