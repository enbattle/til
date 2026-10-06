import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { isDiagramSrc } from '@/lib/markdown.mjs';
import { hastText, rehypeHeadingIds, type HastNode } from '@/lib/headings';
import { useSideScroll } from '@/hooks/useSideScroll';
import { CodeBlock } from './CodeBlock';
import { CodeTabs } from './CodeTabs';
import { Diagram } from './Diagram';

/** The fence language of a `<pre>` holding one `<code class="language-x">`
 * (a fenced code block), or undefined for anything else. */
function fenceLanguage(node: HastNode | undefined): string | undefined {
  if (node?.type !== 'element' || node.tagName !== 'pre') return undefined;
  const [code, ...rest] = node.children ?? [];
  if (rest.length > 0 || code?.type !== 'element' || code.tagName !== 'code') {
    return undefined;
  }
  const classes = code.properties?.className;
  const language = Array.isArray(classes)
    ? classes.find((c): c is string => typeof c === 'string' && c.startsWith('language-'))
    : undefined;
  return language?.slice('language-'.length);
}

/**
 * A rehype plugin, used only with `codeTabs`: every `python` fenced block
 * followed directly by a `typescript` one (only whitespace between them, so
 * no paragraph or other block) becomes a single `<pre data-code-tabs>`
 * holding both `<code>` elements, which the `pre` override renders as one
 * `CodeTabs`. A lone fence, or a pair in the other order, is left alone.
 */
function rehypeCodePairs() {
  return (tree: HastNode) => {
    const visit = (node: HastNode) => {
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        if (fenceLanguage(children[i]) !== 'python') continue;
        let j = i + 1;
        while (children[j]?.type === 'text' && !children[j].value?.trim()) j++;
        if (fenceLanguage(children[j]) !== 'typescript') continue;
        children.splice(i, j - i + 1, {
          type: 'element',
          tagName: 'pre',
          properties: { dataCodeTabs: true },
          children: [children[i].children![0], children[j].children![0]],
        });
      }
      children.forEach(visit);
    };
    visit(tree);
  };
}

/** Whether a paragraph holds nothing but one `/diagrams/` image (whitespace
 * aside), i.e. a diagram written on its own line. */
function isDiagramParagraph(node: HastNode | undefined): boolean {
  const content = (node?.children ?? []).filter(
    (child) => !(child.type === 'text' && !child.value?.trim()),
  );
  if (content.length !== 1) return false;
  const [only] = content;
  const src = only.properties?.src;
  return (
    only.type === 'element' &&
    only.tagName === 'img' &&
    isDiagramSrc(typeof src === 'string' ? src : undefined)
  );
}

/** A GFM table in its own sideways-scrolling box, so a wide one scrolls
 * inside the content column instead of widening the page at 375px; like a
 * diagram's box, it is a focusable region only while the table overflows. */
function TableBox({ children }: { children: ReactNode }) {
  return (
    <div {...useSideScroll<HTMLDivElement>('Table, scrolls sideways')}>{children}</div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (isValidElement<{ children?: ReactNode }>(node))
    return extractText(node.props.children);
  return '';
}

/**
 * Fenced code blocks render as `<pre><code class="language-x">`, inline code
 * as a bare `<code>` with no `<pre>` wrapper — overriding `pre` (rather than
 * branching on an `inline` flag, which react-markdown has dropped and
 * re-added across versions) is the version-stable way to tell them apart.
 */
const components: Components = {
  // TopicPage renders its own page-level <h1> (the topic title); a body that
  // opens with a markdown `# heading` would otherwise produce a second one.
  // Demoting it to <h2> keeps every page to exactly one <h1> regardless of
  // how a topic happens to be written, rather than relying on a writing
  // convention nobody's forced to follow.
  h1({ id, children }) {
    return <h2 id={id}>{children}</h2>;
  },
  // Every h2 gets a stable id from `rehypeHeadingIds` (the same numbering the
  // "On this page" nav links with), so a section can be linked to and
  // the nav's anchors always land. The root's `scroll-padding-top`
  // (index.css) keeps a jump to it below the sticky header and bar.
  h2({ id, children }) {
    return <h2 id={id}>{children}</h2>;
  },
  // A diagram on its own line is a markdown paragraph, but the diagram is a
  // block (its own scroll box), and a block inside a <p> is invalid HTML, so
  // that paragraph renders without the <p>. Every other paragraph is a <p>.
  p({ node, children }) {
    if (isDiagramParagraph(node as HastNode | undefined)) return <>{children}</>;
    return <p>{children}</p>;
  },
  // Only a `/diagrams/...svg` image is special (a themed, sized D2 diagram);
  // anything else renders as the plain `<img>` react-markdown would produce.
  img({ src, alt, title }) {
    const source = typeof src === 'string' ? src : undefined;
    if (isDiagramSrc(source)) return <Diagram src={source} alt={alt ?? ''} />;
    return <img src={source} alt={alt} title={title} />;
  },
  // A topic body links to another topic with a site-root-relative path (e.g.
  // `/ai-and-ml/prompt-engineering`). A plain `<a>` would ignore the router's
  // basename (breaking under the GitHub Pages `/til/` subpath) and force a
  // full page reload — routing it through `Link` keeps it client-side and
  // basename-aware. An in-page `#id` link (a case study's prose pointing at
  // one of its own `Decision:` headings) stays a plain same-tab `<a>`, so the
  // browser scrolls to the id natively. An external link stays a plain, new-tab `<a>`.
  a({ href, children }) {
    if (href?.startsWith('/')) {
      return <Link to={href}>{children}</Link>;
    }
    if (href?.startsWith('#')) {
      return <a href={href}>{children}</a>;
    }
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <TableBox>
        <table>{children}</table>
      </TableBox>
    );
  },
  pre({ node, children }) {
    const element = node as HastNode | undefined;
    if (element?.properties?.dataCodeTabs) {
      const [python, typescript] = (element.children ?? []).map((code) =>
        hastText(code).replace(/\n$/, ''),
      );
      return <CodeTabs code={{ python, typescript }} />;
    }
    const codeElement = Array.isArray(children) ? children[0] : children;
    const className = isValidElement<{ className?: string }>(codeElement)
      ? (codeElement.props.className ?? '')
      : '';
    const language = /language-(\w+)/.exec(className)?.[1];
    const code = extractText(children).replace(/\n$/, '');
    return <CodeBlock code={code} language={language} />;
  },
  code({ className, children }) {
    if (className) {
      // Inside a fenced block — passed through so the `pre` override above
      // can read its className/text; never rendered to the DOM directly.
      return <code className={className}>{children}</code>;
    }
    // Inline code may break anywhere, so a long span can't widen the page
    // at narrow widths; fenced blocks scroll sideways instead.
    return (
      <code className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[0.875em] [overflow-wrap:anywhere]">
        {children}
      </code>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
  /** Render each python fence directly followed by a typescript fence as one
   * `CodeTabs` block (DSA entries only; needs a `CodeLanguageProvider`).
   * Off by default, which leaves the output exactly as without it. */
  codeTabs?: boolean;
}

const REHYPE_PLUGINS = [rehypeHeadingIds];
const REHYPE_PLUGINS_WITH_CODE_TABS = [rehypeHeadingIds, rehypeCodePairs];

export function MarkdownRenderer({ content, codeTabs = false }: MarkdownRendererProps) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={codeTabs ? REHYPE_PLUGINS_WITH_CODE_TABS : REHYPE_PLUGINS}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
