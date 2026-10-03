import { Link, Navigate, useParams } from 'react-router-dom';
import { LazyBody } from '@/components/LazyBody';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { OnThisPage } from '@/components/OnThisPage';
import { PageHeader } from '@/components/PageHeader';
import { PrevNextNav } from '@/components/PrevNextNav';
import {
  DSA_ENTRIES,
  dsaKindLabel,
  getDsaEntry,
  getDsaPrerequisites,
  loadDsaEntryBody,
} from '@/lib/dsa';
import { h2Headings } from '@/lib/headings';
import { neighbours } from '@/lib/neighbours';

export function DsaEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const entry = slug ? getDsaEntry(slug) : undefined;

  if (!entry) return <Navigate to="/not-found" replace />;

  const prereqs = getDsaPrerequisites(entry.slug);
  const { prev, next } = neighbours(DSA_ENTRIES, entry);

  return (
    <article className="space-y-8">
      <PageHeader
        back={{ to: '/dsa', label: 'DSA' }}
        title={entry.title}
        meta={
          <>
            <span className="font-medium">{dsaKindLabel(entry.kind)}</span> · {entry.date}
          </>
        }
      />

      {/* From the build-time prerequisite links, so it shows before the body
          has loaded. */}
      {prereqs.length > 0 && (
        <nav aria-label="Before this" className="text-sm">
          <p className="font-medium text-text-tertiary">Before this</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {prereqs.map((prereq) => (
              <li key={prereq.slug}>
                <Link
                  to={`/dsa/${prereq.slug}`}
                  className="font-medium text-accent hover:text-accent-hover"
                >
                  {prereq.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* The body is its own lazily loaded chunk; the "On this page" list and the
          navigation under it wait for it (as on a case study page). Keyed so
          moving between entries starts a fresh load. */}
      <LazyBody key={entry.slug} load={() => loadDsaEntryBody(entry.slug)}>
        {(body) => (
          <>
            <OnThisPage headings={h2Headings(body)} />
            <MarkdownRenderer content={body} codeTabs />
            <PrevNextNav
              label="More DSA entries"
              prev={prev && { to: `/dsa/${prev.slug}`, title: prev.title }}
              next={next && { to: `/dsa/${next.slug}`, title: next.title }}
            />
          </>
        )}
      </LazyBody>
    </article>
  );
}
