import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { getTopic, loadTopicBody, sectionNeighbors } from '@/lib/content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { questionsForTopic } from '@/lib/system-design';

type BodyState =
  | { status: 'loading' }
  | { status: 'loaded'; body: string }
  | { status: 'failed'; error: unknown };

/** Loads the topic's body chunk after the header has already rendered, then
 * renders the body followed by `children` (the navigation below it). Holding
 * the navigation back until the body is in keeps it from sitting directly under
 * an empty body and jumping down when the body arrives. A failed load is
 * rethrown during render so it reaches the `ErrorBoundary` (the right fix for a
 * stale chunk after a deploy is a reload); it is tracked with an explicit
 * status because a load can reject with a falsy value. This is state plus an
 * effect rather than React's `use`, because `use` on a still-pending promise
 * inside a synchronous test `render` never gets retried. */
function TopicBody({
  section,
  slug,
  children,
}: {
  section: string;
  slug: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<BodyState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    loadTopicBody(section, slug).then(
      (body) => active && setState({ status: 'loaded', body }),
      (error: unknown) => active && setState({ status: 'failed', error }),
    );
    return () => {
      active = false;
    };
  }, [section, slug]);

  if (state.status === 'failed') throw state.error;
  if (state.status === 'loading') return null;
  return (
    <>
      <MarkdownRenderer content={state.body} />
      {children}
    </>
  );
}

export function TopicPage() {
  const { section: sectionSlug, slug } = useParams<{ section: string; slug: string }>();
  const section = sectionSlug ? getSection(sectionSlug) : undefined;
  const topic = section && slug ? getTopic(section.slug, slug) : undefined;

  if (!section || !topic) return <Navigate to="/not-found" replace />;

  const { prev, next } = sectionNeighbors(topic);
  const questions = questionsForTopic(topic.section, topic.slug);

  return (
    <article className="space-y-8">
      <div>
        <Link
          to={`/${section.slug}`}
          className="text-sm font-medium text-text-tertiary hover:text-accent"
        >
          ← {section.label}
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          {topic.title}
        </h1>
        <p className="mt-2 text-sm text-text-tertiary">{topic.date}</p>
      </div>

      {/* Keyed so moving between topics starts a fresh load instead of
          showing the previous topic's body until the new one arrives. The
          navigation is passed as children so it appears only after the body. */}
      <TopicBody
        key={`${topic.section}/${topic.slug}`}
        section={topic.section}
        slug={topic.slug}
      >
        {/* The way back from a System Design question (which links here) — the
            list is generated from the questions' own links, not maintained by
            hand on each topic. */}
        {questions.length > 0 && (
          <nav
            aria-label="Questions this topic comes up in"
            className="border-t border-border pt-6 text-sm"
          >
            <p className="text-text-tertiary">This comes up in:</p>
            <ul className="mt-2 space-y-1">
              {questions.map((question) => (
                <li key={question.slug}>
                  <Link
                    to={`/system-design/${question.slug}`}
                    className="text-accent hover:text-accent-hover"
                  >
                    {question.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {(prev || next) && (
          <nav className="flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-sm">
            {prev && (
              <Link
                to={`/${section.slug}/${prev.slug}`}
                className="text-text-secondary hover:text-accent"
              >
                ← {prev.title}
              </Link>
            )}
            {next && (
              <Link
                to={`/${section.slug}/${next.slug}`}
                className="ml-auto text-text-secondary hover:text-accent"
              >
                {next.title} →
              </Link>
            )}
          </nav>
        )}
      </TopicBody>
    </article>
  );
}
