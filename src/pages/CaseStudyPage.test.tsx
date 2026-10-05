import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCaseStudy } from '@/lib/system-design';
import { renderAt } from '@/test/render';

// docs/specs/five-minute-templates.md, criterion 4: the case-study page's meta
// line under the title reads `<date> · <N> min read`, N = max(1, ceil(words /
// 230)), both before and after the lazily loaded body arrives. Every body load
// waits on a gate the test opens, so "before" is checked while it's pending.

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

const DEMO_BODY = '## Requirements\n\nShort demo text.\n';

/** Demo case studies with known word counts; every real one is unchanged. */
const DEMOS = vi.hoisted(() =>
  [
    [1, 1],
    [230, 1],
    [231, 2],
    [1150, 5],
    [1151, 6],
    [6000, 27],
  ].map(([words, minutes], i) => ({
    caseStudy: {
      slug: `demo-${words}-words`,
      title: `Design a Demo of ${words} Words`,
      summary: 'A demo.',
      date: '2026-10-05',
      order: 900 + i,
      words,
    },
    minutes,
  })),
);

vi.mock('@/lib/system-design', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/system-design')>('@/lib/system-design');
  const demo = (slug: string) => DEMOS.find((d) => d.caseStudy.slug === slug)?.caseStudy;
  return {
    ...actual,
    CASE_STUDIES: [...actual.CASE_STUDIES, ...DEMOS.map((d) => d.caseStudy)],
    getCaseStudy: (slug: string) => demo(slug) ?? actual.getCaseStudy(slug),
    loadCaseStudyBody: (slug: string) =>
      gate.wait().then(() => (demo(slug) ? DEMO_BODY : actual.loadCaseStudyBody(slug))),
    topicsForCaseStudy: (caseStudy: { slug: string }) =>
      demo(caseStudy.slug)
        ? []
        : actual.topicsForCaseStudy(
            caseStudy as Parameters<typeof actual.topicsForCaseStudy>[0],
          ),
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

describe('case-study read time (five-minute criterion 4)', () => {
  it.each(DEMOS.map((d) => [d.caseStudy.words, d.minutes, d.caseStudy] as const))(
    'shows "<date> · %i words → %i min read" before and after the body loads',
    async (_words, minutes, caseStudy) => {
      renderAt(`/system-design/${caseStudy.slug}`);
      const expected = `${caseStudy.date} · ${minutes} min read`;

      expect(await metaLine(caseStudy.title)).toBe(expected);
      expect(screen.getByRole('main').querySelector('.prose')).toBeNull();

      gate.open();
      await bodyLoaded();
      expect(await metaLine(caseStudy.title)).toBe(expected);
    },
  );

  it('shows a real case study’s read time from its words, before and after the body loads', async () => {
    const caseStudy = getCaseStudy('url-shortener')!;
    expect(Number.isInteger(caseStudy.words)).toBe(true);
    expect(caseStudy.words).toBeGreaterThan(0);
    const expected = `${caseStudy.date} · ${Math.max(1, Math.ceil(caseStudy.words / 230))} min read`;

    renderAt(`/system-design/${caseStudy.slug}`);
    expect(await metaLine(caseStudy.title)).toBe(expected);

    gate.open();
    await bodyLoaded();
    expect(await metaLine(caseStudy.title)).toBe(expected);
  });
});
