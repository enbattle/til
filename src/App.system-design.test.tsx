import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TOPICS } from '@/lib/content';
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
// Shared across the three kinds of page (docs/specs/ui-dedupe.md, design item
// 6): "On this page" is tested in App.on-this-page.test.tsx, Previous/Next and
// not-found in App.page-kinds.test.tsx, and the sidebar choice in
// App.tabs.test.tsx.

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
      // The heading is read from the file, not pinned (docs/specs/
      // harness-follow-ups.md, criterion 9).
      await within(main).findByRole('heading', {
        level: 2,
        name: h2Headings(caseStudyBody(SLUG))[0].text,
      }),
    ).toBeInTheDocument();
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

describe('topic page back-links (criterion 10)', () => {
  const BACKLINKS = 'Case studies this topic is used in';
  // Topics are found from what the case studies link now, not pinned, so a
  // rewrite of a case study's prose can't break these (docs/specs/
  // harness-follow-ups.md, criterion 9).
  function linkedTopic() {
    const [topic] = topicsForCaseStudy(urlShortener());
    expect(topic, 'the URL shortener links no topic').toBeDefined();
    return topic;
  }

  it('lists the linking case studies after the body, before the prev/next nav', async () => {
    const topic = linkedTopic();
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
    // Every navigation in <main> but the "On this page" bar (which sits
    // before the body) comes after the back-links.
    for (const other of within(main).getAllByRole('navigation')) {
      if (other === nav || other.getAttribute('aria-label') === 'On this page') continue;
      expect(
        nav.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(screen.queryByText('This comes up in:')).not.toBeInTheDocument();
  });

  it('follows a back-link to the case study, with System Design current', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    const topic = linkedTopic();
    renderAt(`/${topic.section}/${topic.slug}`);
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
    const topic = TOPICS.find((t) => caseStudiesForTopic(t.section, t.slug).length === 0);
    expect(topic, 'every topic is linked; this case needs a fixture').toBeDefined();
    if (!topic) return;
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
