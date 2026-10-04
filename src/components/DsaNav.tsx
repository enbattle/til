import { DSA_GROUPS } from '@/lib/dsa';
import { OrderedNav } from './OrderedNav';

/** The DSA counterpart to `CaseStudyNav`: one labelled list per kind
 * (`DSA_GROUPS`), numbered in one sequence across them, which is
 * `DSA_ENTRIES` order. */
export function DsaNav(props: { onNavigate?: () => void; className?: string }) {
  let number = 0;
  const groups = DSA_GROUPS.map((group) => ({
    label: group.heading,
    items: group.entries.map((entry) => ({
      to: `/dsa/${entry.slug}`,
      title: entry.title,
      number: ++number,
    })),
  }));
  return <OrderedNav label="DSA entries" heading="DSA" items={groups} {...props} />;
}
