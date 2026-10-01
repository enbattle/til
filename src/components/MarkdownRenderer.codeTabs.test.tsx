import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

// docs/specs/dsa-tab.md, criterion 9: with the opt-in `codeTabs` prop, each
// ```python fence immediately followed by a ```typescript fence renders as one
// tabbed block (WAI-ARIA tabs over one CodeBlock). The chosen language is
// shared across the page through CodeLanguageProvider and remembered in
// localStorage under `til-code-language`.

const STORAGE_KEY = 'til-code-language';

const PY_1 = 'def first_marker(nums):';
const TS_1 = 'function firstMarker(nums: number[]) {';
const PY_2 = 'second_py_marker = 2';
const TS_2 = 'const secondTsMarker = 2;';

function pair(py: string, ts: string): string {
  return ['```python', py, '```', '', '```typescript', ts, '```'].join('\n');
}

const TWO_PAIRS = [
  'Intro.',
  '',
  pair(PY_1, TS_1),
  '',
  'Why the first chunk works.',
  '',
  pair(PY_2, TS_2),
  '',
  'Why the second chunk works.',
].join('\n');

function page(content: string, codeTabs: boolean) {
  return (
    <MemoryRouter>
      <ThemeProvider>
        <CodeLanguageProvider>
          {codeTabs ? (
            <MarkdownRenderer content={content} codeTabs />
          ) : (
            <MarkdownRenderer content={content} />
          )}
        </CodeLanguageProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

function renderMarkdown(content: string, codeTabs = true) {
  return render(page(content, codeTabs));
}

/** The text of the whole rendered page (a hidden panel's text would count). */
function pageText(container: HTMLElement): string {
  return container.textContent ?? '';
}

function copyButtons() {
  return screen.getAllByRole('button', { name: /copy/i });
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('code tabs with codeTabs on (criterion 9)', () => {
  it('renders a pair as one tablist with Python and TypeScript tabs over one code block', () => {
    renderMarkdown(pair(PY_1, TS_1));
    const tablists = screen.getAllByRole('tablist');
    expect(tablists).toHaveLength(1);
    const tabs = within(tablists[0]).getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(['Python', 'TypeScript']);
    expect(copyButtons()).toHaveLength(1);
  });

  it('selects Python by default and shows only the Python code', () => {
    const { container } = renderMarkdown(pair(PY_1, TS_1));
    const python = screen.getByRole('tab', { name: 'Python' });
    const typescript = screen.getByRole('tab', { name: 'TypeScript' });
    expect(python).toHaveAttribute('aria-selected', 'true');
    expect(typescript).toHaveAttribute('aria-selected', 'false');
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).not.toContain(TS_1);
  });

  it('follows the WAI-ARIA tabs pattern: a roving tabindex and a labelled tabpanel', () => {
    renderMarkdown(pair(PY_1, TS_1));
    const python = screen.getByRole('tab', { name: 'Python' });
    const typescript = screen.getByRole('tab', { name: 'TypeScript' });
    expect(python).toHaveAttribute('tabindex', '0');
    expect(typescript).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel');
    expect(python.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', python.id);
    expect(panel).toHaveTextContent(PY_1);
  });

  it('switches every pair on the page to TypeScript on a click, and stores it', async () => {
    const user = userEvent.setup();
    const { container } = renderMarkdown(TWO_PAIRS);
    expect(screen.getAllByRole('tablist')).toHaveLength(2);
    await user.click(screen.getAllByRole('tab', { name: 'TypeScript' })[0]);
    for (const tab of screen.getAllByRole('tab', { name: 'TypeScript' })) {
      expect(tab).toHaveAttribute('aria-selected', 'true');
    }
    const text = pageText(container);
    expect(text).toContain(TS_1);
    expect(text).toContain(TS_2);
    expect(text).not.toContain(PY_1);
    expect(text).not.toContain(PY_2);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('typescript');
  });

  it('moves with the arrow keys and activates with Enter', async () => {
    const user = userEvent.setup();
    const { container } = renderMarkdown(TWO_PAIRS);
    const [python] = screen.getAllByRole('tab', { name: 'Python' });
    python.focus();
    await user.keyboard('{ArrowRight}');
    const [typescript] = screen.getAllByRole('tab', { name: 'TypeScript' });
    expect(typescript).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(typescript).toHaveAttribute('aria-selected', 'true');
    expect(pageText(container)).toContain(TS_2);
    expect(pageText(container)).not.toContain(PY_2);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('typescript');

    await user.keyboard('{ArrowLeft}');
    expect(screen.getAllByRole('tab', { name: 'Python' })[0]).toHaveFocus();
  });

  it('switches back to Python and stores that too', async () => {
    const user = userEvent.setup();
    const { container } = renderMarkdown(TWO_PAIRS);
    await user.click(screen.getAllByRole('tab', { name: 'TypeScript' })[1]);
    await user.click(screen.getAllByRole('tab', { name: 'Python' })[0]);
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).not.toContain(TS_2);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('python');
  });

  it('reads a stored TypeScript choice back on a fresh render', async () => {
    const user = userEvent.setup();
    const first = renderMarkdown(TWO_PAIRS);
    await user.click(screen.getAllByRole('tab', { name: 'TypeScript' })[0]);
    first.unmount();

    const { container } = renderMarkdown(TWO_PAIRS);
    for (const tab of screen.getAllByRole('tab', { name: 'TypeScript' })) {
      expect(tab).toHaveAttribute('aria-selected', 'true');
    }
    expect(pageText(container)).toContain(TS_1);
    expect(pageText(container)).not.toContain(PY_1);
  });

  it('starts on TypeScript when localStorage already holds it', () => {
    localStorage.setItem(STORAGE_KEY, 'typescript');
    const { container } = renderMarkdown(pair(PY_1, TS_1));
    expect(pageText(container)).toContain(TS_1);
  });

  it('falls back to Python for an unrecognised stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'rust');
    const { container } = renderMarkdown(pair(PY_1, TS_1));
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).not.toContain(TS_1);
  });

  it('still renders, in Python, and still switches, when localStorage throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const user = userEvent.setup();
    const { container } = renderMarkdown(pair(PY_1, TS_1));
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).not.toContain(TS_1);
    await user.click(screen.getByRole('tab', { name: 'TypeScript' }));
    expect(pageText(container)).toContain(TS_1);
  });

  it('renders a lone python fence as a plain code block', () => {
    const { container } = renderMarkdown(['```python', PY_1, '```'].join('\n'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(1);
    expect(pageText(container)).toContain(PY_1);
  });

  it('renders a lone typescript fence as a plain code block', () => {
    renderMarkdown(['```typescript', TS_1, '```'].join('\n'));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(1);
  });

  it('renders a typescript-then-python pair as two plain code blocks', () => {
    const md = ['```typescript', TS_1, '```', '', '```python', PY_1, '```'].join('\n');
    const { container } = renderMarkdown(md);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(2);
    expect(pageText(container)).toContain(TS_1);
    expect(pageText(container)).toContain(PY_1);
  });

  it('does not pair fences with a paragraph between them', () => {
    const md = [
      '```python',
      PY_1,
      '```',
      '',
      'Between.',
      '',
      '```typescript',
      TS_1,
      '```',
    ].join('\n');
    const { container } = renderMarkdown(md);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(2);
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).toContain(TS_1);
  });

  it('leaves fences in other languages alone', () => {
    renderMarkdown(['```sh', 'git status', '```', '', pair(PY_1, TS_1)].join('\n'));
    expect(screen.getAllByRole('tablist')).toHaveLength(1);
    expect(copyButtons()).toHaveLength(2);
  });
});

describe('code pairs without codeTabs (criterion 9)', () => {
  it('renders a pair as two plain code blocks, as before', () => {
    const { container } = renderMarkdown(pair(PY_1, TS_1), false);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(copyButtons()).toHaveLength(2);
    expect(pageText(container)).toContain(PY_1);
    expect(pageText(container)).toContain(TS_1);
  });

  it('renders the same markup as a renderer with no language provider', () => {
    const withProvider = renderMarkdown(TWO_PAIRS, false).container.innerHTML;
    const plain = render(
      <MemoryRouter>
        <ThemeProvider>
          <MarkdownRenderer content={TWO_PAIRS} />
        </ThemeProvider>
      </MemoryRouter>,
    ).container.innerHTML;
    expect(withProvider).toBe(plain);
  });
});
