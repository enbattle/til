import { NumberedCardList } from '@/components/NumberedCardList';
import { DSA_ENTRIES, dsaKindLabel } from '@/lib/dsa';

export function DsaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-text-primary sm:text-3xl">
          Data Structures &amp; Algorithms
        </h1>
        <p className="mt-2 max-w-xl text-text-secondary">
          Data structures, problem-solving patterns and algorithms at interview depth,
          each with tested code in Python and TypeScript explained a few lines at a time.
          Every entry comes after the ones it builds on.
        </p>
      </div>

      <NumberedCardList
        cards={DSA_ENTRIES.map((entry, index) => ({
          to: `/dsa/${entry.slug}`,
          number: index + 1,
          title: entry.title,
          summary: entry.summary,
          label: dsaKindLabel(entry.kind),
        }))}
      />
    </div>
  );
}
