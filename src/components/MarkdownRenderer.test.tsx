import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { MarkdownRenderer } from './MarkdownRenderer';

function renderMarkdown(content: string) {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <MarkdownRenderer content={content} />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('MarkdownRenderer', () => {
  // Regression test: a site-root-relative link (how topics link to each
  // other) must go through react-router's `Link`, not a plain `<a>` — a
  // plain `<a>` ignores the GitHub Pages `/til/` basename and forces a full
  // page reload. See the `a` override in MarkdownRenderer.tsx.
  it('routes an internal link through react-router instead of a plain <a>', () => {
    renderMarkdown('See [prompt engineering](/ai-and-ml/prompt-engineering).');
    const link = screen.getByRole('link', { name: 'prompt engineering' });
    expect(link).toHaveAttribute('href', '/ai-and-ml/prompt-engineering');
    // The external-link branch always sets target="_blank"; its absence
    // here confirms this went through the internal-link branch instead.
    expect(link).not.toHaveAttribute('target');
  });

  it('opens an external link in a new tab', () => {
    renderMarkdown('See [Shiki](https://shiki.style).');
    const link = screen.getByRole('link', { name: 'Shiki' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  // At-a-glance spec, criterion 5: an in-page `#…` link (how a case study's
  // At a glance section links into its own sections) stays in the same tab
  // as a plain anchor, so the browser scrolls to the heading id natively.
  it('renders an in-page #id link as a plain same-tab <a>, with no target or rel', () => {
    const { container } = renderMarkdown('## Some id\n\nSee [the section](#some-id).');
    const link = screen.getByRole('link', { name: 'the section' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '#some-id');
    expect(link).not.toHaveAttribute('target');
    expect(link).not.toHaveAttribute('rel');
    expect(container.querySelector('#some-id')).not.toBeNull();
  });

  it('still routes / links through Link and opens https links in a new tab, beside a # link', () => {
    renderMarkdown(
      'See [here](#x), [a topic](/ai-and-ml/prompt-engineering) and [Shiki](https://shiki.style).',
    );
    const internal = screen.getByRole('link', { name: 'a topic' });
    expect(internal).toHaveAttribute('href', '/ai-and-ml/prompt-engineering');
    expect(internal).not.toHaveAttribute('target');
    const external = screen.getByRole('link', { name: 'Shiki' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noreferrer');
    const anchor = screen.getByRole('link', { name: 'here' });
    expect(anchor).toHaveAttribute('href', '#x');
    expect(anchor).not.toHaveAttribute('target');
  });

  it('renders inline code distinctly from a fenced code block', () => {
    renderMarkdown('Use `git status` to check.');
    expect(screen.getByText('git status').tagName).toBe('CODE');
  });

  // Regression test: fence tags in topic bodies use shorthand (```sh, ```js,
  // ```ts) that must resolve through the highlighter's alias table — this
  // renders the actual CodeBlock (not a mock) so a broken alias would make
  // this hang or throw instead of ever showing the copy button.
  it('renders a fenced code block through CodeBlock with a copy button', () => {
    renderMarkdown(['```sh', 'git worktree list', '```'].join('\n'));
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  // Regression test: TopicPage renders its own page-level <h1> (the topic
  // title). A body that opens with a markdown `# heading` must not produce
  // a second one — see the `h1` override in MarkdownRenderer.tsx.
  it('demotes a body-level h1 to h2 so a topic page never ends up with two h1s', () => {
    renderMarkdown('# Should not be a page h1\n\nBody text.');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Should not be a page h1' }),
    ).toBeInTheDocument();
  });
});

describe('MarkdownRenderer diagram images (criterion 13)', () => {
  const ALT = 'Clients call the API, which reads the cache before the database';

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.unstubAllEnvs();
  });

  function diagram() {
    renderMarkdown(`Intro.\n\n![${ALT}](/diagrams/x/y.svg)\n`);
    return screen.getByRole('img', { name: ALT }) as HTMLImageElement;
  }

  // Under Vitest `import.meta.env.BASE_URL` is `/`; the deployed site uses `/til/`
  // (checked separately below with a stubbed env).
  it('renders the light SVG in light theme, prefixed with the base path, keeping its alt', () => {
    localStorage.setItem('til-theme', 'light');
    const img = diagram();
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('alt', ALT);
    expect(img.getAttribute('src')).toBe(
      `${import.meta.env.BASE_URL}diagrams/x/y.light.svg`,
    );
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('sizes a rendered diagram from the build manifest', () => {
    // A real rendered diagram, so the manifest has its size.
    renderMarkdown(`![${ALT}](/diagrams/url-shortener/architecture.svg)\n`);
    const img = screen.getByRole('img', { name: ALT });
    expect(Number(img.getAttribute('width'))).toBeGreaterThan(0);
    expect(Number(img.getAttribute('height'))).toBeGreaterThan(0);
  });

  it('renders the dark SVG in dark theme', () => {
    localStorage.setItem('til-theme', 'dark');
    const img = diagram();
    expect(img.getAttribute('src')).toBe(
      `${import.meta.env.BASE_URL}diagrams/x/y.dark.svg`,
    );
    expect(img).toHaveAttribute('alt', ALT);
  });

  it('prefixes a non-root base path (read at render time, not at module load)', () => {
    vi.stubEnv('BASE_URL', '/til/');
    localStorage.setItem('til-theme', 'dark');
    expect(diagram().getAttribute('src')).toBe('/til/diagrams/x/y.dark.svg');
  });

  it('wraps it in a new-tab rel="noreferrer" link to the full-size SVG, named for opening it', () => {
    localStorage.setItem('til-theme', 'light');
    const img = diagram();
    const link = img.closest('a');
    expect(link).not.toBeNull();
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(link!.getAttribute('href')).toMatch(
      new RegExp(`^${import.meta.env.BASE_URL}diagrams/x/y\\.(light|dark)\\.svg$`),
    );
    expect(screen.getByRole('link', { name: /Open diagram full size/i })).toBe(link);
    expect(within(link!).getByRole('img', { name: ALT })).toBe(img);
  });

  it('renders an external image unchanged, without a wrapping link', () => {
    renderMarkdown('![A remote picture](https://example.com/picture.png)');
    const img = screen.getByRole('img', { name: 'A remote picture' });
    expect(img).toHaveAttribute('src', 'https://example.com/picture.png');
    expect(img.closest('a')).toBeNull();
    expect(
      screen.queryByRole('link', { name: /Open diagram full size/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a root-relative image outside /diagrams/ unchanged', () => {
    renderMarkdown('![A local picture](/images/photo.png)');
    const img = screen.getByRole('img', { name: 'A local picture' });
    expect(img).toHaveAttribute('src', '/images/photo.png');
    expect(img.closest('a')).toBeNull();
  });
});

/** Whether a console.error call is React reporting invalid DOM nesting. */
function nestingErrors(spy: { mock: { calls: unknown[][] } }) {
  return spy.mock.calls.filter((args) =>
    args.some(
      (arg) =>
        typeof arg === 'string' &&
        /cannot be a descendant of|cannot contain a nested|validateDOMNesting/i.test(arg),
    ),
  );
}

describe('MarkdownRenderer diagram on its own line (review M2)', () => {
  // `![alt](/diagrams/x/y.svg)` on its own line is a markdown paragraph, so
  // react-markdown wraps it in <p>. The diagram renders block elements (its
  // scroll box, and a region while it overflows), which are invalid inside
  // a <p>: the browser's parser would split the paragraph, and React reports
  // the bad nesting.
  const ALT = 'Clients call the API, which reads the cache before the database';
  const CONTENT = `Intro paragraph.\n\n![${ALT}](/diagrams/x/y.svg)\n\nOutro paragraph.\n`;

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function assertNoBlockInParagraph(container: HTMLElement) {
    const img = screen.getByRole('img', { name: ALT });
    // The diagram's outermost element is an ancestor of the img, so if the
    // img has no <p> ancestor, neither does any part of the diagram.
    expect(img.closest('p')).toBeNull();
    for (const p of container.querySelectorAll('p')) {
      expect(p.querySelector('div')).toBeNull();
    }
  }

  it('renders no <div> inside a <p> and reports no DOM nesting error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = renderMarkdown(CONTENT);
    assertNoBlockInParagraph(container);
    expect(nestingErrors(error)).toEqual([]);
  });

  it('keeps the diagram out of a <p> while it overflows (the region case)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const { container } = renderMarkdown(CONTENT);
    // Wait until the diagram has measured itself and become a region.
    await screen.findByRole('region');
    assertNoBlockInParagraph(container);
    expect(screen.getByRole('region').closest('p')).toBeNull();
    expect(nestingErrors(error)).toEqual([]);
  });

  it('keeps the surrounding text paragraphs', () => {
    renderMarkdown(CONTENT);
    expect(screen.getByText('Intro paragraph.').tagName).toBe('P');
    expect(screen.getByText('Outro paragraph.').tagName).toBe('P');
  });
});

describe('Diagram accessible names do not repeat the alt text (review L4)', () => {
  // The img's own alt is the canonical description. The link and (while the
  // box overflows) the region may each have a name, but the full alt text
  // must appear in at most one of those accessible names, or a screen reader
  // reads it twice in a row.
  const ALT = 'Clients call the API, which reads the cache before the database';

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  /** The computed accessible name of every element with `role`. */
  function names(role: 'link' | 'region') {
    const found: string[] = [];
    screen.queryAllByRole(role, {
      name: (name) => {
        found.push(name);
        return true;
      },
    });
    return found;
  }

  it('names the alt text in at most one of the link and the region, while it overflows', async () => {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    renderMarkdown(`![${ALT}](/diagrams/x/y.svg)\n`);
    await screen.findByRole('region');
    const all = [...names('link'), ...names('region')];
    expect(all).toHaveLength(2);
    expect(all.filter((name) => name.includes(ALT)).length).toBeLessThanOrEqual(1);
    // The link keeps a name that says what it does.
    expect(
      screen.getByRole('link', { name: /Open diagram full size/i }),
    ).toBeInTheDocument();
  });

  it('names the alt text in at most one accessible name when it fits', () => {
    renderMarkdown(`![${ALT}](/diagrams/x/y.svg)\n`);
    const all = [...names('link'), ...names('region')];
    expect(all.filter((name) => name.includes(ALT)).length).toBeLessThanOrEqual(1);
    expect(
      screen.getByRole('link', { name: /Open diagram full size/i }),
    ).toBeInTheDocument();
  });
});

describe('MarkdownRenderer tables never scroll the page sideways (retro)', () => {
  // A wide GFM table must scroll inside its own box, not make the whole page
  // scroll sideways at 375px. So every table sits directly inside a
  // horizontally scrolling wrapper. Following the diagram precedent
  // (`Diagram.tsx`), the wrapper is a focusable, labelled region ("Table,
  // scrolls sideways", like "Diagram, scrolls sideways") only while it
  // actually overflows, so a keyboard user can scroll it with the arrow keys
  // and a table that fits adds no tab stop. jsdom has no layout, so overflow
  // is simulated by spying on scrollWidth/clientWidth, as the diagram tests do.
  const TABLE = [
    'Before the table.',
    '',
    '| Option | Read cost | Write cost |',
    '| --- | --- | --- |',
    '| Cache-aside | One lookup | Invalidate |',
    '| Write-through | One lookup | Two writes |',
    '',
    'After the table.',
    '',
  ].join('\n');

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  function table() {
    return screen.getByRole('table');
  }

  it('wraps the table in a horizontally scrolling box and leaves the table unchanged', () => {
    const { container } = renderMarkdown(TABLE);
    const wrapper = table().parentElement!;
    // Not the prose container itself: a wrapper just for this table.
    expect(wrapper).not.toBe(container.querySelector('.prose'));
    expect(wrapper.children).toHaveLength(1);
    expect(wrapper.className).toMatch(/\boverflow-x-(auto|scroll)\b/);
    // The table itself is still a plain table with its header and rows.
    expect(table().tagName).toBe('TABLE');
    expect(within(table()).getAllByRole('row')).toHaveLength(3);
    expect(
      within(table()).getByRole('columnheader', { name: 'Read cost' }),
    ).toBeVisible();
    expect(within(table()).getByRole('cell', { name: 'Two writes' })).toBeVisible();
  });

  it('adds no region or tab stop while the table fits', () => {
    renderMarkdown(TABLE);
    const wrapper = table().parentElement!;
    expect(screen.queryByRole('region')).toBeNull();
    expect(wrapper).not.toHaveAttribute('tabindex');
  });

  it('is a focusable region named "Table, scrolls sideways" while it overflows', async () => {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    renderMarkdown(TABLE);
    const region = await screen.findByRole('region', { name: 'Table, scrolls sideways' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(table().parentElement).toBe(region);
    expect(within(region).getAllByRole('row')).toHaveLength(3);
  });

  it('wraps every table, each in its own box', async () => {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(1000);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300);
    renderMarkdown(`${TABLE}\n${TABLE}`);
    await screen.findAllByRole('region', { name: 'Table, scrolls sideways' });
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    const regions = screen.getAllByRole('region', { name: 'Table, scrolls sideways' });
    expect(regions).toHaveLength(2);
    tables.forEach((t, i) => expect(t.parentElement).toBe(regions[i]));
  });

  it('keeps the table out of a <p> and reports no DOM nesting error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderMarkdown(TABLE);
    expect(table().closest('p')).toBeNull();
    expect(nestingErrors(error)).toEqual([]);
  });
});
