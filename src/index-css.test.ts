import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postcss, {
  type AtRule,
  type Declaration,
  type Document as CssDocument,
  type Node as CssNode,
  type Rule,
} from 'postcss';
import { describe, expect, it } from 'vitest';

// docs/specs/focus-not-obscured.md, criterion 1: the root's scroll-padding-top
// reserves the strip under the sticky header (and, below `xl`, the "On this
// page" bar), so focus moves, fragment jumps and scrollIntoView all land below
// them. jsdom applies no stylesheet, so this reads the real src/index.css and
// parses it with postcss (Vite's own CSS parser), which skips comments.

const CSS = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');

/** An at-rule that is the `xl` breakpoint: a min-width 80rem media query. */
function isXlQuery(node: AtRule) {
  return (
    node.name === 'media' &&
    /\(\s*(min-width\s*:\s*80rem|width\s*>=\s*80rem)\s*\)/.test(node.params)
  );
}

/** Every `scroll-padding-top` declared on a rule whose selector list includes
 * `html`, with whether it sits inside the `xl` query. */
function htmlScrollPadding() {
  const found: Array<{ value: string; xl: boolean }> = [];
  postcss.parse(CSS).walkDecls('scroll-padding-top', (decl: Declaration) => {
    const rule = decl.parent;
    if (rule?.type !== 'rule') return;
    if (!(rule as Rule).selectors.some((s) => s.trim() === 'html')) return;
    let xl = false;
    for (
      let node: CssNode | CssDocument | undefined = rule.parent;
      node;
      node = node.parent
    ) {
      if (node.type === 'atrule' && isXlQuery(node as AtRule)) xl = true;
    }
    found.push({ value: decl.value, xl });
  });
  return found;
}

describe('src/index.css root scroll padding (focus-not-obscured criterion 1)', () => {
  it('declares one scroll-padding-top on html below xl, using the header height and the "On this page" bar height', () => {
    const narrow = htmlScrollPadding().filter((d) => !d.xl);
    expect(narrow, JSON.stringify(htmlScrollPadding())).toHaveLength(1);
    expect(narrow[0].value).toMatch(/var\(\s*--header-height\b/);
    expect(narrow[0].value).toMatch(/var\(\s*--on-this-page-height\b/);
  });

  it('declares one scroll-padding-top on html in a min-width 80rem query, using the header height but not the bar height', () => {
    const wide = htmlScrollPadding().filter((d) => d.xl);
    expect(wide, JSON.stringify(htmlScrollPadding())).toHaveLength(1);
    expect(wide[0].value).toMatch(/var\(\s*--header-height\b/);
    expect(wide[0].value).not.toMatch(/--on-this-page-height/);
  });
});
