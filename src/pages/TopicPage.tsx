import { Link, Navigate, useParams } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { TOPICS, getTopic, loadTopicBody } from '@/lib/content';
import { LazyBody } from '@/components/LazyBody';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { PageHeader } from '@/components/PageHeader';
import { PrevNextNav } from '@/components/PrevNextNav';
import { neighbours } from '@/lib/neighbours';
import { caseStudiesForTopic } from '@/lib/system-design';

export function TopicPage() {
  const { section: sectionSlug, slug } = useParams<{ section: string; slug: string }>();
  const section = sectionSlug ? getSection(sectionSlug) : undefined;
  const topic = section && slug ? getTopic(section.slug, slug) : undefined;

  if (!section || !topic) return <Navigate to="/not-found" replace />;

  const { prev, next } = neighbours(
    TOPICS.filter((t) => t.section === topic.section),
    topic,
  );
  const caseStudies = caseStudiesForTopic(topic.section, topic.slug);

  return (
    <article className="space-y-8">
      <PageHeader
        back={{ to: `/${section.slug}`, label: section.label }}
        title={topic.title}
        meta={topic.date}
      />

      {/* Keyed so moving between topics starts a fresh load instead of
          showing the previous topic's body until the new one arrives. The
          navigation is passed as children so it appears only after the body. */}
      <LazyBody
        key={`${topic.section}/${topic.slug}`}
        load={() => loadTopicBody(topic.section, topic.slug)}
      >
        {(body) => (
          <>
            <MarkdownRenderer content={body} />
            {/* The way back from a System Design case study that uses this
                topic. Generated from the case studies' own links at build
                time, not maintained by hand on each topic. */}
            {caseStudies.length > 0 && (
              <nav
                aria-label="Case studies this topic is used in"
                className="border-t border-border pt-6 text-sm"
              >
                <p className="text-text-tertiary">Used in these case studies:</p>
                <ul className="mt-2 space-y-1">
                  {caseStudies.map((caseStudy) => (
                    <li key={caseStudy.slug}>
                      <Link
                        to={`/system-design/${caseStudy.slug}`}
                        className="text-accent hover:text-accent-hover"
                      >
                        {caseStudy.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            <PrevNextNav
              label={`More in ${section.label}`}
              prev={prev && { to: `/${section.slug}/${prev.slug}`, title: prev.title }}
              next={next && { to: `/${section.slug}/${next.slug}`, title: next.title }}
            />
          </>
        )}
      </LazyBody>
    </article>
  );
}
