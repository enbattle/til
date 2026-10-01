import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CodeBlock } from './CodeBlock';

// Highlighting resolves at once unless a test sets `stall`, which leaves every
// later highlight pending, as a slow one would be under load.
const highlighter = vi.hoisted(() => ({ stall: false }));
vi.mock('@/lib/highlighter', () => ({
  highlightCode: (code: string) =>
    highlighter.stall
      ? new Promise<string>(() => {})
      : Promise.resolve(`<pre><code>highlighted ${code}</code></pre>`),
}));

function block(code: string, language?: string) {
  return (
    <ThemeProvider>
      <CodeBlock code={code} language={language} />
    </ThemeProvider>
  );
}

function renderBlock(code: string, language?: string) {
  return render(block(code, language));
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

afterEach(() => {
  highlighter.stall = false;
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

  // Regression test: switching a CodeTabs pair changes `code`, and the old
  // highlighted HTML stayed on screen until the new highlight resolved.
  it('never shows the previous code while the new code is still highlighting', async () => {
    const { container, rerender } = renderBlock('first_py = 1', 'python');
    expect(await screen.findByText('highlighted first_py = 1')).toBeInTheDocument();

    highlighter.stall = true;
    rerender(block('const firstTs = 1;', 'typescript'));
    expect(container.textContent).toContain('const firstTs = 1;');
    expect(container.textContent).not.toContain('first_py = 1');
  });
});
