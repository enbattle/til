/** Words a minute behind the read-time label (docs/specs/five-minute-templates.md).
 * This file owns the three numbers the Writing Standard quotes. */
export const WORDS_PER_MINUTE = 230;

/** The Writing Standard's word budget: five minutes' worth of reading, 1,150
 * words. Both structure tests import it rather than defining their own. */
export const WORD_BUDGET = 5 * WORDS_PER_MINUTE;

/** The catalog topics' word budget (the Writing Standard's "Catalog topics"
 * section): five minutes at most, aiming for 600–900 words. The
 * topic-structure test imports it. */
export const CATALOG_WORD_BUDGET = 1000;

/** Whole minutes to read `words` words, never less than one. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
