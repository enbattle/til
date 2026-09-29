import { Link, Navigate, useParams } from 'react-router-dom';
import { LazyBody } from '@/components/LazyBody';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { h2Headings } from '@/lib/headings';
import {
  CASE_STUDIES,
  getCaseStudy,
  loadCaseStudyBody,
  topicsForCaseStudy,
} from '@/lib/system-design';

/** The body's `##` sections as in-page links. `h2Headings` numbers the ids
 * with the same `createHeadingIds` the markdown renderer uses, so every link
 * lands on its heading, duplicates included (`notes`, `notes-1`). Keyed by
 * id, which is unique where the text may not be. Plain `<a href="#id">`
 * rather than a router `Link`: the browser handles an in-page jump itself. */
function Contents({ headings }: { headings: { text: string; id: string }[] }) {
  if (headings.length === 0) return null;
  return (
    <nav
      aria-label="Contents"
      className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm"
    >
      <p className="font-medium text-text-tertiary">Contents</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-text-tertiary">
        {headings.map(({ text, id }) => (
          <li key={id}>
            <a href={`#${id}`}>{text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function CaseStudyPage() {
  const { slug } = useParams<{ slug: string }>();
  const caseStudy = slug ? getCaseStudy(slug) : undefined;

  if (!caseStudy) return <Navigate to="/not-found" replace />;

  const topics = topicsForCaseStudy(caseStudy);
  const index = CASE_STUDIES.findIndex((c) => c.slug === caseStudy.slug);
  const prev = index > 0 ? CASE_STUDIES[index - 1] : null;
  const next = index < CASE_STUDIES.length - 1 ? CASE_STUDIES[index + 1] : null;

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
          {caseStudy.title}
        </h1>
        <p className="mt-2 text-sm text-text-tertiary">{caseStudy.date}</p>
      </div>

      {/* The body is its own lazily loaded chunk; everything that depends on
          it, and the navigation under it, waits for it (as on a topic page).
          Keyed so moving between case studies starts a fresh load. */}
      <LazyBody key={caseStudy.slug} load={() => loadCaseStudyBody(caseStudy.slug)}>
        {(body) => (
          <>
            <Contents headings={h2Headings(body)} />
            <MarkdownRenderer content={body} />

            {/* Generated from the body's own topic links (at build time), so a
                topic's summary is never re-typed here and can't drift from the
                catalog page. */}
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
                      <p className="mt-0.5 text-sm text-text-secondary">
                        {topic.summary}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(prev || next) && (
              <nav
                aria-label="More case studies"
                className="flex flex-wrap justify-between gap-4 border-t border-border pt-6 text-sm"
              >
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
          </>
        )}
      </LazyBody>
    </article>
  );
}
