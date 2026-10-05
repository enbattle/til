import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dsaKindLabel, getDsaEntry } from '@/lib/dsa';
import { renderAt } from '@/test/render';

// docs/specs/five-minute-templates.md, criterion 5: the DSA entry page's meta
// line under the title reads `<kind label> · <date> · <N> min read`, N =
// max(1, ceil(words / 230)), both before and after the lazily loaded body
// arrives. Every body load waits on a gate the test opens.

const gate = vi.hoisted(() => {
  const state = { release: () => {}, opened: Promise.resolve() };
  return {
    close() {
      state.opened = new Promise<void>((resolve) => {
        state.release = resolve;
      });
    },
    open() {
      state.release();
    },
    wait() {
      return state.opened;
    },
  };
});

const DEMO_BODY = '## Prerequisites\n\nNone.\n';

/** Demo entries with known kinds and word counts; every real one is
 * unchanged. */
const DEMOS = vi.hoisted(() =>
  (
    [
      ['data-structure', 'Data structure', 231, 2],
      ['pattern', 'Pattern', 1150, 5],
      ['algorithm', 'Algorithm', 1151, 6],
      ['pattern', 'Pattern', 1, 1],
    ] as const
  ).map(([kind, label, words, minutes]) => ({
    entry: {
      slug: `demo-${kind}-${words}`,
      title: `Demo ${label} of ${words} Words`,
      summary: 'A demo.',
      date: '2026-10-05',
      kind,
      words,
    },
    label,
    minutes,
  })),
);

vi.mock('@/lib/dsa', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dsa')>('@/lib/dsa');
  const demo = (slug: string) => DEMOS.find((d) => d.entry.slug === slug)?.entry;
  return {
    ...actual,
    DSA_ENTRIES: [...actual.DSA_ENTRIES, ...DEMOS.map((d) => d.entry)],
    getDsaEntry: (slug: string) => demo(slug) ?? actual.getDsaEntry(slug),
    loadDsaEntryBody: (slug: string) =>
      gate.wait().then(() => (demo(slug) ? DEMO_BODY : actual.loadDsaEntryBody(slug))),
  };
});

beforeEach(() => {
  gate.close();
});

afterEach(() => {
  gate.open();
});

/** The text of the meta line: the paragraph right under the page's h1. */
async function metaLine(title: string): Promise<string> {
  const h1 = await screen.findByRole('heading', { level: 1, name: title });
  const meta = h1.nextElementSibling;
  expect(meta?.tagName).toBe('P');
  return (meta?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function bodyLoaded() {
  const main = screen.getByRole('main');
  await waitFor(() => expect(main.querySelector('.prose')).not.toBeNull());
}

describe('DSA entry read time (five-minute criterion 5)', () => {
  it.each(DEMOS.map((d) => [d.label, d.entry.words, d.minutes, d.entry] as const))(
    'shows "%s · <date> · N min read" for %i words (%i min), before and after the body loads',
    async (label, _words, minutes, entry) => {
      renderAt(`/dsa/${entry.slug}`);
      const expected = `${label} · ${entry.date} · ${minutes} min read`;

      expect(await metaLine(entry.title)).toBe(expected);
      expect(screen.getByRole('main').querySelector('.prose')).toBeNull();

      gate.open();
      await bodyLoaded();
      expect(await metaLine(entry.title)).toBe(expected);
    },
  );

  it('shows a real entry’s read time from its words', async () => {
    const entry = getDsaEntry('binary-search')!;
    expect(Number.isInteger(entry.words)).toBe(true);
    expect(entry.words).toBeGreaterThan(0);
    const minutes = Math.max(1, Math.ceil(entry.words / 230));
    const expected = `${dsaKindLabel(entry.kind)} · ${entry.date} · ${minutes} min read`;

    renderAt(`/dsa/${entry.slug}`);
    expect(await metaLine(entry.title)).toBe(expected);

    gate.open();
    await bodyLoaded();
    expect(await metaLine(entry.title)).toBe(expected);
  });
});
