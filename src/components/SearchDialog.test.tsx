import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SearchDialog } from './SearchDialog';

function renderDialog() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SearchDialog onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('SearchDialog', () => {
  it('shows matching results as the query is typed', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), 'prompt engineering');
    // Role-scoped, not a plain text match — "Prompt Engineering" is also a
    // substring of several text-containing ancestors (the <li>, the <ul>,
    // the dialog panel), which makes a plain findByText ambiguous.
    expect(
      await screen.findByRole('button', { name: /Prompt Engineering/i }),
    ).toBeInTheDocument();
  });

  it('shows a no-results message for a query that matches nothing', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), 'zzzzznotarealword');
    expect(
      await screen.findByText(/no topics match/i, { selector: 'li' }),
    ).toBeInTheDocument();
  });

  it('shows a discoverable hint for closing with Escape', () => {
    renderDialog();
    expect(screen.getByText('Esc')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when clicking the backdrop', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog panel', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    expect(onClose).not.toHaveBeenCalled();
  });
});
