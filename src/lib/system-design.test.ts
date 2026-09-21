import { describe, expect, it } from 'vitest';
import type { Question } from '@/types';
import { TOPICS, getTopic } from './content';
import {
  QUESTIONS,
  extractQuestionRefs,
  extractTopicRefs,
  getQuestion,
  parseQuestion,
  questionsForTopic,
  topicsForQuestion,
} from './system-design';

const VALID_PATH = '/src/system-design/questions/my-question.md';

function rawQuestion(fields: Record<string, string | undefined>, body = 'Body text.\n') {
  const lines = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join('\n')}\n---\n\n${body}`;
}

const VALID_FIELDS = {
  title: 'Why is it slow?',
  summary: 'A one-line hook.',
  date: '2026-09-20',
  order: '3',
};

describe('parseQuestion (criterion 1)', () => {
  it('returns a Question with a numeric order and the frontmatter-stripped body', () => {
    const question = parseQuestion(
      VALID_PATH,
      rawQuestion(VALID_FIELDS, 'Hello body.\n'),
    );
    expect(question.slug).toBe('my-question');
    expect(question.title).toBe('Why is it slow?');
    expect(question.summary).toBe('A one-line hook.');
    expect(question.date).toBe('2026-09-20');
    expect(question.order).toBe(3);
    expect(typeof question.order).toBe('number');
    expect(question.body).toContain('Hello body.');
    expect(question.body).not.toContain('title:');
  });

  it.each(['title', 'summary', 'date', 'order'] as const)(
    'throws naming the file and the field when %s is missing',
    (field) => {
      const raw = rawQuestion({ ...VALID_FIELDS, [field]: undefined });
      expect(() => parseQuestion(VALID_PATH, raw)).toThrow(/my-question\.md/);
      expect(() => parseQuestion(VALID_PATH, raw)).toThrow(new RegExp(field));
    },
  );

  it.each(['0', '-1', '-7', '1.5', '2.0001', 'abc', 'two', ''])(
    'throws naming the file and "order" when order is %j',
    (order) => {
      const raw = rawQuestion({ ...VALID_FIELDS, order });
      expect(() => parseQuestion(VALID_PATH, raw)).toThrow(/my-question\.md/);
      expect(() => parseQuestion(VALID_PATH, raw)).toThrow(/order/);
    },
  );

  it('accepts a larger positive integer order', () => {
    expect(
      parseQuestion(VALID_PATH, rawQuestion({ ...VALID_FIELDS, order: '42' })).order,
    ).toBe(42);
  });

  it.each([
    '/src/content/ai-and-ml/my-question.md',
    '/src/system-design/my-question.md',
    '/src/system-design/questions/nested/my-question.md',
    '/src/system-design/questions/my-question.txt',
    '/src/system-design/questions/.md',
  ])('throws when the path %s is not /src/system-design/questions/<slug>.md', (path) => {
    expect(() => parseQuestion(path, rawQuestion(VALID_FIELDS))).toThrow();
  });
});

describe('QUESTIONS and getQuestion (criterion 2)', () => {
  it('loads at least one question', () => {
    expect(QUESTIONS.length).toBeGreaterThan(0);
  });

  it('is sorted by order ascending', () => {
    for (let i = 1; i < QUESTIONS.length; i++) {
      expect(QUESTIONS[i - 1].order).toBeLessThan(QUESTIONS[i].order);
    }
  });

  it('has unique order values and unique slugs', () => {
    const orders = QUESTIONS.map((q) => q.order);
    expect(new Set(orders).size).toBe(orders.length);
    const slugs = QUESTIONS.map((q) => q.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('holds the six seed questions from the spec as the first six, in the specified order', () => {
    expect(QUESTIONS.slice(0, 6).map((q) => [q.order, q.slug, q.title])).toEqual([
      [1, 'figuring-out-whats-wrong', "How do I figure out what's wrong with my system?"],
      [
        2,
        'database-cant-keep-up-with-reads',
        "What do I do when my database can't keep up with reads?",
      ],
      [
        3,
        'database-cant-keep-up-with-writes',
        "What do I do when one database can't keep up with writes?",
      ],
      [
        4,
        'one-failing-service-taking-down-others',
        'How do I stop one failing service from taking everything else down?',
      ],
      [
        5,
        'keeping-data-correct-under-concurrency',
        'How do I keep data correct when many users or services change it at once?',
      ],
      [
        6,
        'structuring-services-and-storage',
        'How should I structure my services and storage in the first place?',
      ],
    ]);
  });

  it('finds a known question by slug', () => {
    const [first] = QUESTIONS;
    expect(getQuestion(first.slug)).toEqual(first);
    expect(getQuestion('figuring-out-whats-wrong')?.order).toBe(1);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getQuestion('does-not-exist')).toBeUndefined();
  });
});

describe('real question content (criterion 3)', () => {
  it.each(QUESTIONS.map((q) => [q.slug, q] as const))(
    '%s has well-formed frontmatter, a body and at least one topic link',
    (_slug, question) => {
      expect(question.title.endsWith('?')).toBe(true);
      expect(question.summary.length).toBeGreaterThan(0);
      expect(question.summary).not.toMatch(/\n/);
      expect(question.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(question.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(question.body.trim().length).toBeGreaterThan(0);
      expect(extractTopicRefs(question.body).length).toBeGreaterThan(0);
    },
  );
});

describe('extractTopicRefs (criterion 4)', () => {
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
    expect(extractTopicRefs('[q](/system-design/some-question)')).toEqual([]);
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

  it('finds a link whose visible text spans two lines', () => {
    const body = 'This is [a link whose text\nwraps onto a second line](/alpha/one) ok.';
    expect(extractTopicRefs(body)).toEqual([{ section: 'alpha', slug: 'one' }]);
  });
});

describe('extractQuestionRefs (criterion 4)', () => {
  it('returns only /system-design/<slug> slugs, first-appearance order, de-duplicated', () => {
    const body = [
      '[two](/system-design/second) then [one](/system-design/first).',
      '[topic](/alpha/one) [ext](https://example.com/system-design/nope)',
      '[two again](/system-design/second) [single](/system-design)',
    ].join('\n');
    expect(extractQuestionRefs(body)).toEqual(['second', 'first']);
  });

  it('returns [] when there are none', () => {
    expect(extractQuestionRefs('[topic](/alpha/one)')).toEqual([]);
  });

  it('ignores a link inside a fenced code block', () => {
    const body = [
      '[real](/system-design/real)',
      '',
      '```',
      '[fake](/system-design/fake)',
      '```',
    ].join('\n');
    expect(extractQuestionRefs(body)).toEqual(['real']);
  });

  it('finds a link whose visible text spans two lines', () => {
    const body = '[text that\nwraps](/system-design/wrapped)';
    expect(extractQuestionRefs(body)).toEqual(['wrapped']);
  });
});

describe('no dead links in real questions (criterion 5)', () => {
  it.each(QUESTIONS.map((q) => [q.slug, q] as const))(
    '%s links only to topics and questions that exist',
    (_slug, question) => {
      for (const { section, slug } of extractTopicRefs(question.body)) {
        expect(getTopic(section, slug), `${section}/${slug}`).toBeDefined();
      }
      for (const slug of extractQuestionRefs(question.body)) {
        expect(getQuestion(slug), `/system-design/${slug}`).toBeDefined();
      }
    },
  );
});

describe('coverage of systems-and-infrastructure (criterion 6)', () => {
  it('has at least one systems-and-infrastructure topic to cover', () => {
    expect(TOPICS.some((t) => t.section === 'systems-and-infrastructure')).toBe(true);
  });

  it('places every systems-and-infrastructure topic under at least one question', () => {
    const covered = new Set(
      QUESTIONS.flatMap((q) => topicsForQuestion(q)).map((t) => `${t.section}/${t.slug}`),
    );
    const uncovered = TOPICS.filter(
      (t) =>
        t.section === 'systems-and-infrastructure' &&
        !covered.has(`${t.section}/${t.slug}`),
    ).map((t) => `${t.section}/${t.slug}`);
    expect(uncovered).toEqual([]);
  });
});

function stubQuestion(body: string, overrides: Partial<Question> = {}): Question {
  return {
    slug: 'stub',
    title: 'A stub question?',
    summary: 'Stub.',
    date: '2026-09-20',
    order: 99,
    body,
    ...overrides,
  };
}

describe('topicsForQuestion (criterion 7)', () => {
  const [t0, t1, t2] = TOPICS;
  const link = (t: { section: string; slug: string }, text = 'x') =>
    `[${text}](/${t.section}/${t.slug})`;

  it('returns resolved Topics in first-appearance order without duplicates', () => {
    const body = [
      link(t2),
      link(t0),
      link(t2, 'again'),
      link(t1),
      link(t0, 'again'),
    ].join('\n\n');
    const result = topicsForQuestion(stubQuestion(body));
    expect(result.map((t) => `${t.section}/${t.slug}`)).toEqual([
      `${t2.section}/${t2.slug}`,
      `${t0.section}/${t0.slug}`,
      `${t1.section}/${t1.slug}`,
    ]);
    expect(result[0]).toEqual(t2);
  });

  it('skips an unresolved ref without throwing', () => {
    const body = [link(t1), '[dead](/no-such-section/no-such-topic)', link(t0)].join(
      '\n\n',
    );
    let result: ReturnType<typeof topicsForQuestion> = [];
    expect(() => {
      result = topicsForQuestion(stubQuestion(body));
    }).not.toThrow();
    expect(result.map((t) => t.slug)).toEqual([t1.slug, t0.slug]);
  });

  it('returns [] for a question that links no topics', () => {
    expect(topicsForQuestion(stubQuestion('No links here.'))).toEqual([]);
  });

  it('matches extractTopicRefs on every real question', () => {
    for (const question of QUESTIONS) {
      const expected = extractTopicRefs(question.body)
        .map(({ section, slug }) => getTopic(section, slug))
        .filter((t) => t !== undefined)
        .map((t) => `${t.section}/${t.slug}`);
      expect(topicsForQuestion(question).map((t) => `${t.section}/${t.slug}`)).toEqual(
        expected,
      );
    }
  });
});

describe('questionsForTopic (criterion 7)', () => {
  function linkedTopicKeys(): Set<string> {
    return new Set(
      QUESTIONS.flatMap((q) => extractTopicRefs(q.body)).map(
        (r) => `${r.section}/${r.slug}`,
      ),
    );
  }

  it('returns the questions that link a topic, in order', () => {
    for (const topic of TOPICS) {
      const expected = QUESTIONS.filter((q) =>
        extractTopicRefs(q.body).some(
          (ref) => ref.section === topic.section && ref.slug === topic.slug,
        ),
      ).map((q) => q.slug);
      const actual = questionsForTopic(topic.section, topic.slug);
      expect(actual.map((q) => q.slug)).toEqual(expected);
      for (let i = 1; i < actual.length; i++) {
        expect(actual[i - 1].order).toBeLessThan(actual[i].order);
      }
    }
  });

  it('is consistent with topicsForQuestion in both directions', () => {
    for (const question of QUESTIONS) {
      for (const topic of topicsForQuestion(question)) {
        expect(questionsForTopic(topic.section, topic.slug).map((q) => q.slug)).toContain(
          question.slug,
        );
      }
    }
  });

  it('returns [] for a topic no question links', () => {
    const linked = linkedTopicKeys();
    const unlinked = TOPICS.find((t) => !linked.has(`${t.section}/${t.slug}`));
    expect(unlinked, 'expected at least one topic no question links').toBeDefined();
    expect(questionsForTopic(unlinked!.section, unlinked!.slug)).toEqual([]);
  });

  it('returns [] for a topic that does not exist', () => {
    expect(questionsForTopic('no-such-section', 'no-such-topic')).toEqual([]);
  });
});
