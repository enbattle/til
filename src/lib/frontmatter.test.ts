import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './frontmatter';

describe('parseFrontmatter', () => {
  it('parses flat key: value pairs out of a leading --- block', () => {
    const raw = [
      '---',
      'title: Git worktrees',
      'date: 2026-09-13',
      '---',
      '',
      'Body text.',
    ].join('\n');

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({ title: 'Git worktrees', date: '2026-09-13' });
    expect(content).toBe('Body text.');
  });

  it('keeps everything after the first colon as the value', () => {
    const raw = ['---', 'summary: Note: do this first', '---', 'Body'].join('\n');

    const { data } = parseFrontmatter(raw);

    expect(data.summary).toBe('Note: do this first');
  });

  it('treats content with no frontmatter block as the whole body', () => {
    const raw = '# Just a heading\n\nNo frontmatter here.';

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  it('returns the raw string unchanged if the closing delimiter is missing', () => {
    const raw = ['---', 'title: Oops, never closed', '', 'Body'].join('\n');

    const { data, content } = parseFrontmatter(raw);

    expect(data).toEqual({});
    expect(content).toBe(raw);
  });

  it('strips matching surrounding quotes from a value', () => {
    const raw = ['---', "title: 'Prompt Engineering: A Primer'", '---', 'Body'].join(
      '\n',
    );

    const { data } = parseFrontmatter(raw);

    expect(data.title).toBe('Prompt Engineering: A Primer');
  });

  it('ignores lines with no colon inside the frontmatter block', () => {
    const raw = ['---', 'title: Fine', 'not a key value line', '---', 'Body'].join('\n');

    const { data } = parseFrontmatter(raw);

    expect(data).toEqual({ title: 'Fine' });
  });
});
