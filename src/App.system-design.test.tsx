import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { getTopic } from '@/lib/content';
import { parseFrontmatter } from '@/lib/frontmatter';
import {
  CASE_STUDIES,
  caseStudiesForTopic,
  getCaseStudy,
  topicsForCaseStudy,
} from '@/lib/system-design';
import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

// --- System Design: design case studies alongside the catalog ---

const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function bodyOf(slug: string): string {
  const raw = RAW[`/src/system-design/case-studies/${slug}.md`];
  if (raw === undefined) throw new Error(`no raw file for case study ${slug}`);
  return parseFrontmatter(raw).content;
}

/** Text of each `##` heading in `body`, in order, outside fenced code, with
 * inline markdown emphasis/code markers removed. */
function h2Texts(body: string): string[] {
  const texts: string[] = [];
  let fence: string | null = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    const heading = /^ {0,3}##[ \t]+(.+?)[ \t#]*$/.exec(line);
    if (heading) texts.push(heading[1].replace(/[`*_]/g, '').trim());
  }
  return texts;
}

function primaryNav() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Links inside <main> that sit outside the rendered markdown body. */
function chromeLinks(main: HTMLElement): HTMLAnchorElement[] {
  return within(main)
    .getAllByRole('link')
    .filter((a) => !a.closest('.prose')) as HTMLAnchorElement[];
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

describe('question pages are gone (criterion 1)', () => {
  it('shows not-found for a former question URL', async () => {
    renderAt('/system-design/database-cant-keep-up-with-reads');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('shows not-found for an unknown case-study slug', async () => {
    renderAt('/system-design/does-not-exist');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

describe('header tabs on System Design routes', () => {
  it.each(['/system-design', `/system-design/${SLUG}`])(
    'marks System Design current at %s',
    async (path) => {
      renderAt(path);
      await screen.findByRole('heading', { level: 1 });
      const nav = primaryNav();
      expect(within(nav).getByRole('link', { name: 'System Design' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(within(nav).getByRole('link', { name: 'Catalog' })).not.toHaveAttribute(
        'aria-current',
      );
    },
  );

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

  it('includes the URL shortener', () => {
    renderAt('/system-design');
    const main = screen.getByRole('main');
    expect(
      within(main)
        .getAllByRole('link')
        .some((a) => a.getAttribute('href') === `/system-design/${SLUG}`),
    ).toBe(true);
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

  it('has a Contents nav linking to #<id> of every body ## heading, in order, and those ids exist', async () => {
    const { main } = await openCaseStudy();
    const expected = h2Texts(bodyOf(SLUG));
    expect(expected.length).toBeGreaterThan(0);

    const contents = await within(main).findByRole('navigation', { name: 'Contents' });
    const links = within(contents).getAllByRole('link');
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

  it('places the Contents nav before the body', async () => {
    const { main } = await openCaseStudy();
    const contents = await within(main).findByRole('navigation', { name: 'Contents' });
    const prose = main.querySelector('.prose') as HTMLElement;
    expect(
      contents.compareDocumentPosition(prose) & Node.DOCUMENT_POSITION_FOLLOWING,
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

  it.each(CASE_STUDIES.map((c, i) => [c.slug, i] as const))(
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

describe('diagrams on the case study page (criterion 13)', () => {
  it('renders each diagram as a themed, base-prefixed, sized <img> inside a new-tab link', async () => {
    const { main } = await openCaseStudy();
    const prose = main.querySelector('.prose') as HTMLElement;
    const images = within(prose)
      .getAllByRole('img')
      .filter((img) => img.getAttribute('src')?.includes('diagrams/'));
    expect(images.length).toBeGreaterThanOrEqual(2);
    for (const img of images) {
      // The default preference is "system", and the test environment's
      // matchMedia reports light.
      expect(img.getAttribute('src')).toMatch(
        new RegExp(`^${import.meta.env.BASE_URL}diagrams/${SLUG}/[^/]+\\.light\\.svg$`),
      );
      expect(img.getAttribute('alt')?.trim().length).toBeGreaterThan(0);
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
      const link = img.closest('a');
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(link).toHaveAccessibleName(/Open diagram full size/i);
    }
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

  it('lists one link per case study in order and marks the current one', async () => {
    const caseStudy = urlShortener();
    renderAt(`/system-design/${SLUG}`);
    await screen.findByRole('heading', { level: 1, name: caseStudy.title });
    const nav = screen.getByRole('navigation', { name: 'Case studies' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      CASE_STUDIES.map((c) => `/system-design/${c.slug}`),
    );
    for (const link of links) {
      if (link.getAttribute('href') === `/system-design/${SLUG}`) {
        expect(link).toHaveAttribute('aria-current', 'page');
      } else {
        expect(link).not.toHaveAttribute('aria-current');
      }
    }
  });

  it('applies the same scroll-wrapper styling to the Case studies sidebar', () => {
    renderAt('/system-design');
    expect(screen.getByRole('navigation', { name: 'Case studies' })).toHaveClass(
      'scrollbar-thin',
    );
  });

  it('opens the mobile nav on a System Design route with the case studies, and closes on link click', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    renderAt('/system-design');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    const nav = within(dialog).getByRole('navigation', { name: 'Case studies' });
    expect(
      within(dialog).queryByRole('navigation', { name: 'Sections' }),
    ).not.toBeInTheDocument();
    const link = within(nav)
      .getAllByRole('link')
      .find((a) => a.getAttribute('href') === `/system-design/${SLUG}`);
    expect(link).toBeDefined();
    await user.click(link!);
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: caseStudy.title }),
    ).toBeInTheDocument();
  });

  it('still opens the Sections tree in the mobile nav on a catalog route', async () => {
    const user = userEvent.setup();
    renderAt('/ai-and-ml');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(
      within(dialog).getByRole('navigation', { name: 'Sections' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('navigation', { name: 'Case studies' }),
    ).not.toBeInTheDocument();
  });
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
    for (const other of within(main).getAllByRole('navigation')) {
      if (other === nav) continue;
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

describe('search finds case studies (criterion 11)', () => {
  it('shows the URL shortener labelled System Design and navigates to it, closing the dialog', async () => {
    const user = userEvent.setup();
    const caseStudy = urlShortener();
    renderAt('/');
    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByPlaceholderText(/search topics/i));
    await user.paste(caseStudy.title);
    const dialog = screen.getByRole('dialog', { name: /search topics/i });
    const result = await within(dialog).findByRole('button', {
      name: new RegExp(escapeRegExp(caseStudy.title)),
    });
    expect(result).toHaveTextContent('System Design');
    await user.click(result);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: caseStudy.title }),
    ).toBeInTheDocument();
    expect(
      within(primaryNav()).getByRole('link', { name: 'System Design' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Case studies' })).toBeInTheDocument();
  });
});
