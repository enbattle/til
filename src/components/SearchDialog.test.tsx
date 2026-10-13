import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ensureFullTextSearch, searchContent } from '@/lib/search';
import { getCaseStudy } from '@/lib/system-design';
import { escapeRegExp, renderDialog } from '@/test/render';

/** The one result button showing `summary` (a title can prefix others'). */
async function findResult(summary: string): Promise<HTMLElement> {
  return waitFor(() => {
    const matching = screen
      .getAllByRole('button')
      .filter((b) => b.textContent?.includes(summary));
    expect(matching).toHaveLength(1);
    return matching[0];
  });
}

describe('SearchDialog', () => {
  it('shows matching results as the query is typed', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(screen.getByPlaceholderText(/search topics/i), 'prompt engineering');
    // Role-scoped, not a plain text match — "Prompt Engineering" is also a
    // substring of several text-containing ancestors (the <li>, the <ul>,
    // the dialog panel), which makes a plain findByText ambiguous.
    const result = await screen.findByRole('button', { name: /Prompt Engineering/i });
    // A topic result is labelled with its section, not System Design.
    expect(result).toHaveTextContent('AI and Machine Learning');
    expect(result).not.toHaveTextContent('System Design');
  });

  it('labels a case-study result System Design, with its title and summary', async () => {
    const user = userEvent.setup();
    const caseStudy = getCaseStudy('url-shortener')!;
    renderDialog();
    // One paste rather than `user.type`: typing a long title fires a search
    // per keystroke, which is slow in jsdom under full-suite load.
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(caseStudy.title);
    const result = await screen.findByRole('button', {
      name: new RegExp(escapeRegExp(caseStudy.title)),
    });
    expect(within(result).getByText(caseStudy.title)).toBeInTheDocument();
    expect(result).toHaveTextContent('System Design');
    expect(result).toHaveTextContent(caseStudy.summary);
  });

  it('navigates to the case study and closes when its result is chosen', async () => {
    const user = userEvent.setup();
    const caseStudy = getCaseStudy('url-shortener')!;
    const onClose = renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(caseStudy.title);
    await user.click(await findResult(caseStudy.summary));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location-display')).toHaveTextContent(caseStudy.path);
  });

  // docs/specs/remove-dsa-tab.md, criterion 3: search indexes only topics and
  // case studies, so a query that used to match DSA entries shows none.
  it('shows only topic and case-study results for "binary search"', async () => {
    const user = userEvent.setup();
    await ensureFullTextSearch();
    const expected = searchContent('binary search');
    renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste('binary search');
    const items = await waitFor(() => {
      const found = screen.getAllByRole('listitem');
      expect(found).toHaveLength(Math.max(expected.length, 1));
      return found;
    });
    for (const li of items) expect(li).not.toHaveTextContent(/\bDSA\b/);
  });

  // docs/specs/content-dedupe.md, criterion 6: the dialog renders the index's
  // items as they are, with no per-kind switch: one row per result, in order,
  // showing its title and "label · summary".
  it('renders exactly searchContent’s results, in order, as title and label · summary', async () => {
    const user = userEvent.setup();
    const query = 'queue';
    // Bodies first, so the results can't change while the dialog renders.
    await ensureFullTextSearch();
    const expected = searchContent(query);
    expect(expected.length).toBeGreaterThan(2);
    renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(query);
    const list = await waitFor(() => {
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(expected.length);
      return items;
    });
    list.forEach((li, i) => {
      const button = within(li).getByRole('button');
      expect(button.textContent).toBe(
        `${expected[i].title}${expected[i].label} · ${expected[i].summary}`,
      );
    });
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
