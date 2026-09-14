import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): never {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  // React logs caught render errors to console.error itself; silencing it
  // keeps the test output focused on actual assertion failures.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing below it throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('renders a fallback instead of the broken tree when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
  });

  it("reloads the page when the fallback's Reload button is clicked", async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole('button', { name: /reload/i }));

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
