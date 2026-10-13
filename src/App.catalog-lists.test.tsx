import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SECTIONS } from '@/content/registry';
import { TOPICS, recentTopics } from '@/lib/content';
import { renderAt } from '@/test/render';

// docs/specs/ui-dedupe.md, criterion 5: the home and section pages list the
// same topics and counts as before, now from one grouping helper and
// TOPICS.length (every topic is in a registered section: registry.test.ts).
// The expected lists are the test's own, filtered from TOPICS.

const route = (t: { section: string; slug: string }) => `/${t.section}/${t.slug}`;
const inSection = (slug: string) => TOPICS.filter((t) => t.section === slug);
const plural = (n: number) => `${n} ${n === 1 ? 'topic' : 'topics'}`;

function sectionsGrid() {
  const heading = screen.getByRole('heading', { level: 2, name: 'Sections' });
  return heading.closest('section') as HTMLElement;
}

function recentList() {
  const heading = screen.getByRole('heading', { level: 2, name: 'Recently added' });
  return heading.closest('section') as HTMLElement;
}

describe('home page lists', () => {
  it('gives the total topic count in the intro', () => {
    renderAt('/');
    const h1 = screen.getByRole('heading', { level: 1, name: 'til' });
    const intro = h1.nextElementSibling;
    // Whole number only: "51 topics" mustn't pass inside "151 topics".
    expect(intro?.textContent).toMatch(
      new RegExp(`(^|\\s)${plural(TOPICS.length)} so far`),
    );
  });

  it('shows one card per registered section, in order, each linking to the section with its topic count', () => {
    renderAt('/');
    const cards = within(sectionsGrid()).getAllByRole('link');
    expect(cards.map((a) => a.getAttribute('href'))).toEqual(
      SECTIONS.map((s) => `/${s.slug}`),
    );
    SECTIONS.forEach((section, i) => {
      expect(cards[i]).toHaveTextContent(section.label);
      // The count is its own element, so "1 topic" can't match "11 topics".
      const counts = [...cards[i].querySelectorAll('span')].map((el) => el.textContent);
      expect(counts).toEqual([plural(inSection(section.slug).length)]);
    });
  });

  it('lists the five most recent topics, newest first', () => {
    renderAt('/');
    const links = within(recentList()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(recentTopics(5).map(route));
  });
});

describe('section pages', () => {
  it.each(SECTIONS.map((s) => [s.slug, s] as const))(
    '/%s lists its topics in title order, each linking to its page',
    (slug, section) => {
      renderAt(`/${slug}`);
      expect(
        screen.getByRole('heading', { level: 1, name: section.label }),
      ).toBeInTheDocument();
      const expected = inSection(slug);
      expect(expected.length).toBeGreaterThan(0);
      const links = within(screen.getByRole('main')).getAllByRole('link');
      expect(links.map((a) => a.getAttribute('href'))).toEqual(expected.map(route));
      links.forEach((link, i) => {
        expect(link).toHaveTextContent(expected[i].title);
        expect(link).toHaveTextContent(expected[i].summary);
      });
    },
  );
});

// docs/specs/ui-dedupe.md, criterion 2: a topic card links to `topic.path`.
describe('topic cards link to topic.path', () => {
  it('on the home page’s Recently added list', () => {
    renderAt('/');
    const links = within(recentList()).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      recentTopics(5).map((t) => t.path),
    );
  });

  it('on a section page', () => {
    const [section] = SECTIONS;
    renderAt(`/${section.slug}`);
    const links = within(screen.getByRole('main')).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      inSection(section.slug).map((t) => t.path),
    );
  });
});
