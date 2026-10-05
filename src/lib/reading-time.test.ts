import { describe, expect, it } from 'vitest';
import { readingMinutes } from './reading-time';

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
