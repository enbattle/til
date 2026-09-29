import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { getTopic } from '@/lib/content';
import { TopicPage } from './TopicPage';

// Review finding L1 on the topic page: the body is a lazily loaded chunk, so
// when the page is opened at `/<section>/<slug>#<h2 id>` the heading doesn't
// exist yet when the browser tries to jump to it. Once the body has rendered,
// the page must scroll the heading with that id into view itself.

const BODY = '## First part\n\nText.\n\n## Trade-offs\n\nMore text.\n';

vi.mock('@/lib/content', async () => {
  const actual = await vi.importActual<typeof import('@/lib/content')>('@/lib/content');
  return { ...actual, loadTopicBody: () => Promise.resolve(BODY) };
});

const SECTION = 'ai-and-ml';
const SLUG = 'prompt-engineering';

// jsdom doesn't implement scrollIntoView; give it a no-op to spy on.
const hadScrollIntoView = 'scrollIntoView' in Element.prototype;
beforeEach(() => {
  if (!('scrollIntoView' in Element.prototype)) {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      value: function scrollIntoView() {},
      configurable: true,
      writable: true,
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  if (!hadScrollIntoView) {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

function renderTopic(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <ErrorBoundary>
          <Routes>
            <Route path="/:section/:slug" element={<TopicPage />} />
          </Routes>
        </ErrorBoundary>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

function bodyRendered() {
  return screen.findByRole('heading', { level: 2, name: 'Trade-offs' });
}

/** Let any pending effects, timers and microtasks run. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('TopicPage opened at a #section URL (review L1)', () => {
  it('uses a real topic', () => {
    expect(getTopic(SECTION, SLUG)).toBeDefined();
  });

  it('scrolls the h2 whose id matches the hash into view once the body renders', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderTopic(`/${SECTION}/${SLUG}#trade-offs`);
    const heading = await bodyRendered();
    expect(heading.id).toBe('trade-offs');
    await waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts).toContain(heading);
    for (const element of scroll.mock.contexts) {
      expect((element as Element).id).toBe('trade-offs');
    }
  });

  it('does not scroll anything into view when the URL has no hash', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderTopic(`/${SECTION}/${SLUG}`);
    await bodyRendered();
    await settle();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('renders normally, without throwing, when the hash matches no element', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderTopic(`/${SECTION}/${SLUG}#no-such-section`);
    await bodyRendered();
    await settle();
    expect(
      screen.queryByRole('heading', { name: /something went wrong/i }),
    ).not.toBeInTheDocument();
    expect(scroll).not.toHaveBeenCalled();
  });
});
