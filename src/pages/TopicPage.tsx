import { Link, Navigate, useParams } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { getTopic, sectionNeighbors } from '@/lib/content';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';

export function TopicPage() {
  const { section: sectionSlug, slug } = useParams<{ section: string; slug: string }>();
  const section = sectionSlug ? getSection(sectionSlug) : undefined;
  const topic = section && slug ? getTopic(section.slug, slug) : undefined;

  if (!section || !topic) return <Navigate to="/not-found" replace />;

  const { prev, next } = sectionNeighbors(topic);

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

      <MarkdownRenderer content={topic.body} />

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
    </article>
  );
}
