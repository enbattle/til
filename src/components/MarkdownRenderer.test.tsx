import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

function renderMarkdown(content: string) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MarkdownRenderer content={content} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('MarkdownRenderer', () => {
  // Regression test: a site-root-relative link (how topics link to each
  // other) must go through react-router's `Link`, not a plain `<a>` — a
  // plain `<a>` ignores the GitHub Pages `/til/` basename and forces a full
  // page reload. See the `a` override in MarkdownRenderer.tsx.
  it('routes an internal link through react-router instead of a plain <a>', () => {
    renderMarkdown('See [prompt engineering](/ai-and-ml/prompt-engineering).');
    const link = screen.getByRole('link', { name: 'prompt engineering' });
    expect(link).toHaveAttribute('href', '/ai-and-ml/prompt-engineering');
    // The external-link branch always sets target="_blank"; its absence
    // here confirms this went through the internal-link branch instead.
    expect(link).not.toHaveAttribute('target');
  });

  it('opens an external link in a new tab', () => {
    renderMarkdown('See [Shiki](https://shiki.style).');
    const link = screen.getByRole('link', { name: 'Shiki' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders inline code distinctly from a fenced code block', () => {
    renderMarkdown('Use `git status` to check.');
    expect(screen.getByText('git status').tagName).toBe('CODE');
  });

  // Regression test: fence tags in topic bodies use shorthand (```sh, ```js,
  // ```ts) that must resolve through the highlighter's alias table — this
  // renders the actual CodeBlock (not a mock) so a broken alias would make
  // this hang or throw instead of ever showing the copy button.
  it('renders a fenced code block through CodeBlock with a copy button', () => {
    renderMarkdown(['```sh', 'git worktree list', '```'].join('\n'));
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  // Regression test: TopicPage renders its own page-level <h1> (the topic
  // title). A body that opens with a markdown `# heading` must not produce
  // a second one — see the `h1` override in MarkdownRenderer.tsx.
  it('demotes a body-level h1 to h2 so a topic page never ends up with two h1s', () => {
    renderMarkdown('# Should not be a page h1\n\nBody text.');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Should not be a page h1' }),
    ).toBeInTheDocument();
  });
});
