import { Link, Navigate, useParams } from 'react-router-dom';
import { LazyBody } from '@/components/LazyBody';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { OnThisPage } from '@/components/OnThisPage';
import { PageHeader } from '@/components/PageHeader';
import { PrevNextNav } from '@/components/PrevNextNav';
import { h2Headings } from '@/lib/headings';
import { neighbours } from '@/lib/neighbours';
import { readingMinutes } from '@/lib/reading-time';
import {
  CASE_STUDIES,
  getCaseStudy,
  loadCaseStudyBody,
  topicsForCaseStudy,
} from '@/lib/system-design';

export function CaseStudyPage() {
  const { slug } = useParams<{ slug: string }>();
  const caseStudy = slug ? getCaseStudy(slug) : undefined;

  if (!caseStudy) return <Navigate to="/not-found" replace />;

  const topics = topicsForCaseStudy(caseStudy);
  const { prev, next } = neighbours(CASE_STUDIES, caseStudy);

  return (
    <article className="space-y-8">
      <PageHeader
        back={{ to: '/system-design', label: 'System Design' }}
        title={caseStudy.title}
        meta={`${caseStudy.date} · ${readingMinutes(caseStudy.words)} min read`}
      />

      {/* The body is its own lazily loaded chunk; everything that depends on
          it, and the navigation under it, waits for it (as on a topic page).
          Keyed so moving between case studies starts a fresh load. */}
      <LazyBody key={caseStudy.slug} load={() => loadCaseStudyBody(caseStudy.slug)}>
        {(body) => (
          <>
            <OnThisPage headings={h2Headings(body)} />
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

            <PrevNextNav
              label="More case studies"
              prev={prev && { to: `/system-design/${prev.slug}`, title: prev.title }}
              next={next && { to: `/system-design/${next.slug}`, title: next.title }}
            />
          </>
        )}
      </LazyBody>
    </article>
  );
}
