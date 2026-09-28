import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { CaseStudyPage } from './CaseStudyPage';

// Review findings L1 and M2 on the case-study page.
//
// L1: the body is a lazily loaded chunk, so when the page is opened at
// `/system-design/<slug>#<h2 id>` (a shared link to a section), the heading
// doesn't exist yet when the browser tries to jump to it. Once the body has
// rendered, the page must scroll the heading with that id into view itself.
//
// M2: a diagram on its own line must not put block elements inside a <p>.

const ALT = 'Clients call the API, which reads the cache before the database';
const BODY = [
  '## High-level architecture',
  '',
  'Some text.',
  '',
  `![${ALT}](/diagrams/demo/flow.svg)`,
  '',
  '## Trade-offs',
  '',
  'More text.',
  '',
].join('\n');

vi.mock('@/lib/system-design', () => {
  const study = {
    slug: 'demo',
    title: 'Design a Demo',
    summary: 'A demo.',
    date: '2026-09-28',
    order: 1,
  };
  return {
    CASE_STUDIES: [study],
    getCaseStudy: (slug: string) => (slug === 'demo' ? study : undefined),
    loadCaseStudyBody: () => Promise.resolve(BODY),
    topicsForCaseStudy: () => [],
  };
});

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
  localStorage.clear();
});

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/system-design/:slug" element={<CaseStudyPage />} />
          </Routes>
        </ErrorBoundary>
      </ThemeProvider>
    </MemoryRouter>,
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

function nestingErrors(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    args.some(
      (arg) =>
        typeof arg === 'string' &&
        /cannot be a descendant of|cannot contain a nested|validateDOMNesting/i.test(arg),
    ),
  );
}

describe('CaseStudyPage opened at a #section URL (review L1)', () => {
  it('scrolls the h2 whose id matches the hash into view once the body renders', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderPage('/system-design/demo#trade-offs');
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
    renderPage('/system-design/demo');
    await bodyRendered();
    await settle();
    expect(scroll).not.toHaveBeenCalled();
  });

  it('renders normally, without throwing, when the hash matches no element', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    renderPage('/system-design/demo#no-such-section');
    await bodyRendered();
    await settle();
    expect(
      screen.queryByRole('heading', { name: /something went wrong/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Design a Demo' }),
    ).toBeInTheDocument();
    expect(scroll).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('CaseStudyPage diagram on its own line (review M2)', () => {
  it('puts no <div> inside a <p> and reports no DOM nesting error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderPage('/system-design/demo');
    await bodyRendered();
    const img = screen.getByRole('img', { name: ALT });
    // The diagram's outermost element is an ancestor of the img.
    expect(img.closest('p')).toBeNull();
    for (const p of container.querySelectorAll('p')) {
      expect(p.querySelector('div')).toBeNull();
    }
    expect(nestingErrors(error)).toEqual([]);
  });
});
