import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('ThemeToggle', () => {
  it('starts on System and cycles Light -> Dark -> System on click, applying the .dark class', async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent('System');

    await user.click(button);
    expect(button).toHaveTextContent('Light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(button);
    expect(button).toHaveTextContent('Dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(button);
    expect(button).toHaveTextContent('System');
  });

  it('shows a hover tooltip naming the current theme and what the next click switches to', () => {
    renderToggle();
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Theme: System. Click for Light.');
  });

  it('persists the preference across a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderToggle();
    await user.click(screen.getByRole('button')); // System -> Light
    unmount();

    renderToggle();
    expect(screen.getByRole('button')).toHaveTextContent('Light');
  });
});
