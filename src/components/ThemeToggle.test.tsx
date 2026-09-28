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
    // The state is read from the accessible name, not the visible text: the
    // visible content is the same in every state (see the last test).
    expect(button).toHaveAccessibleName(/^Theme: System\b/);

    await user.click(button);
    expect(button).toHaveAccessibleName(/^Theme: Light\b/);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await user.click(button);
    expect(button).toHaveAccessibleName(/^Theme: Dark\b/);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await user.click(button);
    expect(button).toHaveAccessibleName(/^Theme: System\b/);
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
    expect(screen.getByRole('button')).toHaveAccessibleName(/^Theme: Light\b/);
  });

  // Retro: at 375px the header wrapped to three rows with no stored theme and
  // two otherwise, because the toggle's visible label was "System" (six
  // letters) in the default state and "Light"/"Dark" after a choice, and the
  // wider button pushed the Search/theme group onto its own row. The toggle's
  // width must not depend on the state, so its visible content (the text a
  // sighted reader sees, which sets its width) is identical in all three
  // states. An icon-only button whose aria-label names the state, with a
  // same-size icon per state, satisfies this; the state stays in the
  // accessible name and the tooltip.
  it('renders the same visible text in every state, so its width never changes', async () => {
    const user = userEvent.setup();
    renderToggle();
    const button = screen.getByRole('button');
    const seen: Array<{ name: string; text: string }> = [];
    for (let i = 0; i < 3; i++) {
      seen.push({
        name: button.getAttribute('aria-label') ?? '',
        text: (button.textContent ?? '').trim(),
      });
      await user.click(button);
    }
    expect(seen.map((state) => state.name)).toEqual([
      'Theme: System. Click for Light.',
      'Theme: Light. Click for Dark.',
      'Theme: Dark. Click for System.',
    ]);
    expect(new Set(seen.map((state) => state.text)).size).toBe(1);
  });
});
