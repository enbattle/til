/** Words a minute behind the read-time label: the Writing Standard's 1,150
 * words read in about five minutes (docs/specs/five-minute-templates.md). */
const WORDS_PER_MINUTE = 230;

/** Whole minutes to read `words` words, never less than one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
