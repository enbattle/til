import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getSection } from '@/content/registry';
import { TOPICS, getTopic } from '@/lib/content';
import { parseFrontmatter } from '@/lib/frontmatter';
import { h2Headings } from '@/lib/headings';
import { rawTopic } from '@/test/content';
import { caseStudiesForTopic } from '@/lib/system-design';
import App from '@/App';
import { TopicPage } from './TopicPage';

// `loadTopicBody` is swappable per test; by default it is the real one. A fake
// must hand back the same promise on every call, as the real loader does
// (TopicPage keys its suspense on the memoized promise).
const state = vi.hoisted(() => ({
  override: null as null | ((section: string, slug: string) => Promise<string>),
}));

vi.mock('@/lib/content', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content')>('@/lib/content');
  return {
    ...actual,
    loadTopicBody: (section: string, slug: string) =>
      state.override
        ? state.override(section, slug)
        : actual.loadTopicBody(section, slug),
  };
});

/** The topics before and after `topic` in its own section, in title order:
 * the test's own view, computed from TOPICS rather than the page's helper. */
function siblingsAround(topic: { section: string; slug: string }) {
  const siblings = TOPICS.filter((t) => t.section === topic.section).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  const index = siblings.findIndex((t) => t.slug === topic.slug);
  return {
    prev: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
  };
}

const SECTION = 'ai-and-ml';
const SLUG = 'prompt-engineering';
const TITLE = getTopic(SECTION, SLUG)!.title;

function renderTopic(path: string) {
  // `CodeBlock` (rendered for any body with a fenced block) reads the theme, so
  // the page needs the provider `App` normally supplies.
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ErrorBoundary>
          <Routes>
            <Route path="/not-found" element={<p>Not found marker</p>} />
            <Route path="/:section/:slug" element={<TopicPage />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function deferred() {
  let resolve!: (body: string) => void;
  const promise = new Promise<string>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  state.override = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TopicPage body loading (criterion 9)', () => {
  it('shows the h1, date and back link immediately, without waiting for the body', () => {
    const { promise } = deferred();
    state.override = () => promise;
    renderTopic(`/${SECTION}/${SLUG}`);

    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /AI & Machine Learning/ })).toHaveAttribute(
      'href',
      `/${SECTION}`,
    );
    expect(screen.getByText(getTopic(SECTION, SLUG)!.date)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('renders the body content once the load resolves', async () => {
    const { promise, resolve } = deferred();
    state.override = () => promise;
    renderTopic(`/${SECTION}/${SLUG}`);
    expect(screen.queryByText('Sentinel body paragraph.')).not.toBeInTheDocument();

    resolve('## Sentinel heading\n\nSentinel body paragraph.\n');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sentinel heading' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Sentinel body paragraph.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('asks the loader for exactly this topic', async () => {
    const { promise, resolve } = deferred();
    const loader = vi.fn(() => promise);
    state.override = loader;
    renderTopic(`/${SECTION}/${SLUG}`);
    resolve('Body.\n');
    await screen.findByText('Body.');
    expect(loader).toHaveBeenCalledWith(SECTION, SLUG);
  });

  it('renders the real body of a real topic through the real loader', async () => {
    // The heading is read from the topic's file, not pinned
    // (docs/specs/harness-follow-ups.md, criterion 9).
    const [first] = h2Headings(parseFrontmatter(rawTopic(SECTION, SLUG)).content);
    expect(first).toBeDefined();
    renderTopic(`/${SECTION}/${SLUG}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: first.text }),
    ).toBeInTheDocument();
  });

  it('redirects an unknown slug under a real section to not-found', async () => {
    renderTopic(`/${SECTION}/no-such-topic`);
    expect(await screen.findByText('Not found marker')).toBeInTheDocument();
  });

  it('redirects an unknown section to not-found', async () => {
    renderTopic('/no-such-section/whatever');
    expect(await screen.findByText('Not found marker')).toBeInTheDocument();
  });

  it('shows the error boundary fallback with a Reload button when the body load rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = Promise.reject(new Error('chunk failed'));
    failed.catch(() => {});
    const loader = vi.fn(() => failed);
    state.override = loader;
    renderTopic(`/${SECTION}/${SLUG}`);

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
    expect(loader).toHaveBeenCalledWith(SECTION, SLUG);
  });

  it('shows the same fallback through the whole app when the body load rejects', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = Promise.reject(new Error('chunk failed'));
    failed.catch(() => {});
    const loader = vi.fn(() => failed);
    state.override = loader;
    render(
      <MemoryRouter initialEntries={[`/${SECTION}/${SLUG}`]}>
        <App />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: /something went wrong/i }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument(),
    );
    expect(loader).toHaveBeenCalledWith(SECTION, SLUG);
  });
});

describe('TopicPage layout while the body loads', () => {
  const BACKLINKS = 'Case studies this topic is used in';
  // A real topic that a case study links to and that has a neighbor on each
  // side, so both navigations exist once the body has loaded. Looked up lazily
  // so a missing implementation fails these tests rather than the whole file.
  function fixture() {
    const topic = TOPICS.find((t) => {
      const { prev, next } = siblingsAround(t);
      return caseStudiesForTopic(t.section, t.slug).length > 0 && prev && next;
    })!;
    const { prev, next } = siblingsAround(topic);
    return {
      topic,
      prev,
      next,
      caseStudies: caseStudiesForTopic(topic.section, topic.slug),
      path: `/${topic.section}/${topic.slug}`,
    };
  }

  it('has a topic that exercises both navigations', () => {
    const { topic, prev, next, caseStudies } = fixture();
    expect(topic).toBeDefined();
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(caseStudies.length).toBeGreaterThan(0);
  });

  it('renders the header but neither the case-study back-links nor the prev/next navigation while the body is pending', () => {
    const { topic, path } = fixture();
    const { promise } = deferred();
    state.override = () => promise;
    renderTopic(path);

    expect(
      screen.getByRole('heading', { level: 1, name: topic.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(topic.date)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: BACKLINKS })).not.toBeInTheDocument();
    expect(screen.queryByText('Used in these case studies:')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('navigation')).toHaveLength(0);
    // Only the back link to the section remains among the links.
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      `/${topic.section}`,
    ]);
  });

  it('adds both navigations after the body once it loads, in the order body, backlinks, prev/next', async () => {
    const { topic, prev, next, caseStudies, path } = fixture();
    const { promise, resolve } = deferred();
    state.override = () => promise;
    renderTopic(path);
    resolve('Layout sentinel paragraph.\n');

    const prose = (await screen.findByText('Layout sentinel paragraph.')).closest(
      '.prose',
    );
    expect(prose).not.toBeNull();
    const backlinks = await screen.findByRole('navigation', { name: BACKLINKS });
    expect(backlinks).toHaveTextContent('Used in these case studies:');
    expect(backlinks).not.toHaveTextContent('This comes up in:');
    const links = within(backlinks).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      caseStudies.map((c) => `/system-design/${c.slug}`),
    );
    expect(links.map((a) => a.textContent)).toEqual(caseStudies.map((c) => c.title));

    const pagerLinks = [
      screen.getByRole('link', { name: `← ${prev!.title}` }),
      screen.getByRole('link', { name: `${next!.title} →` }),
    ];
    expect(pagerLinks[0]).toHaveAttribute('href', `/${topic.section}/${prev!.slug}`);
    expect(pagerLinks[1]).toHaveAttribute('href', `/${topic.section}/${next!.slug}`);
    const pager = pagerLinks[0].closest('nav') as HTMLElement;
    expect(pager).not.toBe(backlinks);
    expect(screen.getAllByRole('navigation')).toHaveLength(2);

    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(prose!, backlinks)).toBe(true);
    expect(follows(backlinks, pager)).toBe(true);
  });
});

describe('TopicPage moving between topics', () => {
  const A = getTopic(SECTION, SLUG)!;
  const B = siblingsAround(A).next ?? siblingsAround(A).prev!;
  const A_TEXT = 'Distinctive body text of topic A.';
  const B_TEXT = 'Distinctive body text of topic B.';

  /** One controllable promise per topic, handed back on every call. */
  function perTopicLoader() {
    const gates = new Map<string, ReturnType<typeof deferred>>();
    const gate = (slug: string) => {
      if (!gates.has(slug)) gates.set(slug, deferred());
      return gates.get(slug)!;
    };
    state.override = (_section, slug) => gate(slug).promise;
    return gate;
  }

  function renderWithLinks() {
    return render(
      <ThemeProvider>
        <MemoryRouter initialEntries={[`/${A.section}/${A.slug}`]}>
          <Link to={`/${B.section}/${B.slug}`}>go to B</Link>
          <ErrorBoundary>
            <Routes>
              <Route path="/:section/:slug" element={<TopicPage />} />
            </Routes>
          </ErrorBoundary>
        </MemoryRouter>
      </ThemeProvider>,
    );
  }

  it('picks two different topics', () => {
    expect(B).toBeDefined();
    expect(B.slug).not.toBe(A.slug);
  });

  it("never shows A's loaded body under B's heading while B is still loading", async () => {
    const user = userEvent.setup();
    const gate = perTopicLoader();
    renderWithLinks();
    gate(A.slug).resolve(A_TEXT);
    expect(await screen.findByText(A_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'go to B' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: B.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(A_TEXT)).not.toBeInTheDocument();

    gate(B.slug).resolve(B_TEXT);
    expect(await screen.findByText(B_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(A_TEXT)).not.toBeInTheDocument();
  });

  it("never shows A's body when A's load finishes after navigating to B", async () => {
    const user = userEvent.setup();
    const gate = perTopicLoader();
    renderWithLinks();

    await user.click(screen.getByRole('link', { name: 'go to B' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: B.title }),
    ).toBeInTheDocument();

    await act(async () => {
      gate(A.slug).resolve(A_TEXT);
    });
    expect(screen.queryByText(A_TEXT)).not.toBeInTheDocument();

    gate(B.slug).resolve(B_TEXT);
    expect(await screen.findByText(B_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(A_TEXT)).not.toBeInTheDocument();
  });
});

describe('TopicPage load that rejects with a falsy value', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['0', 0],
    ['an empty string', ''],
  ])(
    'shows the error boundary fallback when the load rejects with %s',
    async (_label, reason) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const failed = Promise.reject(reason);
      failed.catch(() => {});
      state.override = () => failed;
      renderTopic(`/${SECTION}/${SLUG}`);

      expect(
        await screen.findByRole('heading', { name: /something went wrong/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 1, name: TITLE }),
      ).not.toBeInTheDocument();
    },
  );
});

// docs/specs/dedupe-app-scripts-tests.md, criterion 5: the topic page is built
// from the shared PageHeader and PrevNextNav. It renders as before, except that
// the prev/next nav now has an accessible name, "More in <section label>".
describe('TopicPage on the shared header and prev/next nav (dedupe criterion 5)', () => {
  const BACKLINKS = 'Case studies this topic is used in';

  function labelOf(topic: { section: string }): string {
    return getSection(topic.section)!.label;
  }

  async function renderLoaded(topic: { section: string; slug: string }) {
    // One promise, handed back on every call, as the real loader does.
    const body = Promise.resolve('Shared parts sentinel paragraph.\n');
    state.override = () => body;
    renderTopic(`/${topic.section}/${topic.slug}`);
    await screen.findByText('Shared parts sentinel paragraph.');
  }

  /** The navigations other than the case-study back-links. */
  function pagerNavs(): HTMLElement[] {
    return screen
      .queryAllByRole('navigation')
      .filter((nav) => nav.getAttribute('aria-label') !== BACKLINKS);
  }

  it('names the prev/next nav "More in <section label>", holding both neighbours', async () => {
    const topic = TOPICS.find((t) => {
      const { prev, next } = siblingsAround(t);
      return prev && next;
    })!;
    const { prev, next } = siblingsAround(topic);
    await renderLoaded(topic);

    const pager = screen.getByRole('navigation', { name: `More in ${labelOf(topic)}` });
    expect(pagerNavs()).toEqual([pager]);
    expect(
      within(pager)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      [`← ${prev!.title}`, `/${topic.section}/${prev!.slug}`],
      [`${next!.title} →`, `/${topic.section}/${next!.slug}`],
    ]);
  });

  it('keeps the back link, the one h1 and the date in the shared header', async () => {
    const topic = getTopic(SECTION, SLUG)!;
    await renderLoaded(topic);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole('heading', { level: 1, name: topic.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `← ${labelOf(topic)}` })).toHaveAttribute(
      'href',
      `/${SECTION}`,
    );
    expect(screen.getByText(topic.date)).toBeInTheDocument();
  });

  it('shows only "next" on the first topic of a section and only "prev" on the last, in title order', async () => {
    const siblings = TOPICS.filter((t) => t.section === SECTION).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    expect(siblings.length).toBeGreaterThan(2);
    const [first, second] = siblings;
    const [beforeLast, last] = siblings.slice(-2);

    await renderLoaded(first);
    let pager = screen.getByRole('navigation', { name: `More in ${labelOf(first)}` });
    expect(
      within(pager)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([[`${second.title} →`, `/${SECTION}/${second.slug}`]]);
    cleanup();

    await renderLoaded(last);
    pager = screen.getByRole('navigation', { name: `More in ${labelOf(last)}` });
    expect(
      within(pager)
        .getAllByRole('link')
        .map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([[`← ${beforeLast.title}`, `/${SECTION}/${beforeLast.slug}`]]);
  });

  it('renders no prev/next nav for the only topic in its section', async () => {
    const counts = new Map<string, number>();
    for (const t of TOPICS) counts.set(t.section, (counts.get(t.section) ?? 0) + 1);
    const only = TOPICS.find((t) => counts.get(t.section) === 1);
    expect(only, 'a section with exactly one topic').toBeDefined();
    await renderLoaded(only!);

    expect(pagerNavs()).toHaveLength(0);
    expect(
      screen.queryByRole('navigation', { name: `More in ${labelOf(only!)}` }),
    ).not.toBeInTheDocument();
  });
});
