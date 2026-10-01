import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getDsaEntry } from '@/lib/dsa';
import { renderDialog } from '@/test/render';

// docs/specs/dsa-tab.md, criterion 14: a DSA result is labelled "DSA" and goes
// to /dsa/<slug>.

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

describe('SearchDialog DSA results (criterion 14)', () => {
  it('labels a DSA result "DSA", with its title and summary', async () => {
    const user = userEvent.setup();
    const entry = getDsaEntry('binary-search')!;
    expect(entry).toBeDefined();
    renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste('binary search');
    const result = await findResult(entry.summary);
    expect(result).toHaveTextContent('DSA');
    expect(result).toHaveTextContent(entry.summary);
    expect(result).not.toHaveTextContent('System Design');
  });

  it('navigates to /dsa/binary-search and closes when the result is chosen', async () => {
    const user = userEvent.setup();
    const entry = getDsaEntry('binary-search')!;
    const onClose = renderDialog();
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste('binary search');
    await user.click(await findResult(entry.summary));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/dsa/binary-search',
    );
  });
});
