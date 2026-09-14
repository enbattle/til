import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from './Header';

function renderHeader(onOpenSearch = vi.fn()) {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <Header onOpenSearch={onOpenSearch} />
      </ThemeProvider>
    </MemoryRouter>,
  );
  return onOpenSearch;
}

describe('Header', () => {
  it('shows the search shortcut hint directly, not only on hover', () => {
    renderHeader();
    // Visible text, not an aria-only label — discoverable without hovering.
    expect(screen.getByText('Ctrl/⌘ K')).toBeVisible();
  });

  it('opens search when the search button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenSearch = renderHeader();
    await user.click(screen.getByRole('button', { name: /search/i }));
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
