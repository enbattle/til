import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TOPICS, getTopic, sectionNeighbors } from '@/lib/content';
import { questionsForTopic } from '@/lib/system-design';
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
    renderTopic(`/${SECTION}/${SLUG}`);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'The underlying skill' }),
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
  const BACKLINKS = 'Questions this topic comes up in';
  // A real topic that a question links to and that has a neighbor on each side,
  // so both navigations exist once the body has loaded.
  const topic = TOPICS.find((t) => {
    const { prev, next } = sectionNeighbors(t);
    return questionsForTopic(t.section, t.slug).length > 0 && prev && next;
  })!;
  const { prev, next } = sectionNeighbors(topic);
  const questions = questionsForTopic(topic.section, topic.slug);
  const path = `/${topic.section}/${topic.slug}`;

  it('has a topic that exercises both navigations', () => {
    expect(topic).toBeDefined();
    expect(prev).not.toBeNull();
    expect(next).not.toBeNull();
    expect(questions.length).toBeGreaterThan(0);
  });

  it('renders the header but neither the "This comes up in" nor the prev/next navigation while the body is pending', () => {
    const { promise } = deferred();
    state.override = () => promise;
    renderTopic(path);

    expect(
      screen.getByRole('heading', { level: 1, name: topic.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(topic.date)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: BACKLINKS })).not.toBeInTheDocument();
    expect(screen.queryByText('This comes up in:')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('navigation')).toHaveLength(0);
    // Only the back link to the section remains among the links.
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      `/${topic.section}`,
    ]);
  });

  it('adds both navigations after the body once it loads, in the order body, backlinks, prev/next', async () => {
    const { promise, resolve } = deferred();
    state.override = () => promise;
    renderTopic(path);
    resolve('Layout sentinel paragraph.\n');

    const prose = (await screen.findByText('Layout sentinel paragraph.')).closest(
      '.prose',
    );
    expect(prose).not.toBeNull();
    const backlinks = await screen.findByRole('navigation', { name: BACKLINKS });
    expect(backlinks).toHaveTextContent('This comes up in:');
    const links = within(backlinks).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      questions.map((q) => `/system-design/${q.slug}`),
    );

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
  const B = sectionNeighbors(A).next ?? sectionNeighbors(A).prev!;
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
