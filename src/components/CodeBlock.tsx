import { useEffect, useState } from 'react';
import { useTheme } from '@/contexts/useTheme';
import { highlightCode } from '@/lib/highlighter';

interface CodeBlockProps {
  code: string;
  language?: string;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const { resolved } = useTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    highlightCode(code, language, resolved).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, language, resolved]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied (permissions) or unavailable (an
      // insecure context) — the button just stays "Copy" rather than
      // throwing an unhandled rejection.
    }
  }

  return (
    <div className="group not-prose relative my-5 overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 rounded-md border border-border bg-bg-secondary px-2 py-1 text-xs text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-text-primary focus-visible:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {html ? (
        <div
          className="overflow-x-auto text-sm [&>pre]:p-4 [&_pre]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto bg-bg-secondary p-4 text-sm text-text-secondary">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
