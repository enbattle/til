import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TOPICS, getTopic } from '@/lib/content';
import {
  QUESTIONS,
  extractTopicRefs,
  questionsForTopic,
  topicsForQuestion,
} from '@/lib/system-design';
import App from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

// --- System Design: a question-first way in alongside the catalog ---

function primaryNav() {
  return screen.getByRole('navigation', { name: 'Primary' });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Links inside <main> that sit outside the rendered markdown body. */
function chromeLinks(main: HTMLElement): HTMLAnchorElement[] {
  return within(main)
    .getAllByRole('link')
    .filter((a) => !a.closest('.prose')) as HTMLAnchorElement[];
}

const firstQuestion = QUESTIONS[0];

describe('header tabs (criteria 10-12)', () => {
  const catalogPaths = ['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/not-found'];
  const systemDesignPaths = ['/system-design', `/system-design/${firstQuestion?.slug}`];

  it.each([...catalogPaths, ...systemDesignPaths])(
    'shows Catalog and System Design tabs at %s',
    async (path) => {
      renderAt(path);
      const nav = primaryNav();
      expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
        'href',
        '/',
      );
      expect(within(nav).getByRole('link', { name: 'System Design' })).toHaveAttribute(
        'href',
        '/system-design',
      );
      expect(screen.getByRole('link', { name: 'til' })).toHaveAttribute('href', '/');
      await screen.findByRole('heading', { level: 1 }).catch(() => undefined);
    },
  );

  it.each(catalogPaths)('marks Catalog current at %s', async (path) => {
    renderAt(path);
    await screen.findByRole('heading', { level: 1 }).catch(() => undefined);
    const nav = primaryNav();
    expect(within(nav).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'System Design' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it.each(systemDesignPaths)('marks System Design current at %s', async (path) => {
    renderAt(path);
    await screen.findByRole('heading', { level: 1 });
    const nav = primaryNav();
    expect(within(nav).getByRole('link', { name: 'System Design' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Catalog' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('switches tabs and sidebars when the Catalog tab is clicked from a question page', async () => {
    const user = userEvent.setup();
    renderAt(`/system-design/${firstQuestion.slug}`);
    await screen.findByRole('heading', { level: 1, name: firstQuestion.title });
    await user.click(within(primaryNav()).getByRole('link', { name: 'Catalog' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'til' }),
    ).toBeInTheDocument();
    expect(within(primaryNav()).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Questions' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the home page unchanged at / (Sections grid still rendered)', () => {
    renderAt('/');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sections' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'til' })).toBeInTheDocument();
  });
});

describe('System Design landing (criterion 13)', () => {
  it('renders exactly one h1 named System Design', () => {
    renderAt('/system-design');
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveAccessibleName('System Design');
  });

  it('is not mistaken for a catalog section page', () => {
    renderAt('/system-design');
    expect(
      screen.queryByRole('heading', { name: /page not found/i }),
    ).not.toBeInTheDocument();
  });

  it('lists one card link per question, in order, each showing its summary', () => {
    renderAt('/system-design');
    const main = screen.getByRole('main');
    const cards = within(main)
      .getAllByRole('link')
      .filter((a) => a.getAttribute('href')?.startsWith('/system-design/'));
    expect(cards).toHaveLength(QUESTIONS.length);
    QUESTIONS.forEach((question, i) => {
      expect(
        cards[i].getAttribute('href')?.endsWith(`/system-design/${question.slug}`),
      ).toBe(true);
      expect(cards[i]).toHaveTextContent(question.title);
      expect(cards[i]).toHaveTextContent(question.summary);
    });
  });

  it('navigates to the question page when a card is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/system-design');
    const main = screen.getByRole('main');
    await user.click(
      within(main).getByRole('link', {
        name: new RegExp(escapeRegExp(firstQuestion.title)),
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: firstQuestion.title }),
    ).toBeInTheDocument();
  });
});

describe('question page (criteria 14-18)', () => {
  it.each(QUESTIONS.map((q) => [q.slug, q] as const))(
    '%s renders one h1 with its title, a back link, and its body',
    async (_slug, question) => {
      renderAt(`/system-design/${question.slug}`);
      await screen.findByRole('heading', { level: 1, name: question.title });
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      const main = screen.getByRole('main');
      expect(within(main).getByRole('link', { name: '← System Design' })).toHaveAttribute(
        'href',
        '/system-design',
      );
      const firstH2 = /^## (.+)$/m.exec(question.body)?.[1].replace(/[`*_]/g, '');
      expect(firstH2).toBeTruthy();
      expect(
        within(main).getByRole('heading', { level: 2, name: firstH2 }),
      ).toBeInTheDocument();
      expect(main).toHaveTextContent(question.date);
    },
  );

  it('routes a body link to the catalog topic page, with Catalog current', async () => {
    const user = userEvent.setup();
    const question = firstQuestion;
    const [topic] = topicsForQuestion(question);
    renderAt(`/system-design/${question.slug}`);
    await screen.findByRole('heading', { level: 1, name: question.title });
    const main = screen.getByRole('main');
    const bodyLink = within(main)
      .getAllByRole('link')
      .find(
        (a) =>
          a.closest('.prose') &&
          a.getAttribute('href') === `/${topic.section}/${topic.slug}`,
      );
    expect(bodyLink).toBeDefined();
    await user.click(bodyLink as HTMLElement);
    expect(
      await screen.findByRole('heading', { level: 1, name: topic.title }),
    ).toBeInTheDocument();
    expect(within(primaryNav()).getByRole('link', { name: 'Catalog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
  });

  it.each(QUESTIONS.map((q) => [q.slug, q] as const))(
    '%s has a "Go deeper" h2 listing each linked topic once, followed by its summary',
    async (_slug, question) => {
      renderAt(`/system-design/${question.slug}`);
      await screen.findByRole('heading', { level: 1, name: question.title });
      const main = screen.getByRole('main');
      const heading = within(main).getByRole('heading', { level: 2, name: 'Go deeper' });
      const topics = topicsForQuestion(question);
      expect(topics.length).toBeGreaterThan(0);

      const after = within(main)
        .getAllByRole('link')
        .filter(
          (a) =>
            heading.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING &&
            !a.getAttribute('href')?.startsWith('/system-design'),
        );
      expect(after.map((a) => a.getAttribute('href'))).toEqual(
        topics.map((t) => `/${t.section}/${t.slug}`),
      );
      after.forEach((link, i) => {
        expect(link).toHaveTextContent(topics[i].title);
        const item = link.closest('li') ?? link.parentElement;
        expect(item).toHaveTextContent(topics[i].summary);
      });
    },
  );

  it.each(QUESTIONS.map((q, i) => [q.slug, i] as const))(
    '%s links to the adjacent questions by order (first has no prev, last has no next)',
    async (_slug, index) => {
      const question = QUESTIONS[index];
      renderAt(`/system-design/${question.slug}`);
      await screen.findByRole('heading', { level: 1, name: question.title });
      const main = screen.getByRole('main');
      const adjacent = chromeLinks(main)
        .map((a) => a.getAttribute('href'))
        .filter((href): href is string => !!href && href.startsWith('/system-design/'));
      const expected = [QUESTIONS[index - 1], QUESTIONS[index + 1]]
        .filter((q) => q !== undefined)
        .map((q) => `/system-design/${q.slug}`);
      expect(adjacent).toEqual(expected);
    },
  );

  it('shows the not-found page for an unknown question slug', async () => {
    renderAt('/system-design/does-not-exist');
    expect(
      await screen.findByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });
});

describe('sidebar selection (criteria 19, 21)', () => {
  it.each(['/system-design', `/system-design/${firstQuestion?.slug}`])(
    'shows Questions, not Sections, in the persistent sidebar at %s',
    async (path) => {
      renderAt(path);
      expect(screen.getByRole('navigation', { name: 'Questions' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Sections' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 });
    },
  );

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/not-found'])(
    'shows Sections, not Questions, in the persistent sidebar at %s',
    async (path) => {
      renderAt(path);
      expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', { name: 'Questions' }),
      ).not.toBeInTheDocument();
      await screen.findByRole('heading', { level: 1 }).catch(() => undefined);
    },
  );

  it('marks the current question in the sidebar and expands only it', async () => {
    const question = QUESTIONS[1];
    renderAt(`/system-design/${question.slug}`);
    await screen.findByRole('heading', { level: 1, name: question.title });
    const nav = screen.getByRole('navigation', { name: 'Questions' });
    expect(within(nav).getByRole('link', { name: question.title })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('button', { name: `Collapse ${question.title}` }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      within(nav).getByRole('button', { name: `Expand ${QUESTIONS[0].title}` }),
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('applies the same scroll-wrapper styling to the Questions sidebar', () => {
    renderAt('/system-design');
    expect(screen.getByRole('navigation', { name: 'Questions' })).toHaveClass(
      'scrollbar-thin',
    );
  });

  it('opens the mobile nav on a system-design route with the question tree, and closes on link click', async () => {
    const user = userEvent.setup();
    renderAt('/system-design');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(
      within(dialog).getByRole('navigation', { name: 'Questions' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('navigation', { name: 'Sections' }),
    ).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('link', { name: QUESTIONS[2].title }));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: QUESTIONS[2].title }),
    ).toBeInTheDocument();
  });

  it('still opens the Sections tree in the mobile nav on a catalog route', async () => {
    const user = userEvent.setup();
    renderAt('/ai-and-ml');
    await user.click(screen.getByRole('button', { name: /menu/i }));
    const dialog = screen.getByRole('dialog', { name: 'Navigation' });
    expect(
      within(dialog).getByRole('navigation', { name: 'Sections' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('navigation', { name: 'Questions' }),
    ).not.toBeInTheDocument();
  });
});

describe('topic page back-links (criterion 22)', () => {
  const linkedKeys = new Set(
    QUESTIONS.flatMap((q) => extractTopicRefs(q.body)).map(
      (r) => `${r.section}/${r.slug}`,
    ),
  );
  const linkedTopic = TOPICS.find((t) => linkedKeys.has(`${t.section}/${t.slug}`));
  const unlinkedTopic = TOPICS.find((t) => !linkedKeys.has(`${t.section}/${t.slug}`));
  const BACKLINKS = 'Questions this topic comes up in';

  it('lists every linking question after the body, before the prev/next nav', async () => {
    expect(linkedTopic).toBeDefined();
    const topic = linkedTopic!;
    const expected = QUESTIONS.filter((q) =>
      extractTopicRefs(q.body).some(
        (r) => r.section === topic.section && r.slug === topic.slug,
      ),
    );
    expect(expected.length).toBeGreaterThan(0);

    renderAt(`/${topic.section}/${topic.slug}`);
    await screen.findByRole('heading', { level: 1, name: topic.title });
    const main = screen.getByRole('main');
    const nav = within(main).getByRole('navigation', { name: BACKLINKS });
    expect(nav).toHaveTextContent('This comes up in:');

    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(
      expected.map((q) => `/system-design/${q.slug}`),
    );
    expect(links.map((a) => a.textContent)).toEqual(expected.map((q) => q.title));
    expect(links.length).toBe(questionsForTopic(topic.section, topic.slug).length);

    const prose = main.querySelector('.prose') as HTMLElement;
    expect(prose).not.toBeNull();
    expect(
      prose.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const other of within(main).getAllByRole('navigation')) {
      if (other === nav) continue;
      expect(
        nav.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('follows a back-link to the question page', async () => {
    const user = userEvent.setup();
    const topic = linkedTopic!;
    const [question] = questionsForTopic(topic.section, topic.slug);
    renderAt(`/${topic.section}/${topic.slug}`);
    await screen.findByRole('heading', { level: 1, name: topic.title });
    const nav = screen.getByRole('navigation', { name: BACKLINKS });
    await user.click(within(nav).getByRole('link', { name: question.title }));
    expect(
      await screen.findByRole('heading', { level: 1, name: question.title }),
    ).toBeInTheDocument();
    expect(
      within(primaryNav()).getByRole('link', { name: 'System Design' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('renders no back-link navigation for a topic no question links', async () => {
    expect(unlinkedTopic).toBeDefined();
    const topic = unlinkedTopic!;
    expect(questionsForTopic(topic.section, topic.slug)).toEqual([]);
    expect(getTopic(topic.section, topic.slug)).toBeDefined();
    renderAt(`/${topic.section}/${topic.slug}`);
    await screen.findByRole('heading', { level: 1, name: topic.title });
    expect(screen.queryByRole('navigation', { name: BACKLINKS })).not.toBeInTheDocument();
    expect(screen.queryByText('This comes up in:')).not.toBeInTheDocument();
  });
});

describe('search finds questions (criterion 23)', () => {
  it('shows a question result labelled System Design and navigates to it, closing the dialog', async () => {
    const user = userEvent.setup();
    const question = QUESTIONS[2];
    renderAt('/');
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByPlaceholderText(/search topics/i), question.title);
    const dialog = screen.getByRole('dialog', { name: /search topics/i });
    const result = await within(dialog).findByRole('button', {
      name: new RegExp(escapeRegExp(question.title)),
    });
    expect(result).toHaveTextContent('System Design');
    await user.click(result);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: question.title }),
    ).toBeInTheDocument();
    expect(
      within(primaryNav()).getByRole('link', { name: 'System Design' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('navigation', { name: 'Questions' })).toBeInTheDocument();
  });
});
