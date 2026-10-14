import { describe, expect, it } from 'vitest';
import {
  CATALOG_WORD_BUDGET,
  readingMinutes,
  WORD_BUDGET,
  WORDS_PER_MINUTE,
} from './reading-time';

// docs/specs/catalog-standard.md, criterion 1: the catalog topics' budget is
// its own constant, defined beside WORD_BUDGET.
describe('CATALOG_WORD_BUDGET (catalog-standard criterion 1)', () => {
  it('is 1,000 words', () => {
    expect(CATALOG_WORD_BUDGET).toBe(1000);
  });
});

// docs/specs/harness-follow-ups.md, criterion 1: the case studies' word budget
// is defined once here. docs/specs/case-study-template-3.md, criterion 1: it is
// ten minutes' worth of reading, and the catalog's stays 1,000.
describe('WORD_BUDGET (harness follow-ups criterion 1; case-study-template-3 criterion 1)', () => {
  it('is ten minutes at the read-time rate: 2,300 words', () => {
    expect(WORDS_PER_MINUTE).toBe(230);
    expect(WORD_BUDGET).toBe(10 * WORDS_PER_MINUTE);
    expect(WORD_BUDGET).toBe(2300);
    expect(readingMinutes(WORD_BUDGET)).toBe(10);
  });
});

// docs/specs/five-minute-templates.md, criterion 2: `readingMinutes(words)` is
// `max(1, ceil(words / 230))`, so 1,150 words read in five minutes and the
// Writing Standard's 2,300 in ten.
describe('readingMinutes (five-minute criterion 2)', () => {
  it.each([
    [0, 1],
    [1, 1],
    [230, 1],
    [231, 2],
    [460, 2],
    [1150, 5],
    [1151, 6],
    [2300, 10],
    [2301, 11],
    [6000, 27],
  ])('%i words read in %i minute(s)', (words, minutes) => {
    expect(readingMinutes(words)).toBe(minutes);
  });
});
