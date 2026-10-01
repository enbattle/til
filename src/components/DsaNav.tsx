import { DSA_ENTRIES } from '@/lib/dsa';
import { OrderedNav } from './OrderedNav';

/** The DSA counterpart to `CaseStudyNav`: the entries in `DSA_ENTRIES` order
 * (prerequisites first). */
export function DsaNav(props: { onNavigate?: () => void; className?: string }) {
  const items = DSA_ENTRIES.map((entry, index) => ({
    to: `/dsa/${entry.slug}`,
    title: entry.title,
    number: index + 1,
  }));
  return <OrderedNav label="DSA entries" heading="DSA" items={items} {...props} />;
}
