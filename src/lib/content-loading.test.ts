import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  TOPICS,
  createBodyStore,
  createCollection,
  loadAllTopicBodies,
  loadTopicBody,
  parseTopicMeta,
} from './content';
import { parseFrontmatter } from './frontmatter';
import { RAW_TOPICS as RAW, rawTopic as rawFor } from '@/test/content';

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
      expect(topic.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

// docs/specs/dedupe-app-scripts-tests.md, criterion 4: one loader shape for
// topics, case studies and DSA entries. `createCollection({ meta, bodies, parse,
// key })` takes the eager `?meta` glob (path -> frontmatter), the lazy `?raw`
// glob (path -> loader of the raw file), `parse(path, data)` and `key(path)`
// (the item's key, or undefined for a path that isn't one). It returns
// `{ items, get, loadBody, loadAllBodies }`. Every meta path goes through
// `parse`, so a malformed file still throws at load as it does today; a body
// path that `key` rejects is skipped.
describe('createCollection (dedupe criterion 4)', () => {
  interface Fake {
    slug: string;
    title: string;
  }

  const RAW_ONE = '---\ntitle: One\n---\n\nBody one.\n';
  const RAW_TWO = '\uFEFF---\r\ntitle: Two\r\n---\r\n\r\nBody two.\r\n';
  const PATH = /^\/fake\/([a-z]+)\.md$/;
  const key = (path: string) => PATH.exec(path)?.[1];
  const parse = (path: string, data: Record<string, string>): Fake => {
    const slug = key(path);
    if (!slug) throw new Error(`bad path: ${path}`);
    return { slug, title: data.title };
  };

  function fakes(extraBodies: Record<string, () => Promise<string>> = {}) {
    const one = vi.fn(async () => RAW_ONE);
    const two = vi.fn(async () => RAW_TWO);
    const collection = createCollection({
      meta: { '/fake/one.md': { title: 'One' }, '/fake/two.md': { title: 'Two' } },
      bodies: { '/fake/one.md': one, '/fake/two.md': two, ...extraBodies },
      parse,
      key,
    });
    return { collection, one, two };
  }

  it('parses one item per meta file', () => {
    const { collection } = fakes();
    expect([...collection.items].sort((a, b) => a.slug.localeCompare(b.slug))).toEqual([
      { slug: 'one', title: 'One' },
      { slug: 'two', title: 'Two' },
    ]);
  });

  it('passes parse the path and its frontmatter', () => {
    const spy = vi.fn(parse);
    createCollection({
      meta: { '/fake/one.md': { title: 'One' } },
      bodies: {},
      parse: spy,
      key,
    });
    expect(spy).toHaveBeenCalledWith('/fake/one.md', { title: 'One' });
  });

  it('throws when parse throws for a meta file (a malformed file fails loudly)', () => {
    expect(() =>
      createCollection({
        meta: { '/fake/one.md': { title: 'One' }, '/elsewhere/x.md': { title: 'X' } },
        bodies: {},
        parse,
        key,
      }),
    ).toThrow('/elsewhere/x.md');
  });

  it('get finds an item by key, as the same object items holds', () => {
    const { collection } = fakes();
    const found = collection.get('two');
    expect(found).toEqual({ slug: 'two', title: 'Two' });
    expect(collection.items).toContain(found);
  });

  it('get returns undefined for an unknown key', () => {
    const { collection } = fakes();
    expect(collection.get('nope')).toBeUndefined();
    expect(collection.get('/fake/one.md')).toBeUndefined();
  });

  it('loadBody resolves the body with its frontmatter stripped', async () => {
    const { collection } = fakes();
    await expect(collection.loadBody('one')).resolves.toBe(
      parseFrontmatter(RAW_ONE).content,
    );
    const two = await collection.loadBody('two');
    expect(two).toBe(parseFrontmatter(RAW_TWO).content);
    expect(two).toContain('Body two.');
    expect(two).not.toContain('title:');
  });

  it('loadBody returns the same promise twice and loads the file once', async () => {
    const { collection, one } = fakes();
    const first = collection.loadBody('one');
    expect(collection.loadBody('one')).toBe(first);
    await first;
    expect(collection.loadBody('one')).toBe(first);
    expect(one).toHaveBeenCalledTimes(1);
  });

  it('loadBody rejects an unknown key, naming it, without loading anything', async () => {
    const { collection, one, two } = fakes();
    await expect(collection.loadBody('nope')).rejects.toThrow('nope');
    expect(one).not.toHaveBeenCalled();
    expect(two).not.toHaveBeenCalled();
  });

  it('loadBody rejects a key that has a body file but no item', async () => {
    const three = vi.fn(async () => '---\ntitle: Three\n---\nBody three.\n');
    const { collection } = fakes({ '/fake/three.md': three });
    await expect(collection.loadBody('three')).rejects.toThrow('three');
    expect(three).not.toHaveBeenCalled();
  });

  it('loadAllBodies returns every body, keyed by key, frontmatter stripped', async () => {
    const { collection } = fakes();
    const all = await collection.loadAllBodies();
    expect(all).toBeInstanceOf(Map);
    expect(Object.fromEntries(all)).toEqual({
      one: parseFrontmatter(RAW_ONE).content,
      two: parseFrontmatter(RAW_TWO).content,
    });
  });

  it('skips a body path that key() rejects', async () => {
    const stray = vi.fn(async () => 'stray');
    const { collection } = fakes({ '/fake/Not_A_Slug.md': stray, '/other/x.md': stray });
    const all = await collection.loadAllBodies();
    expect([...all.keys()].sort()).toEqual(['one', 'two']);
    expect(stray).not.toHaveBeenCalled();
    await expect(collection.loadBody('Not_A_Slug')).rejects.toThrow('Not_A_Slug');
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
