import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOPICS, loadAllTopicBodies } from '@/lib/content';
import { QUESTIONS } from '@/lib/system-design';
import { SearchDialog } from './SearchDialog';

// The dialog's search module is swapped for one whose index is built fresh for
// each test (via the real `createSearchIndex`) over a body loader the test
// controls. That makes "pending", "resolved" and "rejected" deterministic and
// keeps one test's loaded bodies from leaking into the next.
type Index = ReturnType<typeof import('@/lib/search').createSearchIndex>;
const state = vi.hoisted(() => ({
  index: null as unknown as Index,
  ensure: null as unknown as () => Promise<void>,
}));

vi.mock('@/lib/search', async () => {
  const actual = await vi.importActual<typeof import('@/lib/search')>('@/lib/search');
  return {
    ...actual,
    searchContent: (query: string, limit?: number) =>
      state.index.searchContent(query, limit),
    ensureFullTextSearch: () => state.ensure(),
    isFullTextSearchReady: () => state.index.isFullTextSearchReady(),
  };
});

const LOADING = 'Loading full-text search…';
const BODY_ONLY_PHRASE = 'thin vertical slice';
const BODY_ONLY_TOPIC = /Plan Before You Build/i;

let bodies: Map<string, string>;
beforeAll(async () => {
  bodies = await loadAllTopicBodies();
});

interface Gate {
  resolve: () => void;
  reject: (error: Error) => void;
}

let gate: Gate;
let ensureSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  const actual = await vi.importActual<typeof import('@/lib/search')>('@/lib/search');
  const pending = new Promise<Map<string, string>>((resolve, reject) => {
    gate = { resolve: () => resolve(bodies), reject };
  });
  // Rejections are asserted through the UI; keep Node from flagging the promise.
  pending.catch(() => {});
  state.index = actual.createSearchIndex({
    topics: TOPICS,
    questions: QUESTIONS,
    loadTopicBodies: () => pending,
  });
  ensureSpy = vi.fn(() => state.index.ensureFullTextSearch());
  state.ensure = ensureSpy as unknown as () => Promise<void>;
});

function LocationDisplay() {
  return <div data-testid="location-display">{useLocation().pathname}</div>;
}

function renderDialog() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <SearchDialog onClose={onClose} />
      <LocationDisplay />
    </MemoryRouter>,
  );
  return onClose;
}

/** The one polite live region the dialog keeps mounted for load status. */
function statusRegion(): HTMLElement {
  return screen.getByRole('status');
}

function statusText(): string {
  return (statusRegion().textContent ?? '').trim();
}

function box() {
  return screen.getByPlaceholderText(/search topics/i);
}

describe('SearchDialog full-text loading (criterion 8)', () => {
  it('starts loading full-text search when it mounts, before anything is typed', () => {
    renderDialog();
    expect(ensureSpy).toHaveBeenCalledTimes(1);
  });

  it('shows a loading status while pending, with title results available immediately', async () => {
    const user = userEvent.setup();
    renderDialog();

    expect(screen.getByRole('status')).toHaveTextContent(LOADING);

    await user.type(box(), 'prompt engineering');
    expect(
      await screen.findByRole('button', { name: /Prompt Engineering/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(LOADING);
  });

  it('does not match a body-only phrase while pending', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(box(), BODY_ONLY_PHRASE);
    expect(
      await screen.findByText(/no topics match/i, { selector: 'li' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: BODY_ONLY_TOPIC }),
    ).not.toBeInTheDocument();
  });

  it('removes the status and re-runs the current query when full text loads', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(box(), BODY_ONLY_PHRASE);
    expect(
      screen.queryByRole('button', { name: BODY_ONLY_TOPIC }),
    ).not.toBeInTheDocument();

    await act(async () => {
      gate.resolve();
    });

    expect(
      await screen.findByRole('button', { name: BODY_ONLY_TOPIC }),
    ).toBeInTheDocument();
    // The live region stays mounted (so screen readers announce the change and
    // the results don't shift); it just goes quiet.
    await waitFor(() => expect(statusText()).toBe(''));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
  });

  it('finds a body-only phrase typed after full text has loaded', async () => {
    const user = userEvent.setup();
    renderDialog();
    await act(async () => {
      gate.resolve();
    });
    await waitFor(() => expect(statusText()).toBe(''));

    await user.type(box(), BODY_ONLY_PHRASE);
    expect(
      await screen.findByRole('button', { name: BODY_ONLY_TOPIC }),
    ).toBeInTheDocument();
  });

  it('shows an empty status region when full text was already loaded before opening', async () => {
    gate.resolve();
    await state.index.ensureFullTextSearch();
    expect(state.index.isFullTextSearchReady()).toBe(true);

    renderDialog();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(statusText()).toBe('');
    await waitFor(() => expect(statusText()).toBe(''));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
  });

  it('shows the failure message when loading rejects, and title results still work', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    renderDialog();
    await user.type(box(), 'prompt engineering');

    await act(async () => {
      gate.reject(new Error('chunk failed'));
    });

    expect(
      await screen.findByText(
        /Full-text search couldn.t load; showing title and summary matches\./,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(LOADING)).not.toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(statusRegion()).toHaveTextContent(
      /^Full-text search couldn.t load; showing title and summary matches\.$/,
    );
    expect(
      screen.getByRole('button', { name: /Prompt Engineering/i }),
    ).toBeInTheDocument();

    await user.clear(box());
    await user.type(box(), BODY_ONLY_PHRASE);
    expect(
      screen.queryByRole('button', { name: BODY_ONLY_TOPIC }),
    ).not.toBeInTheDocument();
  });
});

describe('SearchDialog status live region', () => {
  it('has exactly one status element from the first render, with the loading text while pending', () => {
    renderDialog();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(statusRegion()).toHaveTextContent(LOADING);
  });

  it('keeps the same DOM node through loading -> ready, emptying its text', async () => {
    renderDialog();
    const before = statusRegion();
    expect(before).toHaveTextContent(LOADING);

    await act(async () => {
      gate.resolve();
    });
    await waitFor(() => expect(statusText()).toBe(''));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(statusRegion()).toBe(before);
    expect(before.isConnected).toBe(true);
  });

  it('keeps the same DOM node through loading -> failed, then shows the failure text', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderDialog();
    const before = statusRegion();

    await act(async () => {
      gate.reject(new Error('chunk failed'));
    });
    await waitFor(() => expect(statusText()).not.toBe(LOADING));

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(statusRegion()).toBe(before);
    expect(before).toHaveTextContent(
      /^Full-text search couldn.t load; showing title and summary matches\.$/,
    );
  });
});

describe('SearchDialog existing behavior with full-text loading (criterion 8)', () => {
  it('keeps its dialog label and placeholder', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: 'Search topics' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search topics...')).toBeInTheDocument();
  });

  it('closes on Escape while full text is still loading', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates and closes when a result is chosen while full text is still loading', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await user.type(box(), 'prompt engineering');
    await user.click(await screen.findByRole('button', { name: /Prompt Engineering/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/ai-and-ml/prompt-engineering',
    );
  });

  it('navigates to a topic found only through its body', async () => {
    const user = userEvent.setup();
    const onClose = renderDialog();
    await act(async () => {
      gate.resolve();
    });
    await user.type(box(), BODY_ONLY_PHRASE);
    await user.click(await screen.findByRole('button', { name: BODY_ONLY_TOPIC }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/engineering-practices/plan-before-you-build',
    );
  });
});
