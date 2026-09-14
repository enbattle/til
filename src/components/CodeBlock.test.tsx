import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CodeBlock } from './CodeBlock';

function renderBlock(code: string, language?: string) {
  return render(
    <ThemeProvider>
      <CodeBlock code={code} language={language} />
    </ThemeProvider>,
  );
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CodeBlock', () => {
  it('shows "Copied" after a successful copy', async () => {
    const user = userEvent.setup();
    mockClipboard(() => Promise.resolve());
    renderBlock('const x = 1;', 'javascript');

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  // Regression test: an unguarded clipboard write throws an unhandled
  // rejection in an insecure context or when permission is denied.
  it('does not throw when the clipboard write is rejected', async () => {
    const user = userEvent.setup();
    mockClipboard(() => Promise.reject(new Error('denied')));
    renderBlock('const x = 1;', 'javascript');

    await user.click(screen.getByRole('button', { name: 'Copy' }));

    // Failure is silent — the label never changes — rather than crashing.
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });
});
