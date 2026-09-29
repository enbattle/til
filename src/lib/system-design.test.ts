import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOPICS, getTopic } from './content';
import { parseFrontmatter } from './frontmatter';
import { extractCaseStudyRefs, extractTopicRefs } from './markdown-links';
import {
  CASE_STUDIES,
  caseStudiesForTopic,
  getCaseStudy,
  isSystemDesignPath,
  loadCaseStudyBody,
  parseCaseStudy,
  topicsForCaseStudy,
} from './system-design';

// The test's own view of the real case-study files, independent of the app's
// loaders (which only load frontmatter eagerly).
const RAW = import.meta.glob('/src/system-design/case-studies/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function slugOf(filePath: string): string {
  return filePath.replace(/^.*\/([^/]+)\.md$/, '$1');
}

function rawFor(slug: string): string {
  const raw = RAW[`/src/system-design/case-studies/${slug}.md`];
  if (raw === undefined) throw new Error(`no raw file for case study ${slug}`);
  return raw;
}

const REAL = Object.entries(RAW).map(([filePath, raw]) => ({
  slug: slugOf(filePath),
  body: parseFrontmatter(raw).content,
}));

const VALID_PATH = '/src/system-design/case-studies/my-case.md';

const VALID_FIELDS: Record<string, string> = {
  title: 'Design a Widget Service (like a widget store)',
  summary: 'A one-line hook.',
  date: '2026-09-28',
  order: '3',
};

function without(field: string): Record<string, string> {
  const data = { ...VALID_FIELDS };
  delete data[field];
  return data;
}

// `parseCaseStudy(filePath, data)` takes the file path and its already-parsed
// frontmatter (what the `?meta` query yields), like `parseTopicMeta`.
describe('parseCaseStudy (criterion 3)', () => {
  it('returns slug, title, summary, date and a numeric order, and no body', () => {
    const caseStudy = parseCaseStudy(VALID_PATH, VALID_FIELDS);
    expect(caseStudy).toEqual({
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
      expect(() => parseCaseStudy(VALID_PATH, without(field))).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, without(field))).toThrow(new RegExp(field));
    },
  );

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws naming the file and the field when %s is present but empty',
    (field) => {
      const data = { ...VALID_FIELDS, [field]: '' };
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(/my-case\.md/);
      expect(() => parseCaseStudy(VALID_PATH, data)).toThrow(new RegExp(field));
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

  it('is metadata only: exactly slug, title, summary, date and order', () => {
    for (const caseStudy of CASE_STUDIES) {
      expect(Object.keys(caseStudy).sort()).toEqual([
        'date',
        'order',
        'slug',
        'summary',
        'title',
      ]);
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

  it('returns the same promise for the same case study', () => {
    expect(loadCaseStudyBody('url-shortener')).toBe(loadCaseStudyBody('url-shortener'));
  });

  it('rejects for an unknown slug, naming it', async () => {
    await expect(loadCaseStudyBody('no-such-case-study')).rejects.toThrow(
      /no-such-case-study/,
    );
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

  it('includes the caching topic for the URL shortener (its read-path deep dive)', () => {
    expect(
      topicsForCaseStudy(getCaseStudy('url-shortener')!).map(
        (t) => `${t.section}/${t.slug}`,
      ),
    ).toContain('systems-and-infrastructure/caching');
  });

  it('returns [] for a case study that is not one of the real ones', () => {
    expect(
      topicsForCaseStudy({
        slug: 'not-real',
        title: 'Not real',
        summary: 'Stub.',
        date: '2026-09-28',
        order: 999,
      }),
    ).toEqual([]);
  });
});

describe('caseStudiesForTopic (criterion 6)', () => {
  function linksTo(body: string, section: string, slug: string): boolean {
    return extractTopicRefs(body).some((r) => r.section === section && r.slug === slug);
  }

  it('returns the case studies linking each topic, in order', () => {
    for (const topic of TOPICS) {
      const expected = CASE_STUDIES.filter((c) =>
        linksTo(parseFrontmatter(rawFor(c.slug)).content, topic.section, topic.slug),
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

  it('lists the URL shortener for systems-and-infrastructure/caching', () => {
    expect(
      caseStudiesForTopic('systems-and-infrastructure', 'caching').map((c) => c.slug),
    ).toContain('url-shortener');
  });

  it('is consistent with topicsForCaseStudy in both directions', () => {
    for (const caseStudy of CASE_STUDIES) {
      for (const topic of topicsForCaseStudy(caseStudy)) {
        expect(caseStudiesForTopic(topic.section, topic.slug)).toContain(caseStudy);
      }
    }
  });

  it('returns [] for a topic no case study links', () => {
    expect(caseStudiesForTopic('ai-and-ml', 'prompt-engineering')).toEqual([]);
  });

  it('returns [] for a topic that does not exist', () => {
    expect(caseStudiesForTopic('no-such-section', 'no-such-topic')).toEqual([]);
  });
});

describe('no dead links in real case studies (criterion 6)', () => {
  it('has case studies to check', () => {
    expect(REAL.length).toBeGreaterThan(0);
  });

  it.each(REAL.map((c) => [c.slug, c.body] as const))(
    '%s links only to topics and case studies that exist',
    (_slug, body) => {
      for (const { section, slug } of extractTopicRefs(body)) {
        expect(getTopic(section, slug), `/${section}/${slug}`).toBeDefined();
      }
      for (const slug of extractCaseStudyRefs(body)) {
        expect(getCaseStudy(slug), `/system-design/${slug}`).toBeDefined();
      }
    },
  );
});

describe('isSystemDesignPath', () => {
  it.each(['/system-design', '/system-design/url-shortener'])('is true for %s', (p) => {
    expect(isSystemDesignPath(p)).toBe(true);
  });

  it.each(['/', '/ai-and-ml', '/ai-and-ml/prompt-engineering', '/system-designer'])(
    'is false for %s',
    (p) => {
      expect(isSystemDesignPath(p)).toBe(false);
    },
  );
});

describe('the question pages are gone (criterion 1)', () => {
  const SRC = path.resolve('src');

  function sourceFiles(dir: string, files: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) sourceFiles(full, files);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry)) files.push(full);
    }
    return files;
  }

  it('has no src/system-design/questions directory', () => {
    expect(existsSync(path.join(SRC, 'system-design', 'questions'))).toBe(false);
  });

  it('has no QuestionPage or QuestionNav module', () => {
    expect(existsSync(path.join(SRC, 'pages', 'QuestionPage.tsx'))).toBe(false);
    expect(existsSync(path.join(SRC, 'components', 'QuestionNav.tsx'))).toBe(false);
  });

  it('has no source file under src importing or globbing a question module', () => {
    const self = path.resolve('src/lib/system-design.test.ts');
    const importsQuestion =
      /(from\s+|import\s*\(\s*|import\s+)['"][^'"]*(QuestionNav|QuestionPage|system-design\/questions)[^'"]*['"]/;
    const globsQuestions = /import\.meta\.glob[^)]*system-design\/questions/;
    const offenders = sourceFiles(SRC)
      .filter((file) => file !== self)
      .filter((file) => {
        const source = readFileSync(file, 'utf8');
        return importsQuestion.test(source) || globsQuestions.test(source);
      })
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });
});
