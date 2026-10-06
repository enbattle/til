import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from '@/App';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TOPICS } from '@/lib/content';
import { LocationDisplay, renderAt } from '@/test/render';
import { TopicPage } from './TopicPage';

// docs/specs/catalog-standard.md, criterion 6: an old topic URL renders the
// topic at its new path, replacing the old URL in history; an unknown slug
// still goes to /not-found. This file doesn't import the redirect map, so it
// fails on the page's behaviour, not on a missing module.

const MOVED = [
  'context-is-a-budget',
  'documentation-vs-skill-vs-hook',
  'keeping-ai-native-docs-from-going-stale',
  'triaging-ai-code-review',
];

/** The moved topic's title, wherever it lives today. */
function titleOf(slug: string): string {
  const topic = TOPICS.find((t) => t.slug === slug);
  if (!topic) throw new Error(`no topic ${slug}`);
  return topic.title;
}

function Back() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)}>history back</button>;
}

/** The topic route behind a previous entry at `/`, so `replace` versus `push`
 * shows in where "back" lands. */
function renderTopic(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={['/', path]} initialIndex={1}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<p>Home marker</p>} />
            <Route path="/not-found" element={<p>Not found marker</p>} />
            <Route path="/:section/:slug" element={<TopicPage />} />
          </Routes>
        </ErrorBoundary>
        <LocationDisplay />
        <Back />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

const location = () => screen.getByTestId('location-display').textContent;

/** The whole location, search and hash included. */
function FullLocation() {
  const { pathname, search, hash } = useLocation();
  return <div data-testid="full-location">{`${pathname}${search}${hash}`}</div>;
}

describe('TopicPage redirects (catalog-standard criterion 6)', () => {
  it.each(MOVED)(
    'renders /ai-and-ml/%s as the topic at /coding-agents/<slug>',
    async (slug) => {
      renderTopic(`/ai-and-ml/${slug}`);
      expect(
        await screen.findByRole('heading', { level: 1, name: titleOf(slug) }),
      ).toBeInTheDocument();
      expect(location()).toBe(`/coding-agents/${slug}`);
      expect(screen.queryByText('Not found marker')).not.toBeInTheDocument();
    },
  );

  it('replaces the old URL rather than pushing the new one', async () => {
    const user = userEvent.setup();
    const [slug] = MOVED;
    renderTopic(`/ai-and-ml/${slug}`);
    await screen.findByRole('heading', { level: 1, name: titleOf(slug) });
    expect(location()).toBe(`/coding-agents/${slug}`);

    await user.click(screen.getByRole('button', { name: 'history back' }));
    expect(await screen.findByText('Home marker')).toBeInTheDocument();
    expect(location()).toBe('/');
  });

  it('still sends an unknown slug to /not-found', async () => {
    renderTopic('/ai-and-ml/no-such-topic');
    expect(await screen.findByText('Not found marker')).toBeInTheDocument();
    expect(location()).toBe('/not-found');
  });

  it('still sends a moved slug under the wrong section to /not-found', async () => {
    renderTopic(`/security/${MOVED[0]}`);
    expect(await screen.findByText('Not found marker')).toBeInTheDocument();
  });

  it("keeps the old URL's ?query and #hash on a hard load", async () => {
    const [slug] = MOVED;
    render(
      <MemoryRouter initialEntries={[`/ai-and-ml/${slug}?q=1#keeping-it-lean`]}>
        <App />
        <FullLocation />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: titleOf(slug) });
    // The fragment is a real heading on the moved page.
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Keeping it lean' }),
    ).toHaveAttribute('id', 'keeping-it-lean');
    expect(screen.getByTestId('full-location').textContent).toBe(
      `/coding-agents/${slug}?q=1#keeping-it-lean`,
    );
  });

  it('redirects through the whole app too', async () => {
    const [slug] = MOVED;
    renderAt(`/ai-and-ml/${slug}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: titleOf(slug) }),
    ).toBeInTheDocument();
    expect(location()).toBe(`/coding-agents/${slug}`);
  });
});
