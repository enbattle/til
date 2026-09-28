import type { ReactNode } from 'react';
import type { ThemePreference } from '@/contexts/ThemeContext';
import { useTheme } from '@/contexts/useTheme';

const NEXT: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const LABEL: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

// One same-size outline icon per state (24px grid, drawn at 16px), so the
// button is the same width whichever theme is stored and the header wraps to
// the same number of rows. Each shape differs, so the state isn't color-only.
const ICON: Record<ThemePreference, ReactNode> = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  dark: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  system: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
};

/** Icon-only: the state and the next action are in the accessible name and
 * the tooltip, since the visible content is the same shape in every state. */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const next = NEXT[preference];
  const label = `Theme: ${LABEL[preference]}. Click for ${LABEL[next]}.`;

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className="rounded-md border border-border p-2 text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
      title={label}
      aria-label={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICON[preference]}
      </svg>
    </button>
  );
}
