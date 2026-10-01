import { CASE_STUDIES } from '@/lib/system-design';
import { OrderedNav } from './OrderedNav';

/** The System Design counterpart to `SectionNav`: the case studies in
 * `order`. */
export function CaseStudyNav(props: { onNavigate?: () => void; className?: string }) {
  const items = CASE_STUDIES.map((caseStudy) => ({
    to: `/system-design/${caseStudy.slug}`,
    title: caseStudy.title,
    number: caseStudy.order,
  }));
  return (
    <OrderedNav label="Case studies" heading="Case studies" items={items} {...props} />
  );
}
