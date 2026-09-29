import { describe, expect, it } from 'vitest';
import { extractCaseStudyRefs, extractTopicRefs } from './markdown-links';

// The link extractors are a pure module (no `import.meta.glob`, no `@/` alias)
// so `vite.config.ts` can import them for the build-time `?links` query, the
// same way it already imports `frontmatter.ts` (spec: "Content and loading").

describe('extractTopicRefs (criterion 6)', () => {
  it('returns refs in first-appearance order, de-duplicated by section+slug', () => {
    const body = [
      'See [b](/beta/two) first, then [a](/alpha/one).',
      'Again [b again](/beta/two) and [c](/gamma/three) and [a again](/alpha/one).',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'beta', slug: 'two' },
      { section: 'alpha', slug: 'one' },
      { section: 'gamma', slug: 'three' },
    ]);
  });

  it('returns [] when there are no links', () => {
    expect(extractTopicRefs('Just prose, no links at all.')).toEqual([]);
  });

  it('ignores an external https link', () => {
    expect(extractTopicRefs('[ext](https://example.com/foo/bar)')).toEqual([]);
  });

  it('ignores a single-segment link', () => {
    expect(extractTopicRefs('[s](/only-one)')).toEqual([]);
  });

  it('ignores a link with more than two path segments', () => {
    expect(extractTopicRefs('[deep](/a/b/c)')).toEqual([]);
  });

  it('ignores /system-design/... links', () => {
    expect(extractTopicRefs('[q](/system-design/some-case-study)')).toEqual([]);
  });

  it('ignores a diagram image, which is not a link', () => {
    expect(extractTopicRefs('![Architecture](/diagrams/url-shortener.svg)')).toEqual([]);
    expect(extractTopicRefs('![Architecture](/diagrams/x/y.svg)')).toEqual([]);
  });

  it('ignores a link inside a fenced code block but counts links after it', () => {
    const body = [
      'Before [kept](/alpha/one).',
      '',
      '```md',
      '[hidden](/code/block)',
      '```',
      '',
      'After [also kept](/beta/two).',
    ].join('\n');
    expect(extractTopicRefs(body)).toEqual([
      { section: 'alpha', slug: 'one' },
      { section: 'beta', slug: 'two' },
    ]);
  });

  it('strips a #fragment from the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one#some-heading)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('strips a ?query from the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one?x=1)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('de-duplicates a link that appears with and without a fragment', () => {
    expect(extractTopicRefs('[a](/alpha/one#x) and [b](/alpha/one)')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('accepts a double-quoted title after the destination', () => {
    expect(extractTopicRefs('[a](/alpha/one "A title")')).toEqual([
      { section: 'alpha', slug: 'one' },
    ]);
  });

  it('finds a link whose visible text spans two lines', () => {
    const body = 'This is [a link whose text\nwraps onto a second line](/alpha/one) ok.';
    expect(extractTopicRefs(body)).toEqual([{ section: 'alpha', slug: 'one' }]);
  });
});

describe('extractCaseStudyRefs (criterion 6)', () => {
  it('returns only /system-design/<slug> slugs, first-appearance order, de-duplicated', () => {
    const body = [
      '[two](/system-design/second) then [one](/system-design/first).',
      '[topic](/alpha/one) [ext](https://example.com/system-design/nope)',
      '[two again](/system-design/second) [landing](/system-design)',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['second', 'first']);
  });

  it('returns [] when there are none', () => {
    expect(extractCaseStudyRefs('[topic](/alpha/one)')).toEqual([]);
  });

  it('ignores a link inside a fenced code block', () => {
    const body = [
      '[real](/system-design/real)',
      '',
      '```',
      '[fake](/system-design/fake)',
      '```',
    ].join('\n');
    expect(extractCaseStudyRefs(body)).toEqual(['real']);
  });

  it('strips a #fragment from the destination', () => {
    expect(extractCaseStudyRefs('[s](/system-design/real#trade-offs)')).toEqual(['real']);
  });

  it('finds a link whose visible text spans two lines', () => {
    const body = '[text that\nwraps](/system-design/wrapped)';
    expect(extractCaseStudyRefs(body)).toEqual(['wrapped']);
  });
});
