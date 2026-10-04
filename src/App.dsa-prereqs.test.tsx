import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { getDsaEntry } from '@/lib/dsa';
import App from './App';

// docs/specs/dsa-tab.md, criterion 7: "Before this" lists an entry's
// prerequisites as links, just under the title and before the body. The real
// entries may have few or no prerequisites, so this file gives binary-search
// two through a stubbed `getDsaPrerequisites` to check the shown case; the
// real entries are checked in App.dsa.test.tsx.
vi.mock('@/lib/dsa', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dsa')>('@/lib/dsa');
  return {
    ...actual,
    getDsaPrerequisites: (slug: string) =>
      slug === 'binary-search'
        ? [actual.getDsaEntry('hash-map')!, actual.getDsaEntry('two-pointers')!]
        : [],
  };
});

describe('"Before this" with prerequisites (criterion 7)', () => {
  it('lists the prerequisites as links, in order, between the title and the body', async () => {
    const entry = getDsaEntry('binary-search')!;
    render(
      <MemoryRouter initialEntries={['/dsa/binary-search']}>
        <App />
      </MemoryRouter>,
    );
    const h1 = await screen.findByRole('heading', { level: 1, name: entry.title });
    const main = screen.getByRole('main');
    await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());

    const before = within(main).getByRole('navigation', { name: 'Before this' });
    expect(before).toHaveTextContent('Before this');
    const links = within(before).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/dsa/hash-map',
      '/dsa/two-pointers',
    ]);
    expect(links[0]).toHaveTextContent(getDsaEntry('hash-map')!.title);
    expect(links[1]).toHaveTextContent(getDsaEntry('two-pointers')!.title);

    const prose = main.querySelector('.prose') as HTMLElement;
    expect(
      h1.compareDocumentPosition(before) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      before.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The narrow-view "On this page" bar (docs/specs/on-this-page-bar.md)
    // follows "Before this"; the <details> disclosure is gone.
    const onThisPage = within(main).getByRole('navigation', { name: 'On this page' });
    expect(main.querySelector('details')).toBeNull();
    expect(
      within(onThisPage).getByRole('button', { name: /^On this page/ }),
    ).toBeVisible();
    expect(
      before.compareDocumentPosition(onThisPage) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('shows no "Before this" on an entry without prerequisites', async () => {
    const entry = getDsaEntry('hash-map')!;
    render(
      <MemoryRouter initialEntries={['/dsa/hash-map']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: entry.title });
    const main = screen.getByRole('main');
    await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
    expect(
      within(main).queryByRole('navigation', { name: 'Before this' }),
    ).not.toBeInTheDocument();
  });
});
