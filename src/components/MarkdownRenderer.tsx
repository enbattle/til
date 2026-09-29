import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { isDiagramSrc } from '@/lib/diagram-refs.mjs';
import { rehypeHeadingIds } from '@/lib/headings';
import { useSideScroll } from '@/hooks/useSideScroll';
import { CodeBlock } from './CodeBlock';
import { Diagram } from './Diagram';

/**
 * Keeps a heading clear of the sticky header when the browser jumps to it (a
 * Contents link or a `#id` URL): the header's measured height (`Header`
 * publishes it as `--header-height`; about 68px from `sm` up, about 105px at
 * 375px where the tabs wrap to a second row, more on the narrowest phones)
 * plus a little space. Before that runs, 8rem covers the two-row header.
 */
const HEADING_SCROLL_MARGIN = 'scroll-mt-[calc(var(--header-height,8rem)_+_0.75rem)]';

/** The parts of a hast (HTML syntax tree) node the paragraph override reads. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
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
    return (
      <h2 id={id} className={HEADING_SCROLL_MARGIN}>
        {children}
      </h2>
    );
  },
  // Every h2 gets a stable id from `rehypeHeadingIds` (the same numbering the
  // case-study Contents list links with), so a section can be linked to and
  // the Contents anchors always land.
  h2({ id, children }) {
    return (
      <h2 id={id} className={HEADING_SCROLL_MARGIN}>
        {children}
      </h2>
    );
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
  // basename-aware. An external link stays a plain, new-tab `<a>`.
  a({ href, children }) {
    if (href?.startsWith('/')) {
      return <Link to={href}>{children}</Link>;
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
  pre({ children }) {
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
    return (
      <code className="rounded bg-bg-secondary px-1.5 py-0.5 font-mono text-[0.875em]">
        {children}
      </code>
    );
  },
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHeadingIds]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
