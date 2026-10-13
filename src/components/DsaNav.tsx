import { DSA_GROUPS } from '@/lib/dsa';
import { OrderedNav } from './OrderedNav';

/** The DSA counterpart to `CaseStudyNav`: one labelled list per kind
 * (`DSA_GROUPS`), each entry under its running `number`, which continues
 * across the groups in `DSA_ENTRIES` order. */
export function DsaNav(props: { onNavigate?: () => void; className?: string }) {
  const groups = DSA_GROUPS.map((group) => ({
    label: group.heading,
    items: group.entries.map((entry) => ({
      to: entry.path,
      title: entry.title,
      number: entry.number,
    })),
  }));
  return <OrderedNav label="DSA entries" heading="DSA" items={groups} {...props} />;
}
