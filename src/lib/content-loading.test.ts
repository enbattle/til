import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  TOPICS,
  createBodyStore,
  loadAllTopicBodies,
  loadTopicBody,
  parseTopicMeta,
} from './content';
import { parseFrontmatter } from './frontmatter';

// The test's own view of the raw files, independent of the app's loaders.
const RAW = import.meta.glob('/src/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function rawFor(section: string, slug: string): string {
  const raw = RAW[`/src/content/${section}/${slug}.md`];
  if (raw === undefined) throw new Error(`no raw file for ${section}/${slug}`);
  return raw;
}

const VALID = {
  title: 'A title',
  summary: 'A summary.',
  date: '2026-01-02',
};

describe('TOPICS is metadata only (criterion 1)', () => {
  it('gives every entry exactly section, slug, title, summary and date, and no body', () => {
    expect(TOPICS.length).toBeGreaterThan(0);
    for (const topic of TOPICS) {
      expect(topic).not.toHaveProperty('body');
      expect(Object.keys(topic).sort()).toEqual([
        'date',
        'section',
        'slug',
        'summary',
        'title',
      ]);
    }
  });

  it('is sorted by title', () => {
    const titles = TOPICS.map((t) => t.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
  });

  it('has one entry per markdown file, with the file frontmatter as its metadata', () => {
    expect(TOPICS).toHaveLength(Object.keys(RAW).length);
    for (const topic of TOPICS) {
      const { data } = parseFrontmatter(rawFor(topic.section, topic.slug));
      expect(topic.title).toBe(data.title);
      expect(topic.summary).toBe(data.summary);
      expect(topic.date).toBe(data.date);
    }
  });
});

describe('parseTopicMeta (criterion 2)', () => {
  it('returns section, slug and frontmatter fields from a valid path and data', () => {
    const topic = parseTopicMeta('/src/content/alpha/some-topic.md', VALID);
    expect(topic).toEqual({
      section: 'alpha',
      slug: 'some-topic',
      title: 'A title',
      summary: 'A summary.',
      date: '2026-01-02',
    });
    expect(topic).not.toHaveProperty('body');
  });

  it.each(['title', 'summary', 'date'] as const)(
    'throws naming the file and the field when %s is missing',
    (field) => {
      const data: Record<string, string> = { ...VALID };
      delete data[field];
      expect(() => parseTopicMeta('/src/content/alpha/some-topic.md', data)).toThrow(
        `alpha/some-topic.md is missing required frontmatter field "${field}"`,
      );
    },
  );

  it.each(['title', 'summary', 'date'] as const)(
    'throws when %s is present but empty',
    (field) => {
      expect(() =>
        parseTopicMeta('/src/content/alpha/some-topic.md', { ...VALID, [field]: '' }),
      ).toThrow(new RegExp(`"${field}"`));
    },
  );

  it.each([
    '/src/content/some-topic.md',
    '/src/content/alpha/nested/some-topic.md',
    '/src/elsewhere/alpha/some-topic.md',
    '/src/content/alpha/some-topic.txt',
    'not a path',
  ])('throws for a path that is not /src/content/<section>/<slug>.md: %s', (filePath) => {
    expect(() => parseTopicMeta(filePath, VALID)).toThrow(filePath);
  });
});

describe('createBodyStore (criterion 3)', () => {
  it('resolves a key to what its loader returns', async () => {
    const store = createBodyStore({ 'a/one': async () => 'body one' });
    await expect(store.load('a/one')).resolves.toBe('body one');
  });

  it('rejects an unknown key with an error naming it, without calling any loader', async () => {
    const loader = vi.fn(async () => 'x');
    const store = createBodyStore({ 'a/one': loader });
    await expect(store.load('a/missing')).rejects.toThrow('a/missing');
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns the same promise for the same key and invokes its loader once', async () => {
    const loader = vi.fn(async () => 'body one');
    const store = createBodyStore({ 'a/one': loader });
    const first = store.load('a/one');
    const second = store.load('a/one');
    expect(second).toBe(first);
    await first;
    expect(store.load('a/one')).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps different keys independent', async () => {
    const store = createBodyStore({
      'a/one': async () => 'one',
      'a/two': async () => 'two',
    });
    expect(await store.load('a/one')).toBe('one');
    expect(await store.load('a/two')).toBe('two');
  });

  it('evicts a rejected load so the next call invokes the loader again', async () => {
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce('recovered');
    const store = createBodyStore({ 'a/one': loader });

    await expect(store.load('a/one')).rejects.toThrow('chunk failed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(store.load('a/one')).resolves.toBe('recovered');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not evict a load that succeeded', async () => {
    const loader = vi.fn(async () => 'ok');
    const store = createBodyStore({ 'a/one': loader });
    await store.load('a/one');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await store.load('a/one');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('createBodyStore.loadAll (criterion 4)', () => {
  it('resolves one entry per loader, keyed as given', async () => {
    const store = createBodyStore({
      'a/one': async () => 'one',
      'b/two': async () => 'two',
      'b/three': async () => 'three',
    });
    const all = await store.loadAll();
    expect(all).toBeInstanceOf(Map);
    expect(Object.fromEntries(all)).toEqual({
      'a/one': 'one',
      'b/two': 'two',
      'b/three': 'three',
    });
  });

  it('resolves an empty map when there are no loaders', async () => {
    const all = await createBodyStore({}).loadAll();
    expect(all.size).toBe(0);
  });

  it('is memoized after success: a second call does not re-run any loader', async () => {
    const one = vi.fn(async () => 'one');
    const two = vi.fn(async () => 'two');
    const store = createBodyStore({ 'a/one': one, 'a/two': two });
    const first = await store.loadAll();
    const second = await store.loadAll();
    expect(Object.fromEntries(second)).toEqual(Object.fromEntries(first));
    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight load between concurrent calls', async () => {
    const one = vi.fn(async () => 'one');
    const store = createBodyStore({ 'a/one': one });
    await Promise.all([store.loadAll(), store.loadAll()]);
    expect(one).toHaveBeenCalledTimes(1);
  });

  it('rejects when any loader rejects, then retries on a later call', async () => {
    const good = vi.fn(async () => 'good');
    const flaky = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('chunk failed'))
      .mockResolvedValueOnce('recovered');
    const store = createBodyStore({ 'a/good': good, 'a/flaky': flaky });

    await expect(store.loadAll()).rejects.toThrow('chunk failed');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const all = await store.loadAll();

    expect(Object.fromEntries(all)).toEqual({ 'a/good': 'good', 'a/flaky': 'recovered' });
    expect(flaky).toHaveBeenCalledTimes(2);
  });
});

describe('loadTopicBody (criterion 3)', () => {
  it('resolves a real topic body equal to the raw file with its frontmatter stripped', async () => {
    const body = await loadTopicBody('engineering-practices', 'plan-before-you-build');
    const expected = parseFrontmatter(
      rawFor('engineering-practices', 'plan-before-you-build'),
    ).content;
    expect(body).toBe(expected);
    expect(body.trim().length).toBeGreaterThan(0);
    expect(body.startsWith('---')).toBe(false);
    expect(body).not.toMatch(/^summary:/m);
  });

  it('returns the same promise for the same topic', () => {
    const first = loadTopicBody('ai-and-ml', 'prompt-engineering');
    const second = loadTopicBody('ai-and-ml', 'prompt-engineering');
    expect(second).toBe(first);
  });

  it('rejects for a slug that is not in TOPICS, naming it', async () => {
    await expect(loadTopicBody('ai-and-ml', 'no-such-topic')).rejects.toThrow(
      /no-such-topic/,
    );
  });

  it('rejects for a section that is not in TOPICS, naming it', async () => {
    await expect(loadTopicBody('no-such-section', 'prompt-engineering')).rejects.toThrow(
      /no-such-section/,
    );
  });
});

describe('loadAllTopicBodies (criterion 4)', () => {
  let bodies: Map<string, string>;
  beforeAll(async () => {
    bodies = await loadAllTopicBodies();
  });

  it('has exactly one entry per topic, keyed section/slug', () => {
    expect(bodies.size).toBe(TOPICS.length);
    expect([...bodies.keys()].sort()).toEqual(
      TOPICS.map((t) => `${t.section}/${t.slug}`).sort(),
    );
  });

  it('holds a non-empty body for every topic, equal to its raw file without frontmatter', () => {
    for (const topic of TOPICS) {
      const key = `${topic.section}/${topic.slug}`;
      const body = bodies.get(key);
      expect(body?.trim().length, key).toBeGreaterThan(0);
      expect(body, key).toBe(parseFrontmatter(rawFor(topic.section, topic.slug)).content);
    }
  });

  it('agrees with loadTopicBody', async () => {
    const topic = TOPICS[0];
    expect(await loadTopicBody(topic.section, topic.slug)).toBe(
      bodies.get(`${topic.section}/${topic.slug}`),
    );
  });
});
