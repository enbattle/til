import { createElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { proseWordCount } from '@/lib/markdown.mjs';

// Shared support for the content-structure tests (case studies and catalog
// topics; docs/specs/content-dedupe.md, design item 4). Each test
// keeps its own rules; this is only the plumbing they used to copy.

/** `body` rendered with the real `MarkdownRenderer`, as its page renders it. */
export function renderBody(body: string): HTMLElement {
  const { container } = render(
    createElement(
      MemoryRouter,
      null,
      createElement(
        ThemeProvider,
        null,
        createElement(MarkdownRenderer, { content: body }),
      ),
    ),
  );
  return container;
}

/** The blocks after `h2`, up to the next `h2`. */
export function blocksAfter(h2: Element): Element[] {
  const blocks: Element[] = [];
  for (let el = h2.nextElementSibling; el && el.tagName !== 'H2';) {
    blocks.push(el);
    el = el.nextElementSibling;
  }
  return blocks;
}

/** The blocks after the `h2` titled `heading`, up to the next `h2`; `null`
 * when there's no such `h2`. */
export function section(page: HTMLElement, heading: string): Element[] | null {
  const h2 = [...page.querySelectorAll('h2')].find(
    (h) => h.textContent?.trim() === heading,
  );
  return h2 ? blocksAfter(h2) : null;
}

/** [] when `body` has at most `budget` prose words (`proseWordCount`), else
 * one problem naming the count: "2301 words, over the 2300-word budget", or
 * with `name` "…the 1000-word catalog budget". */
export function wordBudgetProblems(body: string, budget: number, name = ''): string[] {
  const words = proseWordCount(body);
  return words <= budget
    ? []
    : [`${words} words, over the ${budget}-word ${name ? `${name} ` : ''}budget`];
}

/** Problems with `file`'s frontmatter keys: each key in neither `required`
 * nor `optional`, and each `required` key that's missing, naming the file and
 * the key. The loaders reject the same files at load time (`checkFields`);
 * this keeps the structure tests' own check independent of them. */
export function frontmatterProblems(
  file: string,
  data: Record<string, string>,
  required: readonly string[],
  optional: readonly string[] = [],
): string[] {
  const keys = Object.keys(data);
  return [
    ...keys
      .filter((key) => !required.includes(key) && !optional.includes(key))
      .map((key) => `${file}: unexpected frontmatter key "${key}"`),
    ...required
      .filter((key) => !keys.includes(key))
      .map((key) => `${file}: missing frontmatter key "${key}"`),
  ];
}
