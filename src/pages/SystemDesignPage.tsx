import { Link } from 'react-router-dom';
import { CASE_STUDIES } from '@/lib/system-design';

export function SystemDesignPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          System Design
        </h1>
        <p className="mt-2 max-w-xl text-text-secondary">
          Worked design case studies. Each one takes a familiar product from requirements
          and rough numbers through the data model, the API and the architecture, then
          digs into the parts that are hard, linking into the catalog wherever it leans on
          a topic.
        </p>
      </div>

      <ol className="space-y-3">
        {CASE_STUDIES.map((caseStudy) => (
          <li key={caseStudy.slug}>
            <Link
              to={`/system-design/${caseStudy.slug}`}
              className="flex gap-4 rounded-lg border border-border bg-bg-secondary px-4 py-3 no-underline transition-colors hover:border-accent"
            >
              <span className="font-serif text-lg font-semibold tabular-nums text-accent">
                {caseStudy.order}
              </span>
              <span className="min-w-0">
                <span className="block font-serif text-base font-semibold text-text-primary">
                  {caseStudy.title}
                </span>
                <span className="mt-1 block text-sm text-text-secondary">
                  {caseStudy.summary}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
