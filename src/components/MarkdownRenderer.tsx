import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { CodeBlock } from './CodeBlock';

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
  h1({ children }) {
    return <h2>{children}</h2>;
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
