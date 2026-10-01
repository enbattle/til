/** The body's `##` sections as in-page links (a case study's or DSA entry's
 * Contents box). `h2Headings` numbers the ids with the same
 * `createHeadingIds` the markdown renderer uses, so every link lands on its
 * heading, duplicates included (`notes`, `notes-1`). Keyed by id, which is
 * unique where the text may not be. Plain `<a href="#id">` rather than a
 * router `Link`: the browser handles an in-page jump itself. */
export function Contents({ headings }: { headings: { text: string; id: string }[] }) {
  if (headings.length === 0) return null;
  return (
    <nav
      aria-label="Contents"
      className="rounded-lg border border-border bg-bg-secondary px-4 py-3 text-sm"
    >
      <p className="font-medium text-text-tertiary">Contents</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 marker:text-text-tertiary">
        {headings.map(({ text, id }) => (
          <li key={id}>
            <a href={`#${id}`}>{text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
