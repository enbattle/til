import { useCallback, useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ensureFullTextSearch } from '@/lib/search';
import { renderAt } from '@/test/render';
import { MobileNav } from './MobileNav';
import { SearchDialog } from './SearchDialog';

// docs/specs/ui-dedupe.md, criterion 4: the mobile nav and search follow the
// WAI-ARIA APG modal dialog pattern, through the rendered components. On open,
// focus moves inside (the search input for search, the first focusable element
// for the mobile nav); Tab from the last focusable element wraps to the first
// and Shift+Tab from the first wraps to the last; Escape closes; on close,
// focus returns to the element that opened it. These pin the behaviour while
// both move onto one shared hook.
//
// jsdom does no layout: the mobile nav's Tab-wrap cases use the System Design
// nav, whose links are all shown, since the catalog's collapsed
// section lists are hidden in a way only a real browser's layout reflects.

type Kind = 'nav' | 'search';

/** A real opener: a button that mounts the modal, which unmounts on close, as
 * App does. */
function Opener({ kind }: { kind: Kind }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open the modal
      </button>
      {open &&
        (kind === 'nav' ? (
          <MobileNav onClose={close} />
        ) : (
          <SearchDialog onClose={close} />
        ))}
    </>
  );
}

const DIALOG_NAMES: Record<Kind, string> = {
  nav: 'Navigation',
  search: 'Search topics',
};

async function openModal(kind: Kind, path = '/') {
  const user = userEvent.setup();
  renderAt(path, <Opener kind={kind} />);
  const opener = screen.getByRole('button', { name: 'Open the modal' });
  await user.click(opener);
  const dialog = screen.getByRole('dialog', { name: DIALOG_NAMES[kind] });
  return { user, opener, dialog };
}

describe('mobile nav as a modal dialog', () => {
  it.each([
    '/',
    '/ai-and-ml/prompt-engineering',
    '/system-design',
    '/system-design/url-shortener',
  ])('moves focus on open to the first focusable element inside, at %s', async (path) => {
    const { dialog } = await openModal('nav', path);
    // The links and buttons the panel shows, in document order.
    const [first] = [
      ...within(dialog).getAllByRole('link'),
      ...within(dialog).queryAllByRole('button'),
    ].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
    expect(first).toHaveFocus();
  });

  it.each(['/system-design', '/system-design/url-shortener'])(
    'wraps Tab from the last link to the first, and Shift+Tab from the first to the last, at %s',
    async (path) => {
      const { user, dialog } = await openModal('nav', path);
      const links = within(dialog).getAllByRole('link');
      const first = links[0];
      const last = links[links.length - 1];
      expect(links.length).toBeGreaterThan(1);
      expect(first).toHaveFocus();

      await user.tab({ shift: true });
      expect(last).toHaveFocus();

      await user.tab();
      expect(first).toHaveFocus();

      await user.tab();
      expect(links[1]).toHaveFocus();
    },
  );

  it('keeps focus inside however far Tab goes', async () => {
    const { user, dialog } = await openModal('nav', '/system-design');
    const count = within(dialog).getAllByRole('link').length;
    for (let i = 0; i < count * 2 + 1; i++) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });

  it.each(['/', '/system-design', '/system-design/url-shortener'])(
    'closes on Escape and returns focus to the opener, at %s',
    async (path) => {
      const { user, opener } = await openModal('nav', path);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
    },
  );

  it('returns focus to the opener after Tab has moved around inside', async () => {
    const { user, opener } = await openModal('nav', '/system-design/url-shortener');
    await user.tab();
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('search as a modal dialog', () => {
  /** Opens search and pastes `query`, once every body has loaded so the
   * results can't change under the test; returns the input and the result
   * buttons, in order. */
  async function openWithResults(query: string) {
    await ensureFullTextSearch();
    const opened = await openModal('search');
    const input = screen.getByPlaceholderText(/search topics/i);
    await opened.user.paste(query);
    const results = await waitFor(() => {
      const buttons = within(opened.dialog).getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(1);
      return buttons;
    });
    return { ...opened, input, results };
  }

  it('moves focus on open to the search input', async () => {
    await openModal('search');
    expect(screen.getByPlaceholderText(/search topics/i)).toHaveFocus();
  });

  it('wraps Tab from the last result to the input, and Shift+Tab from the input to the last result', async () => {
    const { user, input, results } = await openWithResults('queue');
    const last = results[results.length - 1];
    expect(input).toHaveFocus();

    await user.tab({ shift: true });
    expect(last).toHaveFocus();

    await user.tab();
    expect(input).toHaveFocus();

    await user.tab();
    expect(results[0]).toHaveFocus();
  });

  it('keeps focus on the input when it is the only focusable element', async () => {
    const { user } = await openModal('search');
    const input = screen.getByPlaceholderText(/search topics/i);
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(input).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const { user, opener } = await openModal('search');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on Escape from a result and returns focus to the opener', async () => {
    const { user, opener, results } = await openWithResults('queue');
    results[results.length - 1].focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
