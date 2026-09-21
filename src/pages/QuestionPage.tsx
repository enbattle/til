import { Link, Navigate, useParams } from 'react-router-dom';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { QUESTIONS, getQuestion, topicsForQuestion } from '@/lib/system-design';

export function QuestionPage() {
  const { slug } = useParams<{ slug: string }>();
  const question = slug ? getQuestion(slug) : undefined;

  if (!question) return <Navigate to="/not-found" replace />;

  const topics = topicsForQuestion(question);
  const index = QUESTIONS.findIndex((q) => q.slug === question.slug);
  const prev = index > 0 ? QUESTIONS[index - 1] : null;
  const next = index < QUESTIONS.length - 1 ? QUESTIONS[index + 1] : null;

  return (
    <article className="space-y-8">
      <div>
        <Link
          to="/system-design"
          className="text-sm font-medium text-text-tertiary hover:text-accent"
        >
          ← System Design
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          {question.title}
        </h1>
        <p className="mt-2 text-sm text-text-tertiary">{question.date}</p>
      </div>

      <MarkdownRenderer content={question.body} />

      {/* Generated from the body's own topic links, so a topic's summary is
          never re-typed here and can't drift from the catalog page. */}
      {topics.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-text-primary">
            Go deeper
          </h2>
          <ul className="mt-4 space-y-3">
            {topics.map((topic) => (
              <li key={`${topic.section}/${topic.slug}`}>
                <Link
                  to={`/${topic.section}/${topic.slug}`}
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  {topic.title}
                </Link>
                <p className="mt-0.5 text-sm text-text-secondary">{topic.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(prev || next) && (
        <nav className="flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-sm">
          {prev && (
            <Link
              to={`/system-design/${prev.slug}`}
              className="text-text-secondary hover:text-accent"
            >
              ← {prev.title}
            </Link>
          )}
          {next && (
            <Link
              to={`/system-design/${next.slug}`}
              className="ml-auto text-text-secondary hover:text-accent"
            >
              {next.title} →
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
