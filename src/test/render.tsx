// Test support, never hot-reloaded, so fast-refresh export rules do not apply.
// oxlint-disable react/only-export-components
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SearchDialog } from '@/components/SearchDialog';
import App from '@/App';

// Shared rendering helpers for the component and app tests
// (docs/specs/dedupe-app-scripts-tests.md, criterion 8). Each used to be
// copied into every test file that needed it.

/** Renders the current pathname as text, so a test can assert where a click
 * actually navigated without a full <Routes> tree. */
export function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

/**
 * Renders `ui` (the whole app by default) inside a `MemoryRouter` that starts
 * at `path`, followed by a `LocationDisplay` probe. A component is wrapped in
 * the providers `App` normally supplies (theme, code language); the app
 * brings its own, so it isn't wrapped twice.
 */
export function renderAt(path: string, ui?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui === undefined ? (
        <App />
      ) : (
        <ThemeProvider>
          <CodeLanguageProvider>{ui}</CodeLanguageProvider>
        </ThemeProvider>
      )}
      <LocationDisplay />
    </MemoryRouter>,
  );
}

/** Opens the search dialog at `path` (with the location probe) and returns its
 * `onClose` spy. */
export function renderDialog(path = '/') {
  const onClose = vi.fn();
  renderAt(path, <SearchDialog onClose={onClose} />);
  return onClose;
}

/** `value` with every regular-expression metacharacter escaped, for building a
 * `RegExp` that matches it literally (a title with `(` or `+` in it). */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
