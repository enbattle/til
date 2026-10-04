import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getTopic } from '@/lib/content';
import { getDsaEntry } from '@/lib/dsa';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import { CASE_STUDIES, getCaseStudy } from '@/lib/system-design';
import { caseStudyBody, dsaEntryBody, rawTopic } from '@/test/content';
import { escapeRegExp, renderAt } from '@/test/render';

// docs/specs/on-this-page-nav.md: the wider shell, the right-hand "On this
// page" nav (outside <main>) and its narrow-view copy inside <main>, now the
// sticky bar of docs/specs/on-this-page-bar.md (which replaced the <details>
// disclosure), on a case study, a DSA entry and a catalog topic page. jsdom applies
// no Tailwind CSS, so both copies of the nav are in the tree here; the tests
// tell them apart by whether they sit inside <main>, and pin the class tokens
// that hide one or the other (criteria 7-8). Stage 4's browser check verifies
// the real layout.

const NAME = 'On this page';

const TOPIC = getTopic('systems-and-infrastructure', 'caching')!;
const CASE_STUDY = getCaseStudy('url-shortener')!;
const DSA_ENTRY = getDsaEntry('binary-search')!;

const PAGES = [
  {
    kind: 'case study',
    path: `/system-design/${CASE_STUDY.slug}`,
    title: CASE_STUDY.title,
    body: () => caseStudyBody(CASE_STUDY.slug),
  },
  {
    kind: 'DSA entry',
    path: `/dsa/${DSA_ENTRY.slug}`,
    title: DSA_ENTRY.title,
    body: () => dsaEntryBody(DSA_ENTRY.slug),
  },
  {
    kind: 'catalog topic',
    path: `/${TOPIC.section}/${TOPIC.slug}`,
    title: TOPIC.title,
    body: () => parseFrontmatter(rawTopic(TOPIC.section, TOPIC.slug)).content,
  },
];

async function openPage(path: string, title: string) {
  renderAt(path);
  await screen.findByRole('heading', { level: 1, name: title });
  const main = screen.getByRole('main');
  // The body is its own lazily loaded chunk; wait for it.
  await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
  return { main, prose: main.querySelector('.prose') as HTMLElement };
}

/** Every "On this page" navigation that sits outside <main>: the right nav. */
function rightNavs(main: HTMLElement) {
  return screen
    .queryAllByRole('navigation', { name: NAME })
    .filter((nav) => !main.contains(nav));
}

/** The right column: the shell's element hidden below `xl` and shown from it,
 * outside <main>. */
function rightColumns(main: HTMLElement) {
  const shell = main.parentElement as HTMLElement;
  return [...shell.querySelectorAll<HTMLElement>('[class~="xl:block"]')].filter(
    (el) => !main.contains(el) && !el.contains(main),
  );
}

function hrefs(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));
}

describe.each(PAGES)('On this page on a $kind', ({ path, title, body }) => {
  const expected = () => h2Headings(body());

  it('has a right nav outside <main> linking #<id> of every ## heading, in order, each id on a rendered h2 (criterion 1)', async () => {
    const { main, prose } = await openPage(path, title);
    const headings = expected();
    expect(headings.length).toBeGreaterThan(0);

    await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
    const [nav] = rightNavs(main);
    expect(nav.tagName).toBe('NAV');
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      headings.map((h) => `#${h.id}`),
    );
    expect(links.map((a) => a.textContent?.trim())).toEqual(headings.map((h) => h.text));
    for (const { id } of headings) {
      const target = document.getElementById(id);
      expect(target, `#${id}`).not.toBeNull();
      expect(target!.tagName).toBe('H2');
      expect(prose.contains(target)).toBe(true);
    }
    // Labelled by a small text label, not a heading (no skipped levels).
    expect(within(nav).queryByRole('heading')).not.toBeInTheDocument();
    expect(nav).toHaveTextContent(NAME);
  });

  it('lists the right nav as an ordered list without visible numbers, in the left nav’s non-current link style', async () => {
    const { main } = await openPage(path, title);
    await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
    const [nav] = rightNavs(main);
    const list = nav.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list).not.toHaveClass('list-decimal');
    // jsdom does no layout, so the scroll-spy (docs/specs/on-this-page-scroll-
    // spy.md) may mark a link current here; that one is covered by
    // App.on-this-page-scroll-spy.test.tsx, and every other link keeps the
    // non-current style.
    for (const link of within(nav).getAllByRole('link')) {
      expect(list!.contains(link)).toBe(true);
      expect(link).toHaveClass('border-l-2');
      if (link.hasAttribute('aria-current')) continue;
      expect(link).toHaveClass('border-transparent', 'hover:border-accent');
    }
  });

  it('has a closed "On this page" bar in <main>, before the body’s first heading, whose panel holds the same links, and no <details> (docs/specs/on-this-page-bar.md, criteria 1 and 4)', async () => {
    const user = userEvent.setup();
    const { main, prose } = await openPage(path, title);
    const headings = expected();

    const bar = await waitFor(() => {
      const found = within(main).getAllByRole('navigation', { name: NAME });
      expect(found).toHaveLength(1);
      return found[0];
    });
    expect(prose.contains(bar)).toBe(false);
    expect(main.querySelector('details')).toBeNull();

    const button = within(bar).getByRole('button', {
      name: new RegExp(`^${escapeRegExp(NAME)}`),
    });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(panel).not.toBeNull();
    expect(hrefs(panel!)).toEqual(headings.map((h) => `#${h.id}`));

    const firstHeading = prose.querySelector('h2, h3, h4, h5, h6') as HTMLElement;
    expect(firstHeading).not.toBeNull();
    expect(
      bar.compareDocumentPosition(firstHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has no navigation named "Contents" (criterion 3)', async () => {
    const { main } = await openPage(path, title);
    await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
    expect(
      screen.queryByRole('navigation', { name: 'Contents' }),
    ).not.toBeInTheDocument();
  });

  it('puts the right nav in a column hidden below xl and shown from xl, and the bar carries xl:hidden (criterion 7)', async () => {
    const { main } = await openPage(path, title);
    await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
    const [nav] = rightNavs(main);

    const columns = rightColumns(main);
    expect(columns).toHaveLength(1);
    expect(columns[0]).toHaveClass('hidden', 'xl:block');
    expect(columns[0].contains(nav)).toBe(true);
    expect(columns[0].tagName).not.toBe('ASIDE');

    const bar = within(main).getByRole('navigation', { name: NAME });
    expect(bar).toHaveClass('xl:hidden');
    expect(main.querySelector('details')).toBeNull();
  });
});

describe('pages without sections (criterion 4)', () => {
  it.each([
    ['/', 'til'],
    ['/ai-and-ml', 'AI & Machine Learning'],
    ['/system-design', 'System Design'],
    ['/dsa', 'Data Structures & Algorithms'],
    ['/not-found', /page not found/i],
  ] as const)(
    '%s renders no "On this page" nav and no disclosure, but keeps an empty right column',
    async (path, heading) => {
      renderAt(path);
      await screen.findByRole('heading', { name: heading });
      expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument();
      expect(document.querySelector('details')).toBeNull();
      expect(screen.queryByText(NAME)).not.toBeInTheDocument();

      const main = screen.getByRole('main');
      const columns = rightColumns(main);
      expect(columns).toHaveLength(1);
      expect(columns[0]).toHaveClass('hidden', 'xl:block');
      expect(columns[0]).toBeEmptyDOMElement();
    },
  );
});

describe('moving between pages (criterion 5)', () => {
  it('shows only the new case study’s links after moving to another, and none on the landing page', async () => {
    const user = userEvent.setup();
    const [first, second] = CASE_STUDIES;
    const firstHrefs = h2Headings(caseStudyBody(first.slug)).map((h) => `#${h.id}`);
    const secondHrefs = h2Headings(caseStudyBody(second.slug)).map((h) => `#${h.id}`);
    expect(secondHrefs).not.toEqual(firstHrefs);

    const { main } = await openPage(`/system-design/${first.slug}`, first.title);
    await waitFor(() => expect(rightNavs(main)).toHaveLength(1));
    expect(hrefs(rightNavs(main)[0])).toEqual(firstHrefs);

    const caseStudyNav = screen.getByRole('navigation', { name: 'Case studies' });
    await user.click(
      within(caseStudyNav).getByRole('link', {
        name: new RegExp(escapeRegExp(second.title)),
      }),
    );
    await screen.findByRole('heading', { level: 1, name: second.title });
    await waitFor(() =>
      expect(screen.getByRole('main').querySelector('.prose')).not.toBeNull(),
    );
    await waitFor(() => {
      const navs = rightNavs(screen.getByRole('main'));
      expect(navs).toHaveLength(1);
      expect(hrefs(navs[0])).toEqual(secondHrefs);
    });

    const primary = screen.getByRole('navigation', { name: 'Primary' });
    await user.click(within(primary).getByRole('link', { name: 'System Design' }));
    await screen.findByRole('heading', { level: 1, name: 'System Design' });
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: NAME })).not.toBeInTheDocument(),
    );
    expect(rightColumns(screen.getByRole('main'))[0]).toBeEmptyDOMElement();
  });
});

describe('shell widths (criterion 8)', () => {
  it('caps the header row and the shell at 1440px and <main> at 800px', () => {
    renderAt('/');
    const main = screen.getByRole('main');
    const shell = main.parentElement as HTMLElement;
    expect(shell).toHaveClass('max-w-[90rem]', 'px-4');
    expect(shell).not.toHaveClass('max-w-5xl');

    const headerRow = screen.getByRole('banner').firstElementChild as HTMLElement;
    expect(headerRow).toHaveClass('max-w-[90rem]', 'px-4');
    expect(headerRow).not.toHaveClass('max-w-5xl');

    expect(main).toHaveClass('max-w-[50rem]');
    expect(main).not.toHaveClass('max-w-3xl');
  });
});
