import { Navigate, useParams } from 'react-router-dom';
import { getSection } from '@/content/registry';
import { topicsBySection } from '@/lib/content';
import { TopicCard } from '@/components/TopicCard';

export function SectionPage() {
  const { section: slug } = useParams<{ section: string }>();
  const section = slug ? getSection(slug) : undefined;

  if (!section) return <Navigate to="/not-found" replace />;

  const topics =
    topicsBySection().find((group) => group.section.slug === section.slug)?.topics ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          {section.label}
        </h1>
        <p className="mt-2 max-w-xl text-text-secondary">{section.description}</p>
      </div>

      {topics.length === 0 ? (
        <p className="text-text-tertiary">No topics here yet.</p>
      ) : (
        <div className="space-y-3">
          {topics.map((topic) => (
            <TopicCard key={topic.slug} topic={topic} />
          ))}
        </div>
      )}
    </div>
  );
}
