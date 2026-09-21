import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QUESTIONS, topicsForQuestion } from '@/lib/system-design';
import { QuestionNav } from './QuestionNav';

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

function NavigateButton({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to)}>
      go to {to}
    </button>
  );
}

function renderNav(
  initialPath = '/system-design',
  extra: { onNavigate?: () => void; className?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QuestionNav {...extra} />
      <LocationDisplay />
      {QUESTIONS.map((q) => (
        <NavigateButton key={q.slug} to={`/system-design/${q.slug}`} />
      ))}
    </MemoryRouter>,
  );
}

function toggleFor(title: string) {
  return screen.getByRole('button', {
    name: (name) => name === `Expand ${title}` || name === `Collapse ${title}`,
  });
}

function listFor(title: string): HTMLElement {
  const id = toggleFor(title).getAttribute('aria-controls');
  expect(id).toBeTruthy();
  const list = document.getElementById(id as string);
  expect(list).not.toBeNull();
  return list as HTMLElement;
}

function isExpanded(title: string): boolean {
  return toggleFor(title).getAttribute('aria-expanded') === 'true';
}

describe('QuestionNav', () => {
  // --- Criterion 20 ---
  it('is a navigation landmark named Questions', () => {
    renderNav();
    expect(screen.getByRole('navigation', { name: 'Questions' })).toBeInTheDocument();
  });

  it('lists every question as a link to its page, in order', () => {
    renderNav();
    const nav = screen.getByRole('navigation', { name: 'Questions' });
    const links = QUESTIONS.map((q) => within(nav).getByRole('link', { name: q.title }));
    QUESTIONS.forEach((q, i) => {
      expect(links[i]).toHaveAttribute('href', `/system-design/${q.slug}`);
    });
    for (let i = 1; i < links.length; i++) {
      expect(
        links[i - 1].compareDocumentPosition(links[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('gives every question a disclosure button whose aria-controls resolves to its topic list', () => {
    renderNav();
    for (const question of QUESTIONS) {
      const button = toggleFor(question.title);
      expect(button).toHaveAttribute('aria-expanded');
      const list = listFor(question.title);
      expect(list.tagName).toBe('UL');
    }
  });

  it('labels the button Expand <title> when collapsed and Collapse <title> when expanded', async () => {
    const user = userEvent.setup();
    const [first] = QUESTIONS;
    renderNav('/system-design');
    expect(
      screen.getByRole('button', { name: `Expand ${first.title}` }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Expand ${first.title}` }));
    expect(
      screen.getByRole('button', { name: `Collapse ${first.title}` }),
    ).toBeInTheDocument();
  });

  it('lists, under each question, links to /section/slug titled with each topic from topicsForQuestion', () => {
    renderNav();
    for (const question of QUESTIONS) {
      const list = listFor(question.title);
      const topics = topicsForQuestion(question);
      expect(topics.length).toBeGreaterThan(0);
      const links = within(list).getAllByRole('link', { hidden: true });
      expect(links.map((a) => a.getAttribute('href'))).toEqual(
        topics.map((t) => `/${t.section}/${t.slug}`),
      );
      expect(links.map((a) => a.textContent)).toEqual(topics.map((t) => t.title));
    }
  });

  it('starts with every question collapsed at /system-design', () => {
    renderNav('/system-design');
    for (const question of QUESTIONS) {
      expect(isExpanded(question.title)).toBe(false);
    }
  });

  it('starts with only the current question expanded, and its link aria-current="page"', () => {
    const current = QUESTIONS[1];
    renderNav(`/system-design/${current.slug}`);
    for (const question of QUESTIONS) {
      expect(isExpanded(question.title)).toBe(question.slug === current.slug);
    }
    const nav = screen.getByRole('navigation', { name: 'Questions' });
    expect(within(nav).getByRole('link', { name: current.title })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const question of QUESTIONS.filter((q) => q.slug !== current.slug)) {
      expect(within(nav).getByRole('link', { name: question.title })).not.toHaveAttribute(
        'aria-current',
      );
    }
  });

  it('marks no question link current at /system-design', () => {
    renderNav('/system-design');
    const nav = screen.getByRole('navigation', { name: 'Questions' });
    const current = within(nav)
      .getAllByRole('link', { hidden: true })
      .filter((a) => a.hasAttribute('aria-current'));
    expect(current).toHaveLength(0);
  });

  it('shows a non-color signal on the current question link (bold weight plus an accent border)', () => {
    const current = QUESTIONS[0];
    renderNav(`/system-design/${current.slug}`);
    const link = within(screen.getByRole('navigation', { name: 'Questions' })).getByRole(
      'link',
      { name: current.title },
    );
    expect(link).toHaveClass('font-bold');
    expect(link).toHaveClass('border-accent');
  });

  it('toggles only the clicked question, and sets aria-expanded to match', async () => {
    const user = userEvent.setup();
    const [a, b] = QUESTIONS;
    renderNav('/system-design');

    await user.click(toggleFor(a.title));
    expect(isExpanded(a.title)).toBe(true);
    expect(isExpanded(b.title)).toBe(false);

    await user.click(toggleFor(a.title));
    expect(isExpanded(a.title)).toBe(false);
    expect(isExpanded(b.title)).toBe(false);
  });

  it('can collapse the initially expanded current question', async () => {
    const user = userEvent.setup();
    const current = QUESTIONS[2];
    renderNav(`/system-design/${current.slug}`);
    await user.click(toggleFor(current.title));
    expect(isExpanded(current.title)).toBe(false);
  });

  it('hides a collapsed list with the hidden attribute, keeping it in the DOM and out of the accessibility tree', async () => {
    const user = userEvent.setup();
    const [a] = QUESTIONS;
    renderNav('/system-design');
    const list = listFor(a.title);
    expect(list).toHaveAttribute('hidden');
    expect(within(list).queryAllByRole('link')).toHaveLength(0);
    expect(within(list).getAllByRole('link', { hidden: true }).length).toBeGreaterThan(0);

    await user.click(toggleFor(a.title));
    expect(list).not.toHaveAttribute('hidden');
    expect(within(list).getAllByRole('link').length).toBeGreaterThan(0);
  });

  it('expands the newly current question on navigation and leaves the previous one as the user left it (still open)', async () => {
    const user = userEvent.setup();
    const [a, b] = QUESTIONS;
    renderNav(`/system-design/${a.slug}`);
    expect(isExpanded(a.title)).toBe(true);

    await user.click(
      screen.getByRole('button', { name: `go to /system-design/${b.slug}` }),
    );

    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/system-design/${b.slug}`,
    );
    expect(isExpanded(b.title)).toBe(true);
    expect(isExpanded(a.title)).toBe(true);
  });

  it('does not re-expand a question the user collapsed when navigating to a different question', async () => {
    const user = userEvent.setup();
    const [a, b, c] = QUESTIONS;
    renderNav(`/system-design/${a.slug}`);

    await user.click(toggleFor(a.title)); // user collapses the current one
    await user.click(
      screen.getByRole('button', { name: `go to /system-design/${b.slug}` }),
    );

    expect(isExpanded(b.title)).toBe(true);
    expect(isExpanded(a.title)).toBe(false);
    expect(isExpanded(c.title)).toBe(false);
  });

  it('leaves a manually opened question open when navigating elsewhere', async () => {
    const user = userEvent.setup();
    const [a, b, c] = QUESTIONS;
    renderNav(`/system-design/${a.slug}`);

    await user.click(toggleFor(c.title));
    await user.click(
      screen.getByRole('button', { name: `go to /system-design/${b.slug}` }),
    );

    expect(isExpanded(a.title)).toBe(true);
    expect(isExpanded(b.title)).toBe(true);
    expect(isExpanded(c.title)).toBe(true);
  });

  it('calls onNavigate when a question link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const [a] = QUESTIONS;
    renderNav('/system-design', { onNavigate });
    await user.click(screen.getByRole('link', { name: a.title }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/system-design/${a.slug}`,
    );
  });

  it('calls onNavigate when a topic link is clicked, and navigates to the catalog page', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const [a] = QUESTIONS;
    const [topic] = topicsForQuestion(a);
    renderNav(`/system-design/${a.slug}`, { onNavigate });
    const list = listFor(a.title);
    await user.click(within(list).getByRole('link', { name: topic.title }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('location-display')).toHaveTextContent(
      `/${topic.section}/${topic.slug}`,
    );
  });

  it('does not call onNavigate when a disclosure button is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderNav('/system-design', { onNavigate });
    await user.click(toggleFor(QUESTIONS[0].title));
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('applies the className it is given to the nav element', () => {
    renderNav('/system-design', { className: 'my-custom-class' });
    expect(screen.getByRole('navigation', { name: 'Questions' })).toHaveClass(
      'my-custom-class',
    );
  });
});
