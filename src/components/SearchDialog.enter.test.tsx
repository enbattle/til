import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ensureFullTextSearch, searchContent, type SearchResult } from '@/lib/search';
import { SearchDialog } from './SearchDialog';

// Retro: Enter in the search box opens the first result, the way a search
// box is expected to work, instead of making the reader Tab down to it. The
// dialog has no arrow-key highlighting, so "first" is the top of the list.

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function renderDialog() {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/']}>
      <SearchDialog onClose={onClose} />
      <LocationDisplay />
    </MemoryRouter>,
  );
  return onClose;
}

function pathOf(result: SearchResult) {
  return result.kind === 'topic'
    ? `/${result.topic.section}/${result.topic.slug}`
    : `/system-design/${result.caseStudy.slug}`;
}

// Load the bodies first, so the result order can't change between reading
// the expected first result and pressing Enter.
beforeAll(async () => {
  await ensureFullTextSearch();
});

describe('SearchDialog Enter', () => {
  it('navigates to the first result and closes when Enter is pressed in the input', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    const query = 'prompt engineering';
    const [first] = searchContent(query);
    expect(first).toBeDefined();

    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(query);
    await screen.findAllByRole('button', { name: /Prompt Engineering/i });
    await user.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(pathOf(first));
  });

  it('opens the first result for a case-study query too', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    const query = 'URL shortener';
    const [first] = searchContent(query);
    expect(first).toBeDefined();

    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(query);
    await screen.findAllByRole('listitem');
    await user.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(pathOf(first));
  });

  it('does nothing, without throwing, when Enter is pressed with no results', async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onClose = renderDialog();

    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste('zzzzznotarealword');
    await screen.findByText(/no topics match/i, { selector: 'li' });
    await user.keyboard('{Enter}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('does nothing when Enter is pressed in an empty input', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();

    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.keyboard('{Enter}');

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
  });

  // An IME (Japanese, Chinese, Korean input) uses Enter to commit the text
  // being composed. That Enter belongs to the input method, not a request to
  // open a result: browsers flag it with `isComposing`, and some (older
  // Safari, some Windows IMEs) only with keyCode 229.
  it.each([
    ['isComposing is set', { isComposing: true }],
    ['keyCode is 229', { keyCode: 229 }],
  ])(
    'does not navigate or close on Enter during an IME composition (%s)',
    async (_label, init) => {
      const user = userEvent.setup();
      const onClose = renderDialog();
      const query = 'prompt engineering';
      expect(searchContent(query).length).toBeGreaterThan(0);

      const input = screen.getByPlaceholderText(/search topics/i);
      await user.click(input);
      await user.paste(query);
      await screen.findAllByRole('button', { name: /Prompt Engineering/i });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', ...init });

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('location-display')).toHaveTextContent(/^\/$/);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
  );

  it('still opens the first result on a plain Enter keydown dispatched the same way', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    const query = 'prompt engineering';
    const [first] = searchContent(query);

    const input = screen.getByPlaceholderText(/search topics/i);
    await user.click(input);
    await user.paste(query);
    await screen.findAllByRole('button', { name: /Prompt Engineering/i });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(pathOf(first));
  });
});
