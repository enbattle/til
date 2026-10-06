import { describe, expect, it } from 'vitest';
import { readingMinutes, WORD_BUDGET, WORDS_PER_MINUTE } from './reading-time';

// docs/specs/harness-follow-ups.md, criterion 1: the word budget both
// structure tests enforce is five minutes' worth of reading, defined once here.
describe('WORD_BUDGET (harness follow-ups criterion 1)', () => {
  it('is five minutes at the read-time rate: 1,150 words', () => {
    expect(WORDS_PER_MINUTE).toBe(230);
    expect(WORD_BUDGET).toBe(5 * WORDS_PER_MINUTE);
    expect(WORD_BUDGET).toBe(1150);
    expect(readingMinutes(WORD_BUDGET)).toBe(5);
  });
});

// docs/specs/five-minute-templates.md, criterion 2: `readingMinutes(words)` is
// `max(1, ceil(words / 230))`, so the Writing Standard's 1,150 words read in
// five minutes.
describe('readingMinutes (five-minute criterion 2)', () => {
  it.each([
    [0, 1],
    [1, 1],
    [230, 1],
    [231, 2],
    [460, 2],
    [1150, 5],
    [1151, 6],
    [6000, 27],
  ])('%i words read in %i minute(s)', (words, minutes) => {
    expect(readingMinutes(words)).toBe(minutes);
  });
});
