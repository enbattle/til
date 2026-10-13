import { useId } from 'react';
import { NumberedCardList } from '@/components/NumberedCardList';
import { DSA_GROUPS } from '@/lib/dsa';

export function DsaPage() {
  const idPrefix = useId();
  // Each entry's number (set in dsa.ts) continues across the groups, matching
  // the sidebar and Previous/Next.

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          Data Structures &amp; Algorithms
        </h1>
        <p className="mt-2 max-w-xl text-text-secondary">
          Data structures, problem-solving patterns and algorithms at interview depth,
          each with tested code in Python and TypeScript explained a few lines at a time.
          They're grouped by those three kinds, and each group runs in the order its
          entries build on each other.
        </p>
      </div>

      {DSA_GROUPS.map((group) => {
        const id = `${idPrefix}-${group.kind}`;
        return (
          <section key={group.kind} aria-labelledby={id}>
            <h2 id={id} className="font-serif text-xl font-semibold text-text-primary">
              {group.heading}
            </h2>
            <div className="mt-4">
              <NumberedCardList
                cards={group.entries.map((entry) => ({
                  to: entry.path,
                  number: entry.number,
                  title: entry.title,
                  summary: entry.summary,
                }))}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}
