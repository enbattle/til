import { Link } from 'react-router-dom';
import { SECTIONS } from '@/content/registry';
import { recentTopics, topicsBySection } from '@/lib/content';
import { TopicCard } from '@/components/TopicCard';

export function HomePage() {
  const groups = topicsBySection();
  const recent = recentTopics(5);
  const totalTopics = groups.reduce((sum, group) => sum + group.topics.length, 0);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="font-serif text-3xl font-semibold text-text-primary sm:text-4xl">
          til
        </h1>
        <p className="mt-3 max-w-xl text-text-secondary">
          A running, searchable log of things learned across programming, tech, and AI —{' '}
          {totalTopics} {totalTopics === 1 ? 'topic' : 'topics'} so far, grouped into
          sections below.
        </p>
      </section>

      <section>
        <h2 className="font-serif text-xl font-semibold text-text-primary">Sections</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((section) => {
            const count =
              groups.find((group) => group.section.slug === section.slug)?.topics
                .length ?? 0;
            return (
              <Link
                key={section.slug}
                to={`/${section.slug}`}
                className="block rounded-lg border border-border bg-bg-secondary p-4 no-underline transition-colors hover:border-accent"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-serif text-lg font-semibold text-text-primary">
                    {section.label}
                  </h3>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {count} {count === 1 ? 'topic' : 'topics'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-text-secondary">{section.description}</p>
              </Link>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="font-serif text-xl font-semibold text-text-primary">
            Recently added
          </h2>
          <div className="mt-4 space-y-3">
            {recent.map((topic) => (
              <TopicCard
                key={`${topic.section}/${topic.slug}`}
                topic={topic}
                sectionLabel={
                  groups.find((group) => group.section.slug === topic.section)?.section
                    .label
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
