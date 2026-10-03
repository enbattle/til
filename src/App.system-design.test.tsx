import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getTopic } from '@/lib/content';
import { h2Headings } from '@/lib/headings';
import {
  CASE_STUDIES,
  caseStudiesForTopic,
  getCaseStudy,
  topicsForCaseStudy,
} from '@/lib/system-design';
import { caseStudyBody, chromeLinks } from '@/test/content';
import { escapeRegExp, renderAt } from '@/test/render';

// --- System Design: design case studies alongside the catalog ---

function primaryNav() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

const SLUG = 'url-shortener';

function urlShortener() {
  const caseStudy = getCaseStudy(SLUG);
  if (!caseStudy) throw new Error('the url-shortener case study is missing');
  return caseStudy;
}

async function openCaseStudy(slug = SLUG) {
  const caseStudy = getCaseStudy(slug)!;
  renderAt(`/system-design/${slug}`);
  await screen.findByRole('heading', { level: 1, name: caseStudy.title });
  const main = screen.getByRole('main');
  // The body is its own lazily loaded chunk; wait for it.
  await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
  return { caseStudy, main };
}

describe('unknown case-study slug', () => {
  it('shows not-found for an unknown case-study slug', async () => {
    renderAt('/system-design/does-not-exist');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

describe('header tabs on System Design routes', () => {
  it('switches tabs and sidebars when the Catalog tab is clicked from a case study', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    renderAt(`/system-design/${SLUG}`);
    await screen.findByRole('heading', { level: 1, name: caseStudy.title });
    await user.click(within(primaryNav()).getByRole('link', { name: 'Catalog' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'til' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Case studies' }),
    ).not.toBeInTheDocument();
  });
});

describe('System Design landing (criterion 7)', () => {
  it('renders exactly one h1 named System Design', () => {
    renderAt('/system-design');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('System Design');
  });

  it('lists one card link per case study, in order, each with its number, title and summary', () => {
    renderAt('/system-design');
    const main = screen.getByRole('main');
    const cards = within(main)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/system-design/'));
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      CASE_STUDIES.map((c) => `/system-design/${c.slug}`),
    );
    CASE_STUDIES.forEach((caseStudy, i) => {
      expect(cards[i]).toHaveTextContent(caseStudy.title);
      expect(cards[i]).toHaveTextContent(caseStudy.summary);
      expect(cards[i]).toHaveTextContent(String(caseStudy.order));
    });
  });

  it('navigates to the case study when a card is clicked', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    renderAt('/system-design');
    const main = screen.getByRole('main');
    await user.click(
      within(main).getByRole('link', {
        name: new RegExp(escapeRegExp(caseStudy.title)),
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: caseStudy.title }),
    ).toBeInTheDocument();
  });
});

describe('case study page (criterion 8)', () => {
  it('has exactly one h1 (the title), a back link, the date and its body', async () => {
    const { caseStudy, main } = await openCaseStudy();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName(caseStudy.title);
    expect(within(main).getByRole('link', { name: '← System Design' })).toHaveAttribute(
      'href',
      '/system-design',
    );
    expect(main).toHaveTextContent(caseStudy.date);
    expect(
      await within(main).findByRole('heading', { level: 2, name: 'Requirements' }),
    ).toBeInTheDocument();
  });

  it('has an "On this page" nav outside <main> linking to #<id> of every body ## heading, in order, and those ids exist', async () => {
    const { main } = await openCaseStudy();
    const expected = h2Headings(caseStudyBody(SLUG)).map((h) => h.text);
    expect(expected.length).toBeGreaterThan(0);

    const onThisPage = await waitFor(() => {
      const navs = screen
        .getAllByRole('navigation', { name: 'On this page' })
        .filter((nav) => !main.contains(nav));
      expect(navs).toHaveLength(1);
      return navs[0];
    });
    expect(
      screen.queryByRole('navigation', { name: 'Contents' }),
    ).not.toBeInTheDocument();
    const links = within(onThisPage).getAllByRole('link');
    expect(links.map((a) => a.textContent?.trim())).toEqual(expected);

    const prose = main.querySelector('.prose') as HTMLElement;
    const ids = links.map((link) => {
      const href = link.getAttribute('href') ?? '';
      expect(href).toMatch(/#[^#]+$/);
      const id = decodeURIComponent(href.slice(href.lastIndexOf('#') + 1));
      const target = document.getElementById(id);
      expect(target, `#${id}`).not.toBeNull();
      expect(target!.tagName).toBe('H2');
      expect(prose.contains(target)).toBe(true);
      expect(target).toHaveTextContent(link.textContent!.trim());
      return id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places the "On this page" disclosure in <main> before the body', async () => {
    const { main } = await openCaseStudy();
    const onThisPage = await within(main).findByRole('navigation', {
      name: 'On this page',
    });
    expect(onThisPage.closest('details')).not.toBeNull();
    const prose = main.querySelector('.prose') as HTMLElement;
    expect(
      onThisPage.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('has a "Go deeper" h2 listing each topicsForCaseStudy topic once, with its summary', async () => {
    const { caseStudy, main } = await openCaseStudy();
    const heading = await within(main).findByRole('heading', {
      level: 2,
      name: 'Go deeper',
    });
    const topics = topicsForCaseStudy(caseStudy);
    expect(topics.length).toBeGreaterThan(0);

    const after = chromeLinks(main).filter(
      (a) =>
        heading.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !a.getAttribute('href')?.startsWith('/system-design'),
    );
    expect(after.map((a) => a.getAttribute('href'))).toEqual(
      topics.map((t) => `/${t.section}/${t.slug}`),
    );
    after.forEach((link, i) => {
      expect(link).toHaveTextContent(topics[i].title);
      const item = link.closest('li') ?? link.parentElement;
      expect(item).toHaveTextContent(topics[i].summary);
    });
  });

  // First, middle and last cover no-previous, both, and no-next.
  const ADJACENCY_CASES = [
    ...new Set([0, Math.floor(CASE_STUDIES.length / 2), CASE_STUDIES.length - 1]),
  ].map((i) => [CASE_STUDIES[i].slug, i] as const);

  it.each(ADJACENCY_CASES)(
    '%s links to the adjacent case studies by order, only when they exist',
    async (slug, index) => {
      const { main } = await openCaseStudy(slug);
      const adjacent = chromeLinks(main)
        .map((a) => a.getAttribute('href'))
        .filter(
          (href): href is string =>
            !!href && href.startsWith('/system-design/') && !href.includes('#'),
        );
      const expected = [CASE_STUDIES[index - 1], CASE_STUDIES[index + 1]]
        .filter((c) => c !== undefined)
        .map((c) => `/system-design/${c.slug}`);
      expect(adjacent).toEqual(expected);
    },
  );

  it('routes a body link to its catalog topic page, with Catalog current', async () => {
    const user = userEvent.setup();
    const { caseStudy, main } = await openCaseStudy();
    const [topic] = topicsForCaseStudy(caseStudy);
    const bodyLink = within(main)
      .getAllByRole('link')
      .find(
        (a) =>
          a.closest('.prose') &&
          a.getAttribute('href') === `/${topic.section}/${topic.slug}`,
      );
    expect(bodyLink).toBeDefined();
    await user.click(bodyLink as HTMLElement);
    expect(
      await screen.findByRole('heading', { level: 1, name: topic.title }),
    ).toBeInTheDocument();
    expect(within(primaryNav()).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('sidebar selection (criterion 9)', () => {
  it.each(['/system-design', `/system-design/${SLUG}`])(
    'shows Case studies, not Sections, in the persistent sidebar at %s',
    async (path) => {
      renderAt(path);
      expect(
        screen.getByRole('navigation', { name: 'Case studies' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Sections' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 });
    },
  );

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/not-found'])(
    'shows Sections, not Case studies, in the persistent sidebar at %s',
    async (path) => {
      renderAt(path);
      expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Case studies' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 }).catch(() => undefined);
    },
  );
});

describe('topic page back-links (criterion 10)', () => {
  const BACKLINKS = 'Case studies this topic is used in';

  it('lists the linking case studies after the body, before the prev/next nav', async () => {
    const topic = getTopic('systems-and-infrastructure', 'caching')!;
    expect(topic).toBeDefined();
    const expected = caseStudiesForTopic(topic.section, topic.slug);
    expect(expected.map((c) => c.slug)).toContain(SLUG);

    renderAt(`/${topic.section}/${topic.slug}`);
    await screen.findByRole('heading', { level: 1, name: topic.title });
    const main = screen.getByRole('main');
    // The navigation is added once the body has loaded, not with the header.
    const nav = await within(main).findByRole('navigation', { name: BACKLINKS });
    expect(nav).toHaveTextContent('Used in these case studies:');

    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      expected.map((c) => `/system-design/${c.slug}`),
    );
    expect(links.map((a) => a.textContent)).toEqual(expected.map((c) => c.title));

    await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
    const prose = main.querySelector('.prose') as HTMLElement;
    expect(
      prose.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Every navigation in <main> but the "On this page" disclosure (which
    // sits before the body) comes after the back-links.
    for (const other of within(main).getAllByRole('navigation')) {
      if (other === nav || other.closest('details')) continue;
      expect(
        nav.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByText('This comes up in:')).not.toBeInTheDocument();
  });

  it('follows a back-link to the case study, with System Design current', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    renderAt('/systems-and-infrastructure/caching');
    const nav = await screen.findByRole('navigation', { name: BACKLINKS });
    await user.click(within(nav).getByRole('link', { name: caseStudy.title }));
    expect(
      await screen.findByRole('heading', { level: 1, name: caseStudy.title }),
    ).toBeInTheDocument();
    expect(
      within(primaryNav()).getByRole('link', { name: 'System Design' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders no back-link navigation for a topic no case study links', async () => {
    const topic = getTopic('ai-and-ml', 'prompt-engineering')!;
    expect(caseStudiesForTopic(topic.section, topic.slug)).toEqual([]);
    renderAt(`/${topic.section}/${topic.slug}`);
    await screen.findByRole('heading', { level: 1, name: topic.title });
    // Wait for the body so the absence is checked after the page has settled.
    await waitFor(() =>
      expect(screen.getByRole('main').querySelector('.prose')).not.toBeNull(),
    );
    expect(screen.queryByRole('navigation', { name: BACKLINKS })).not.toBeInTheDocument();
    expect(screen.queryByText('Used in these case studies:')).not.toBeInTheDocument();
    expect(screen.queryByText('This comes up in:')).not.toBeInTheDocument();
  });
});
