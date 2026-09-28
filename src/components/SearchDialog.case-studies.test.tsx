import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getCaseStudy } from '@/lib/system-design';
import { SearchDialog } from './SearchDialog';

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Enter the query with one paste rather than `user.type`: typing a long title
// fires a search per keystroke, which is slow in jsdom under full-suite load.
async function enterQuery(user: ReturnType<typeof userEvent.setup>, query: string) {
  await user.click(screen.getByPlaceholderText(/search topics/i));
  await user.paste(query);
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

describe('SearchDialog with case studies (criterion 11)', () => {
  it('shows the URL shortener by title as a result labelled System Design with its summary', async () => {
    const user = userEvent.setup();
    const caseStudy = getCaseStudy('url-shortener')!;
    renderDialog();
    await enterQuery(user, caseStudy.title);
    const result = await screen.findByRole('button', {
      name: new RegExp(escapeRegExp(caseStudy.title)),
    });
    expect(within(result).getByText(caseStudy.title)).toBeInTheDocument();
    expect(result).toHaveTextContent('System Design');
    expect(result).toHaveTextContent(caseStudy.summary);
  });

  it('navigates to /system-design/url-shortener and closes when the result is chosen', async () => {
    const user = userEvent.setup();
    const caseStudy = getCaseStudy('url-shortener')!;
    const onClose = renderDialog();
    await enterQuery(user, caseStudy.title);
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(escapeRegExp(caseStudy.title)),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/system-design/url-shortener',
    );
  });

  it('still navigates a topic result to its catalog page, labelled with its section', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await enterQuery(user, 'prompt engineering');
    const result = await screen.findByRole('button', { name: /Prompt Engineering/i });
    expect(result).toHaveTextContent('AI & Machine Learning');
    expect(result).not.toHaveTextContent('System Design');
    await user.click(result);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/ai-and-ml/prompt-engineering',
    );
  });
});
