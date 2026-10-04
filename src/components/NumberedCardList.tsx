import { Link } from 'react-router-dom';

interface NumberedCard {
  to: string;
  number: number;
  title: string;
  summary: string;
}

/** A landing page's numbered list of cards (System Design, DSA), one link
 * each, in the order given. `start` follows the first card's number, so a
 * list that continues another's numbering (a DSA group) says so. */
export function NumberedCardList({ cards }: { cards: NumberedCard[] }) {
  return (
    <ol start={cards[0]?.number} className="space-y-3">
      {cards.map(({ to, number, title, summary }) => (
        <li key={to}>
          <Link
            to={to}
            className="flex gap-4 rounded-lg border border-border bg-bg-secondary px-4 py-3 no-underline transition-colors hover:border-accent"
          >
            <span className="font-serif text-lg font-semibold tabular-nums text-accent">
              {number}
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-base font-semibold text-text-primary">
                {title}
              </span>
              <span className="mt-1 block text-sm text-text-secondary">{summary}</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
