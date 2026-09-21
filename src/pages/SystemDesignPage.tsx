import { Link } from 'react-router-dom';
import { QUESTIONS } from '@/lib/system-design';

export function SystemDesignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          System Design
        </h1>
        <p className="mt-2 max-w-xl text-text-secondary">
          Start from the problem in front of you, such as a slow database or a service
          that keeps failing, and follow it to the catalog topics that help.
        </p>
      </div>

      <div className="space-y-3">
        {QUESTIONS.map((question) => (
          <Link
            key={question.slug}
            to={`/system-design/${question.slug}`}
            className="block rounded-lg border border-border bg-bg-secondary px-4 py-3 no-underline transition-colors hover:border-accent"
          >
            <div className="font-serif text-base font-semibold text-text-primary">
              {question.title}
            </div>
            <p className="mt-1 text-sm text-text-secondary">{question.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
