import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QUESTIONS } from '@/lib/system-design';
import { SearchDialog } from './SearchDialog';

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renderDialog() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SearchDialog onClose={onClose} />
      <LocationDisplay />
    </MemoryRouter>,
  );
  return onClose;
}

describe('SearchDialog with questions', () => {
  // --- Criterion 23 ---
  it('shows a matching question as a result labelled System Design with its summary', async () => {
    const user = userEvent.setup();
    const [question] = QUESTIONS;
    renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), question.title);
    const result = await screen.findByRole('button', {
      name: new RegExp(escapeRegExp(question.title)),
    });
    expect(within(result).getByText(question.title)).toBeInTheDocument();
    expect(result).toHaveTextContent('System Design');
    expect(result).toHaveTextContent(question.summary);
  });

  it('navigates to /system-design/<slug> and closes when a question result is chosen', async () => {
    const user = userEvent.setup();
    const question = QUESTIONS[1];
    const onClose = renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), question.title);
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(escapeRegExp(question.title)),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/system-design/${question.slug}`,
    );
  });

  it('still navigates a topic result to its catalog page, labelled with its section', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), 'prompt engineering');
    const result = await screen.findByRole('button', { name: /Prompt Engineering/i });
    expect(result).toHaveTextContent('AI & Machine Learning');
    expect(result).not.toHaveTextContent('System Design');
    await user.click(result);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/ai-and-ml/prompt-engineering',
    );
  });

  it('keeps its dialog label and placeholder', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Search topics' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
  });
});
