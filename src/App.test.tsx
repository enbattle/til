import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App routing', () => {
  it('renders the home page at /', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { level: 1, name: 'til' })).toBeInTheDocument();
  });

  it('renders a section page for a known section', () => {
    renderAt('/tools-and-workflow');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tools & Workflow' }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown top-level path to the not-found page', () => {
    renderAt('/this-does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });

  it('redirects an unknown topic slug under a real section to not-found', async () => {
    renderAt('/tools-and-workflow/nonexistent-topic');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('renders a real topic end-to-end through the lazy-loaded TopicPage, code block included', async () => {
    renderAt('/tools-and-workflow/git-worktrees');
    expect(
      await screen.findByRole('heading', { level: 1, name: /Git Worktrees/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0);
  });

  // Regression test: the breadcrumb/prev-next chrome links aren't inside
  // `.prose` (only the markdown body is), so they rely on the base `a`
  // style actually applying `underline`, not just a color change.
  it('renders the section breadcrumb as an underlined link, not color-only', async () => {
    renderAt('/tools-and-workflow/git-worktrees');
    const breadcrumb = await screen.findByRole('link', { name: /Tools & Workflow/i });
    expect(breadcrumb).not.toHaveClass('no-underline');
  });

  it('opens search on Ctrl+K and closes it on Escape', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.getByRole('dialog', { name: /search topics/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns keyboard focus to the search button after closing the dialog', async () => {
    const user = userEvent.setup();
    renderAt('/');
    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(searchButton).toHaveFocus();
  });

  // Regression test: previously, Tab could leave the open dialog and reach
  // background content (e.g. the theme toggle) that was only visually
  // dimmed by the backdrop, not actually unreachable.
  it('traps Tab navigation inside the open search dialog', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /search/i }));
    const dialog = screen.getByRole('dialog');

    for (let i = 0; i < 8; i++) {
      await user.tab();
    }

    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the dialog and navigates when a search result is selected', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('button', { name: /search/i }));
    await user.type(screen.getByPlaceholderText(/search topics/i), 'worktrees');
    await user.click(await screen.findByRole('button', { name: /Git Worktrees/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Git Worktrees/i }),
    ).toBeInTheDocument();
  });
});
