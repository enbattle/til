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

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const next = NEXT[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
      title={`Theme: ${LABEL[preference]}. Click for ${LABEL[next]}.`}
      aria-label={`Theme: ${LABEL[preference]}. Click for ${LABEL[next]}.`}
    >
      {LABEL[preference]}
    </button>
  );
}
