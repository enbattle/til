import { NumberedCardList } from '@/components/NumberedCardList';
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

      <NumberedCardList
        cards={CASE_STUDIES.map((caseStudy) => ({
          to: `/system-design/${caseStudy.slug}`,
          number: caseStudy.order,
          title: caseStudy.title,
          summary: caseStudy.summary,
        }))}
      />
    </div>
  );
}
