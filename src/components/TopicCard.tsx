import { Link } from 'react-router-dom';
import type { Topic } from '@/types';

interface TopicCardProps {
  topic: Topic;
  sectionLabel?: string;
}

export function TopicCard({ topic, sectionLabel }: TopicCardProps) {
  return (
    <Link
      to={`/${topic.section}/${topic.slug}`}
      className="block rounded-lg border border-border bg-bg-secondary px-4 py-3 no-underline transition-colors hover:border-accent"
    >
      <div className="font-serif text-base font-semibold text-text-primary">
        {topic.title}
      </div>
      <p className="mt-1 text-sm text-text-secondary">{topic.summary}</p>
      {sectionLabel && (
        <div className="mt-2 text-xs font-medium tracking-wide text-accent uppercase">
          {sectionLabel}
        </div>
      )}
    </Link>
  );
}
