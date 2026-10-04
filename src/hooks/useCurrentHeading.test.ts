import { describe, expect, it } from 'vitest';
import { currentHeadingId } from './useCurrentHeading';

// docs/specs/on-this-page-scroll-spy.md, criterion 1: the pure "which section
// is current" decision. A heading is past its reading line when its top is at
// most its own scroll-margin-top plus 2px of slack; the current one is the
// last such heading, or the last heading of all when the page is scrolled to
// the bottom.

const MARGIN = 80;

function headings(...tops: number[]) {
  return tops.map((top, i) => ({ id: `h${i}`, top, margin: MARGIN }));
}

describe('currentHeadingId (criterion 1)', () => {
  it('returns null when every heading’s top is below its reading line', () => {
    expect(currentHeadingId(headings(300, 900, 1500), false)).toBeNull();
  });

  it('returns null when the first heading is just past the 2px slack', () => {
    expect(currentHeadingId(headings(MARGIN + 3, 900), false)).toBeNull();
  });

  it('returns the last heading whose top is at most margin + 2', () => {
    expect(currentHeadingId(headings(-800, -50, 40, 400, 900), false)).toBe('h2');
    expect(currentHeadingId(headings(-800, MARGIN + 2, MARGIN + 3), false)).toBe('h1');
  });

  it('counts a heading exactly at its reading line as current', () => {
    expect(currentHeadingId(headings(-300, MARGIN, 700), false)).toBe('h1');
  });

  it('uses each heading’s own margin', () => {
    const list = [
      { id: 'a', top: -100, margin: 80 },
      { id: 'b', top: 110, margin: 120 },
      { id: 'c', top: 110, margin: 80 },
    ];
    expect(currentHeadingId(list, false)).toBe('b');
  });

  it('returns the last heading at the bottom of the page, whatever the tops', () => {
    expect(currentHeadingId(headings(-900, 40, 500, 900), true)).toBe('h3');
    expect(currentHeadingId(headings(300, 900, 1500), true)).toBe('h2');
  });

  it('returns null for an empty list', () => {
    expect(currentHeadingId([], false)).toBeNull();
    expect(currentHeadingId([], true)).toBeNull();
  });
});
