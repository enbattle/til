import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { QUESTIONS, topicsForQuestion } from '@/lib/system-design';
import { MobileNav } from './MobileNav';

function renderMobileNav(initialPath = '/') {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <MobileNav onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

describe('MobileNav', () => {
  // --- Criterion 21: system-design routes show the question tree ---
  describe('on a system-design route', () => {
    it.each(['/system-design', `/system-design/${QUESTIONS[0]?.slug}`])(
      'renders the Questions nav, not the Sections nav, inside the dialog at %s',
      (path) => {
        renderMobileNav(path);
        const dialog = screen.getByRole('dialog', { name: 'Navigation' });
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        const nav = within(dialog).getByRole('navigation', { name: 'Questions' });
        for (const question of QUESTIONS) {
          expect(within(nav).getByRole('link', { name: question.title })).toHaveAttribute(
            'href',
            `/system-design/${question.slug}`,
          );
        }
        expect(
          screen.queryByRole('navigation', { name: 'Sections' }),
        ).not.toBeInTheDocument();
      },
    );

    it('reveals a question’s topics once its disclosure button is expanded', async () => {
      const user = userEvent.setup();
      renderMobileNav('/system-design');
      const [question] = QUESTIONS;
      const [topic] = topicsForQuestion(question);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      expect(
        within(dialog).queryByRole('link', { name: topic.title }),
      ).not.toBeInTheDocument();
      await user.click(
        within(dialog).getByRole('button', { name: `Expand ${question.title}` }),
      );
      expect(
        within(dialog).getAllByRole('link', { name: topic.title }).length,
      ).toBeGreaterThan(0);
    });

    it('closes when a question link is clicked', async () => {
      const user = userEvent.setup();
      const onClose = renderMobileNav('/system-design');
      await user.click(screen.getByRole('link', { name: QUESTIONS[0].title }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes when a topic link inside a question is clicked', async () => {
      const user = userEvent.setup();
      const question = QUESTIONS[0];
      const [topic] = topicsForQuestion(question);
      const onClose = renderMobileNav(`/system-design/${question.slug}`);
      const dialog = screen.getByRole('dialog', { name: 'Navigation' });
      await user.click(within(dialog).getAllByRole('link', { name: topic.title })[0]);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the panel but not on a link', async () => {
      const user = userEvent.setup();
      const onClose = renderMobileNav('/system-design');
      await user.click(screen.getByRole('navigation', { name: 'Questions' }));
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  it('still renders the Sections nav, not Questions, on a catalog route', () => {
    renderMobileNav('/ai-and-ml/prompt-engineering');
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(
      within(dialog).getByRole('navigation', { name: 'Sections' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Questions' }),
    ).not.toBeInTheDocument();
  });
});
