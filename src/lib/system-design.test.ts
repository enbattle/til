import { describe, expect, it } from 'vitest';
import { TOPICS, getTopic } from './content';
import { RAW_CASE_STUDIES as RAW, rawCaseStudy as rawFor, without } from '@/test/content';
import { parseFrontmatter } from './frontmatter';
import { extractTopicRefs } from './markdown.mjs';
import {
  CASE_STUDIES,
  caseStudiesForTopic,
  getCaseStudy,
  loadCaseStudyBody,
  parseCaseStudy,
  topicsForCaseStudy,
} from './system-design';

// The test's own view of the real case-study files (RAW, rawFor) comes from
// src/test/content.ts, independent of the app's loaders.

function slugOf(filePath: string): string {
  return filePath.replace(/^.*\/([^/]+)\.md$/, '$1');
}

const REAL = Object.entries(RAW).map(([filePath, raw]) => ({
  slug: slugOf(filePath),
  body: parseFrontmatter(raw).content,
}));

/** `section/slug` of the first real topic a case study's file links to, read
 * from the file at test time so no test pins a link inside published prose. */
function firstLinkedTopic(slug: string): string {
  const ref = extractTopicRefs(parseFrontmatter(rawFor(slug)).content).find(
    ({ section, slug: topicSlug }) => getTopic(section, topicSlug) !== undefined,
  );
  expect(ref, `${slug} links to no real topic`).toBeDefined();
  return `${ref!.section}/${ref!.slug}`;
}

const VALID_PATH = '/src/system-design/case-studies/my-case.md';
const NAME = 'system-design/case-studies/my-case.md';

const VALID_FIELDS: Record<string, string> = {
  title: 'Design a Widget Service (like a widget store)',
  summary: 'A one-line hook.',
  date: '2026-09-28',
  order: '3',
};

// `parseCaseStudy(filePath, data)` takes the file path and its already-parsed
// frontmatter (what the `?meta` query yields), like `parseTopicMeta`.
describe('parseCaseStudy (criterion 3)', () => {
  it('returns slug, title, summary, date and a numeric order, and no body', () => {
    const caseStudy = parseCaseStudy(VALID_PATH, VALID_FIELDS);
    // toMatchObject, not toEqual: the `words` count (five-minute criterion 3)
    // comes from the build-time view, wherever the loader merges it in.
    expect(caseStudy).toMatchObject({
      slug: 'my-case',
      title: 'Design a Widget Service (like a widget store)',
      summary: 'A one-line hook.',
      date: '2026-09-28',
      order: 3,
    });
    expect(typeof caseStudy.order).toBe('number');
    expect(caseStudy).not.toHaveProperty('body');
  });

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws naming the file and the field when %s is missing',
    (field) => {
      expect(() => parseCaseStudy(VALID_PATH, without(VALID_FIELDS, field))).toThrow(
        new Error(`${NAME} is missing required frontmatter field "${field}"`),
      );
    },
  );

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws the same message when %s is present but empty',
    (field) => {
      const data = { ...VALID_FIELDS, [field]: '' };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(
        new Error(`${NAME} is missing required frontmatter field "${field}"`),
      );
    },
  );

  // docs/specs/content-dedupe.md, criterion 1: the allowed-key check moves from
  // the structure test into the loader, so an unknown key fails at load time.
  it.each(['tags', 'kind'])(
    'throws naming the file and the key for an unknown frontmatter field %s',
    (key) => {
      expect(() => parseCaseStudy(VALID_PATH, { ...VALID_FIELDS, [key]: '2' })).toThrow(
        new Error(`${NAME} has an unknown frontmatter field "${key}"`),
      );
    },
  );

  // docs/specs/case-study-template-3.md, criterion 3: `template: 3` is the
  // per-page switch to template 3; no other value is allowed, and the switch
  // stays out of the returned metadata.
  it('accepts template: 3, returning the same metadata as without it', () => {
    const withSwitch = parseCaseStudy(VALID_PATH, { ...VALID_FIELDS, template: '3' });
    expect(withSwitch).toEqual(parseCaseStudy(VALID_PATH, VALID_FIELDS));
    expect(Object.keys(withSwitch).sort()).toEqual([
      'date',
      'order',
      'path',
      'slug',
      'summary',
      'title',
    ]);
    expect(withSwitch).not.toHaveProperty('template');
  });

  it.each(['2', 'three', '', '03', ' 3'])(
    'throws naming the file and "template" when template is %j',
    (template) => {
      const data = { ...VALID_FIELDS, template };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/template/);
    },
  );

  it.each(['0', '-1', '-7', '1.5', '2.0001', 'abc', 'two', ' 3', '3x', '1e2'])(
    'throws naming the file and "order" when order is %j',
    (order) => {
      const data = { ...VALID_FIELDS, order };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/order/);
    },
  );

  it('accepts a larger positive integer order', () => {
    expect(parseCaseStudy(VALID_PATH, { ...VALID_FIELDS, order: '42' }).order).toBe(42);
  });

  it.each([
    '/src/content/ai-and-ml/my-case.md',
    '/src/system-design/my-case.md',
    '/src/system-design/questions/my-case.md',
    '/src/system-design/case-studies/nested/my-case.md',
    '/src/system-design/case-studies/my-case.txt',
    '/src/system-design/case-studies/.md',
    'not a path',
  ])(
    'throws naming the path when it is not /src/system-design/case-studies/<slug>.md: %s',
    (filePath) => {
      expect(() => parseCaseStudy(filePath, VALID_FIELDS)).toThrow(filePath);
    },
  );
});

describe('CASE_STUDIES and getCaseStudy (criteria 3 and 4)', () => {
  it('loads one entry per case-study file, and at least one', () => {
    expect(CASE_STUDIES.length).toBeGreaterThan(0);
    expect(CASE_STUDIES).toHaveLength(Object.keys(RAW).length);
  });

  // ui-dedupe criterion 2 adds the page path.
  it('is metadata only: exactly slug, title, summary, date, order, words and path (five-minute criterion 3)', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(Object.keys(caseStudy).sort()).toEqual([
        'date',
        'order',
        'path',
        'slug',
        'summary',
        'title',
        'words',
      ]);
    }
  });

  // docs/specs/ui-dedupe.md, criterion 2.
  it('gives every case study its page route as path, /system-design/<slug>', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(caseStudy.path, caseStudy.slug).toBe(`/system-design/${caseStudy.slug}`);
    }
  });

  it('matches each file’s frontmatter', () => {
    for (const caseStudy of CASE_STUDIES) {
      const { data } = parseFrontmatter(rawFor(caseStudy.slug));
      expect(caseStudy.title).toBe(data.title);
      expect(caseStudy.summary).toBe(data.summary);
      expect(caseStudy.date).toBe(data.date);
      expect(caseStudy.order).toBe(Number(data.order));
    }
  });

  it('is sorted by order ascending', () => {
    for (let i = 1; i < CASE_STUDIES.length; i++) {
      expect(CASE_STUDIES[i - 1].order).toBeLessThan(CASE_STUDIES[i].order);
    }
  });

  it('has unique order values and unique slugs across the real case studies', () => {
    const orders = CASE_STUDIES.map((c) => c.order);
    expect(new Set(orders).size).toBe(orders.length);
    const slugs = CASE_STUDIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('has well-formed values on every real case study', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(caseStudy.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(caseStudy.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(caseStudy.summary).not.toMatch(/\n/);
      expect(Number.isInteger(caseStudy.order)).toBe(true);
      expect(caseStudy.order).toBeGreaterThan(0);
    }
  });

  it('finds the URL shortener by slug', () => {
    const caseStudy = getCaseStudy('url-shortener');
    expect(caseStudy).toBeDefined();
    expect(caseStudy?.slug).toBe('url-shortener');
    expect(caseStudy).toBe(CASE_STUDIES.find((c) => c.slug === 'url-shortener'));
  });

  it('returns undefined for an unknown slug', () => {
    expect(getCaseStudy('does-not-exist')).toBeUndefined();
    expect(getCaseStudy('database-cant-keep-up-with-reads')).toBeUndefined();
  });
});

describe('loadCaseStudyBody (criterion 5)', () => {
  it('resolves the real URL shortener body, frontmatter stripped', async () => {
    const body = await loadCaseStudyBody('url-shortener');
    expect(body).toBe(parseFrontmatter(rawFor('url-shortener')).content);
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body.startsWith('---')).toBe(false);
    expect(body).not.toMatch(/^order:/m);
    expect(body).not.toMatch(/^summary:/m);
  });

  it('resolves every real case study to its own body', async () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(await loadCaseStudyBody(caseStudy.slug)).toBe(
        parseFrontmatter(rawFor(caseStudy.slug)).content,
      );
    }
  });
});

describe('topicsForCaseStudy (criterion 6)', () => {
  it('returns synchronously, from build-time link data, without loading a body', () => {
    const caseStudy = getCaseStudy('url-shortener')!;
    const result = topicsForCaseStudy(caseStudy);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('matches the resolved topic links of every real case study, in first-appearance order', () => {
    for (const { slug, body } of REAL) {
      const expected = extractTopicRefs(body)
        .map(({ section, slug: topicSlug }) => getTopic(section, topicSlug))
        .filter((t) => t !== undefined)
        .map((t) => `${t.section}/${t.slug}`);
      const actual = topicsForCaseStudy(getCaseStudy(slug)!).map(
        (t) => `${t.section}/${t.slug}`,
      );
      expect(actual, slug).toEqual(expected);
      expect(new Set(actual).size, slug).toBe(actual.length);
    }
  });

  it('returns full Topic objects', () => {
    const [first] = topicsForCaseStudy(getCaseStudy('url-shortener')!);
    expect(first).toEqual(getTopic(first.section, first.slug));
  });

  // The link is read from the URL shortener's file now, not pinned here, so a
  // rewrite of its prose can't break this (docs/specs/harness-follow-ups.md,
  // criterion 9).
  it('includes a topic the URL shortener links to', () => {
    const linked = firstLinkedTopic('url-shortener');
    expect(
      topicsForCaseStudy(getCaseStudy('url-shortener')!).map(
        (t) => `${t.section}/${t.slug}`,
      ),
    ).toContain(linked);
  });

  it('returns [] for a case study that is not one of the real ones', () => {
    expect(
      topicsForCaseStudy({
        slug: 'not-real',
        title: 'Not real',
        summary: 'Stub.',
        date: '2026-09-28',
        order: 999,
        words: 1,
        path: '/system-design/not-real',
      }),
    ).toEqual([]);
  });
});

describe('caseStudiesForTopic (criterion 6)', () => {
  it('returns the case studies linking each topic, in order', () => {
    // Each case study's refs, parsed once rather than once per topic.
    const refsBySlug = new Map(
      CASE_STUDIES.map((c) => [
        c.slug,
        extractTopicRefs(parseFrontmatter(rawFor(c.slug)).content),
      ]),
    );
    for (const topic of TOPICS) {
      const expected = CASE_STUDIES.filter((c) =>
        refsBySlug
          .get(c.slug)!
          .some((r) => r.section === topic.section && r.slug === topic.slug),
      ).map((c) => c.slug);
      const actual = caseStudiesForTopic(topic.section, topic.slug);
      expect(Array.isArray(actual)).toBe(true);
      expect(
        actual.map((c) => c.slug),
        `${topic.section}/${topic.slug}`,
      ).toEqual(expected);
      for (let i = 1; i < actual.length; i++) {
        expect(actual[i - 1].order).toBeLessThan(actual[i].order);
      }
    }
  });

  it('lists the URL shortener for a topic its file links to', () => {
    const [section, topicSlug] = firstLinkedTopic('url-shortener').split('/');
    expect(caseStudiesForTopic(section, topicSlug).map((c) => c.slug)).toContain(
      'url-shortener',
    );
  });

  it('is consistent with topicsForCaseStudy in both directions', () => {
    for (const caseStudy of CASE_STUDIES) {
      for (const topic of topicsForCaseStudy(caseStudy)) {
        expect(caseStudiesForTopic(topic.section, topic.slug)).toContain(caseStudy);
      }
    }
  });

  it('returns [] for a topic no case study links', () => {
    // Found from the files now, not pinned, since any case study may come to
    // link a given topic (docs/specs/harness-follow-ups.md, criterion 9).
    const linked = new Set(
      CASE_STUDIES.flatMap((c) =>
        extractTopicRefs(parseFrontmatter(rawFor(c.slug)).content).map(
          (r) => `${r.section}/${r.slug}`,
        ),
      ),
    );
    const unlinked = TOPICS.find((t) => !linked.has(`${t.section}/${t.slug}`));
    expect(unlinked, 'every topic is linked; this case needs a fixture').toBeDefined();
    expect(caseStudiesForTopic(unlinked!.section, unlinked!.slug)).toEqual([]);
  });

  it('returns [] for a topic that does not exist', () => {
    expect(caseStudiesForTopic('no-such-section', 'no-such-topic')).toEqual([]);
  });
});

// Invariants over the real corpus that hold for any content: the topic → case
// study index is exactly the inverse of each case study's topic list, and
// every case study's topic list is duplicate-free and names only real topics.
describe('the real corpus links consistently', () => {
  const keyOf = (t: { section: string; slug: string }) => `${t.section}/${t.slug}`;
  const topicKeys = new Set(TOPICS.map(keyOf));

  it.each(CASE_STUDIES.map((c) => [c.slug, c] as const))(
    'topicsForCaseStudy(%s) has no duplicates and names only real topics',
    (_slug, caseStudy) => {
      const keys = topicsForCaseStudy(caseStudy).map(keyOf);
      expect(new Set(keys).size).toBe(keys.length);
      for (const key of keys) expect(topicKeys.has(key), key).toBe(true);
    },
  );

  it('caseStudiesForTopic is the inverse of topicsForCaseStudy for every topic', () => {
    for (const topic of TOPICS) {
      const key = keyOf(topic);
      const expected = CASE_STUDIES.filter((c) =>
        topicsForCaseStudy(c).map(keyOf).includes(key),
      ).map((c) => c.slug);
      expect(
        caseStudiesForTopic(topic.section, topic.slug).map((c) => c.slug),
        key,
      ).toEqual(expected);
    }
  });
});
