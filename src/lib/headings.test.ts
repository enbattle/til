import { describe, expect, it } from 'vitest';
import { createHeadingIds, h2Headings, headingId } from './headings';

// Review finding L4: a heading with no ASCII letters or digits must still get a
// usable id (a fallback such as `section`), never an empty string, so its
// Contents link is never `href="#"`.
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('headingId with no ASCII letters or digits', () => {
  it.each(['日本語', '—', '!!!'])('returns a non-empty slug for %s', (text) => {
    expect(headingId(text)).toMatch(ID);
  });

  it('numbers repeats of a fallback id like any other duplicate', () => {
    const nextId = createHeadingIds();
    const base = headingId('日本語');
    expect([nextId('日本語'), nextId('日本語'), nextId('日本語')]).toEqual([
      base,
      `${base}-1`,
      `${base}-2`,
    ]);
  });

  it('gives h2Headings distinct, non-empty ids for two such headings', () => {
    const ids = h2Headings('## 日本語\n\nText.\n\n## —\n\nMore.\n').map((h) => h.id);
    expect(ids).toHaveLength(2);
    ids.forEach((id) => expect(id).toMatch(ID));
    expect(new Set(ids).size).toBe(2);
  });
});

// Interface assumed for src/lib/headings.ts (review finding L3):
//
// - `headingId(text)` is unchanged: the slug of a heading's rendered text.
// - `h2Headings(body)` returns the Contents entries, one per `##` heading in
//   order (fenced code skipped), as `{ text, id }`:
//     - `text` is the heading as it renders: inline markers (`**`, `*`, `_`
//       emphasis, backticks, link syntax) removed, but characters that are
//       part of the text (an underscore inside `user_id`) kept.
//     - `id` is the id MarkdownRenderer gives that same h2: `headingId(text)`
//       for the first heading with that slug, then `-1`, `-2`, ... for later
//       duplicates in the same body (`notes`, `notes-1`).
describe('h2Headings', () => {
  const BODY = [
    '## Deep dive: the `user_id` index',
    '',
    'Text.',
    '',
    '## Why *this* matters',
    '',
    '## A _quiet_ failure and a **loud** one',
    '',
    '## Notes',
    '',
    '```md',
    '## Not a heading',
    '```',
    '',
    '## Notes',
    '',
  ].join('\n');

  it('keeps underscores that are part of the text and drops emphasis markers', () => {
    expect(h2Headings(BODY).map((h) => h.text)).toEqual([
      'Deep dive: the user_id index',
      'Why this matters',
      'A quiet failure and a loud one',
      'Notes',
      'Notes',
    ]);
  });

  it('gives each heading the id its rendered text slugs to', () => {
    const [userId, why, quiet] = h2Headings(BODY);
    expect(userId.id).toBe('deep-dive-the-user-id-index');
    expect(userId.id).toBe(headingId('Deep dive: the user_id index'));
    expect(why.id).toBe('why-this-matters');
    expect(quiet.id).toBe('a-quiet-failure-and-a-loud-one');
  });

  it('gives duplicate headings distinct ids', () => {
    const notes = h2Headings(BODY).filter((h) => h.text === 'Notes');
    expect(notes.map((h) => h.id)).toEqual(['notes', 'notes-1']);
  });

  it('keeps a heading that is only a link as its link text', () => {
    expect(h2Headings('## See [caching](/systems-and-infrastructure/caching)\n')).toEqual(
      [{ text: 'See caching', id: 'see-caching' }],
    );
  });
});
