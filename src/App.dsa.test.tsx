import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { DSA_ENTRIES, dsaKindLabel, getDsaEntry, getDsaPrerequisites } from '@/lib/dsa';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import App from './App';

// docs/specs/dsa-tab.md, criteria 6-8 on the whole app: the /dsa landing page,
// the /dsa/:slug entry page and the sidebar choice.

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  localStorage.clear();
});

const RAW = import.meta.glob('/src/dsa/entries/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function bodyOf(slug: string): string {
  const raw = RAW[`/src/dsa/entries/${slug}.md`];
  if (raw === undefined) throw new Error(`no raw file for DSA entry ${slug}`);
  return parseFrontmatter(raw).content;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Links inside <main> outside the rendered markdown body. */
function chromeLinks(main: HTMLElement): HTMLAnchorElement[] {
  return within(main)
    .getAllByRole('link')
    .filter((a) => !a.closest('.prose')) as HTMLAnchorElement[];
}

async function openEntry(slug: string) {
  const entry = getDsaEntry(slug);
  if (!entry) throw new Error(`the ${slug} DSA entry is missing`);
  renderAt(`/dsa/${slug}`);
  await screen.findByRole('heading', { level: 1, name: entry.title });
  const main = screen.getByRole('main');
  // The body is its own lazily loaded chunk; wait for it.
  await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
  return { entry, main };
}

describe('DSA landing (criterion 6)', () => {
  it('renders exactly one h1, "Data Structures & Algorithms", and an intro', () => {
    renderAt('/dsa');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('Data Structures & Algorithms');
    const main = screen.getByRole('main');
    const intro = main.querySelector('p');
    expect(intro?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
    const list = main.querySelector('ol');
    expect(list).not.toBeNull();
    expect(
      intro!.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('lists every entry in DSA_ENTRIES order in one numbered list, with number, title, kind label and summary', () => {
    renderAt('/dsa');
    const main = screen.getByRole('main');
    const cards = within(main)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/dsa/'));
    expect(DSA_ENTRIES.length).toBeGreaterThanOrEqual(3);
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      DSA_ENTRIES.map((e) => `/dsa/${e.slug}`),
    );
    const list = cards[0].closest('ol');
    expect(list).not.toBeNull();
    for (const card of cards) expect(card.closest('ol')).toBe(list);
    DSA_ENTRIES.forEach((entry, i) => {
      const card = cards[i].closest('li') ?? cards[i];
      expect(card).toHaveTextContent(entry.title);
      expect(card).toHaveTextContent(entry.summary);
      expect(card).toHaveTextContent(dsaKindLabel(entry.kind));
      expect(card).toHaveTextContent(String(i + 1));
    });
  });

  it('navigates to an entry when its card is clicked', async () => {
    const user = userEvent.setup();
    const entry = getDsaEntry('two-pointers')!;
    renderAt('/dsa');
    const main = screen.getByRole('main');
    await user.click(
      within(main).getByRole('link', { name: new RegExp(escapeRegExp(entry.title)) }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: entry.title }),
    ).toBeInTheDocument();
  });
});

describe('DSA entry page (criterion 7)', () => {
  it('has exactly one h1 (the title), a back link to /dsa, the date and the kind label', async () => {
    const { entry, main } = await openEntry('binary-search');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName(entry.title);
    expect(chromeLinks(main).some((a) => a.getAttribute('href') === '/dsa')).toBe(true);
    expect(main).toHaveTextContent(entry.date);
    // The label is page chrome, not something the body happens to say.
    const chrome = main.cloneNode(true) as HTMLElement;
    chrome.querySelector('.prose')?.remove();
    expect(chrome).toHaveTextContent(dsaKindLabel(entry.kind));
  });

  it('has a Contents nav linking to #<id> of every body ## heading, in order, and those ids exist', async () => {
    const { main } = await openEntry('binary-search');
    const expected = h2Headings(bodyOf('binary-search')).map((h) => h.text);
    expect(expected.length).toBeGreaterThan(0);

    const contents = await within(main).findByRole('navigation', { name: 'Contents' });
    const links = within(contents).getAllByRole('link');
    expect(links.map((a) => a.textContent?.trim())).toEqual(expected);

    const prose = main.querySelector('.prose') as HTMLElement;
    for (const link of links) {
      const href = link.getAttribute('href') ?? '';
      expect(href).toMatch(/^#[^#]+$/);
      const target = document.getElementById(decodeURIComponent(href.slice(1)));
      expect(target, href).not.toBeNull();
      expect(target!.tagName).toBe('H2');
      expect(prose.contains(target)).toBe(true);
    }
  });

  it.each(['hash-map', 'two-pointers', 'binary-search'])(
    '%s shows "Before this" with exactly its prerequisites, before the body, or none when it has none',
    async (slug) => {
      const { main } = await openEntry(slug);
      const prereqs = getDsaPrerequisites(slug);
      const before = within(main).queryByRole('navigation', { name: 'Before this' });
      if (prereqs.length === 0) {
        expect(before).not.toBeInTheDocument();
        expect(within(main).queryByText('Before this')).not.toBeInTheDocument();
        return;
      }
      expect(before).not.toBeNull();
      const links = within(before!).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(
        prereqs.map((p) => `/dsa/${p.slug}`),
      );
      links.forEach((a, i) => expect(a).toHaveTextContent(prereqs[i].title));
      const prose = main.querySelector('.prose') as HTMLElement;
      expect(
        before!.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    },
  );

  // First, middle and last cover no-previous, both, and no-next.
  const ADJACENCY_CASES = [
    ...new Set([0, Math.floor(DSA_ENTRIES.length / 2), DSA_ENTRIES.length - 1]),
  ].map((i) => [DSA_ENTRIES[i].slug, i] as const);

  it.each(ADJACENCY_CASES)(
    '%s links to the neighbouring entries by list order, only when they exist',
    async (slug, index) => {
      const { main } = await openEntry(slug);
      const adjacent = chromeLinks(main)
        .filter((a) => !a.closest('nav[aria-label="Before this"]'))
        .map((a) => a.getAttribute('href'))
        .filter((href): href is string => !!href && href.startsWith('/dsa/'));
      const expected = [DSA_ENTRIES[index - 1], DSA_ENTRIES[index + 1]]
        .filter((e) => e !== undefined)
        .map((e) => `/dsa/${e.slug}`);
      expect(adjacent).toEqual(expected);
    },
  );

  it('renders its code pairs as Python/TypeScript tabs', async () => {
    const { main } = await openEntry('binary-search');
    const prose = main.querySelector('.prose') as HTMLElement;
    const tablists = within(prose).getAllByRole('tablist');
    expect(tablists.length).toBeGreaterThanOrEqual(3);
    for (const tablist of tablists) {
      expect(
        within(tablist)
          .getAllByRole('tab')
          .map((t) => t.textContent?.trim()),
      ).toEqual(['Python', 'TypeScript']);
    }
  });

  it('shows not-found for an unknown slug', async () => {
    renderAt('/dsa/nope');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

describe('sidebar selection (criterion 8)', () => {
  it.each(['/dsa', '/dsa/binary-search'])(
    'shows the DSA nav, not Sections or Case studies, in the persistent sidebar at %s',
    async (path) => {
      renderAt(path);
      const dsa = screen.getByRole('navigation', { name: 'DSA entries' });
      expect(within(dsa).getAllByRole('link')).toHaveLength(DSA_ENTRIES.length);
      expect(
        screen.queryByRole('navigation', { name: 'Sections' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Case studies' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 });
    },
  );

  it('marks the current entry in the sidebar', async () => {
    renderAt('/dsa/binary-search');
    const dsa = screen.getByRole('navigation', { name: 'DSA entries' });
    const current = within(dsa)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.getAttribute('href'))).toEqual(['/dsa/binary-search']);
    await screen.findByRole('heading', { level: 1 });
  });

  it.each(['/system-design', '/system-design/url-shortener'])(
    'still shows Case studies, not the DSA nav, at %s',
    async (path) => {
      renderAt(path);
      expect(
        screen.getByRole('navigation', { name: 'Case studies' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'DSA entries' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 });
    },
  );

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering'])(
    'still shows Sections, not the DSA nav, at %s',
    async (path) => {
      renderAt(path);
      expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'DSA entries' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 });
    },
  );
});
