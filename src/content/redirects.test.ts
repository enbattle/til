import { describe, expect, it } from 'vitest';
import { TOPICS } from '@/lib/content';
import { SECTIONS } from './registry';

/**
 * docs/specs/catalog-standard.md, design §4 and criterion 6: `REDIRECTS` in
 * src/content/redirects.ts maps an old `section/slug` to a new one. Every
 * source has that shape (lowercase, no leading slash, no `.md`, a registered
 * section), so it can match a URL. Every
 * source is not a live topic, every target is a live topic, and no target is
 * itself a source (no chain, so no cycle either). Redirects are never removed,
 * so this spec's four moves stay in the map.
 *
 * The map is loaded inside the tests that need it, so the planted cases below
 * run (and show their own result) whether or not the module exists yet.
 */

type RedirectMap = Record<string, string> | ReadonlyMap<string, string>;

// A variable specifier, so a missing module fails these tests one by one
// instead of failing the file at transform time.
const MODULE = './redirects';

async function loadRedirects(): Promise<[string, string][]> {
  const mod = (await import(/* @vite-ignore */ MODULE)) as { REDIRECTS: RedirectMap };
  const map = mod.REDIRECTS;
  expect(map, 'redirects.ts exports REDIRECTS').toBeDefined();
  return map instanceof Map ? [...map.entries()] : Object.entries(map);
}

/** A `section/slug` path: lowercase, no leading slash, no `.md`. */
const PATH_SHAPE = /^[a-z0-9-]+\/[a-z0-9-]+$/;

const REGISTERED = new Set(SECTIONS.map((s) => s.slug));

/** Problems with `redirects` against the live topic paths `live`. */
function redirectProblems(redirects: [string, string][], live: Set<string>): string[] {
  const sources = new Set(redirects.map(([from]) => from));
  return redirects.flatMap(([from, to]) => [
    ...(PATH_SHAPE.test(from)
      ? []
      : [`${from} -> ${to}: the source ${from} is not shaped section/slug`]),
    ...(PATH_SHAPE.test(from) && !REGISTERED.has(from.split('/')[0])
      ? [`${from} -> ${to}: the source ${from} is not in a registered section`]
      : []),
    ...(live.has(from) ? [`${from} -> ${to}: the source ${from} is a live topic`] : []),
    ...(live.has(to) ? [] : [`${from} -> ${to}: the target ${to} is not a live topic`]),
    ...(sources.has(to)
      ? [`${from} -> ${to}: the target ${to} is itself redirected`]
      : []),
  ]);
}

const LIVE = new Set(TOPICS.map((t) => `${t.section}/${t.slug}`));

describe('the redirect check itself (catalog-standard criterion 6)', () => {
  const live = new Set(['security/jwt', 'security/xss']);

  it('passes a map from a gone path to a live topic', () => {
    expect(
      redirectProblems([['security/session-vs-token-auth', 'security/jwt']], live),
    ).toEqual([]);
  });

  it('fails a source that is still a live topic, naming it', () => {
    expect(redirectProblems([['security/xss', 'security/jwt']], live)).toEqual([
      expect.stringContaining('the source security/xss is a live topic'),
    ]);
  });

  it('fails a target that is not a live topic, naming it', () => {
    expect(redirectProblems([['security/old', 'security/missing']], live)).toEqual([
      expect.stringContaining('the target security/missing is not a live topic'),
    ]);
  });

  it('fails a chain', () => {
    expect(
      redirectProblems(
        [
          ['security/a', 'security/b'],
          ['security/b', 'security/jwt'],
        ],
        live,
      ),
    ).toEqual([
      'security/a -> security/b: the target security/b is not a live topic',
      'security/a -> security/b: the target security/b is itself redirected',
    ]);
  });

  it('fails a cycle', () => {
    const problems = redirectProblems(
      [
        ['security/a', 'security/b'],
        ['security/b', 'security/a'],
      ],
      live,
    );
    expect(problems).toContainEqual(expect.stringContaining('is itself redirected'));
    expect(problems.filter((p) => p.includes('itself redirected'))).toHaveLength(2);
  });

  it.each([
    ['a leading slash', '/security/old-xss', 'is not shaped section/slug'],
    ['a .md suffix', 'security/old-xss.md', 'is not shaped section/slug'],
    ['uppercase', 'security/Old-XSS', 'is not shaped section/slug'],
    ['an unregistered section', 'secuirty/old-xss', 'is not in a registered section'],
  ])('fails a source with %s, naming it', (_, from, problem) => {
    expect(redirectProblems([[from, 'security/jwt']], live)).toEqual([
      `${from} -> security/jwt: the source ${from} ${problem}`,
    ]);
  });

  it('fails a redirect to itself', () => {
    expect(redirectProblems([['security/a', 'security/a']], live)).toContainEqual(
      expect.stringContaining('is itself redirected'),
    );
  });
});

describe('the real redirect map (catalog-standard criterion 6)', () => {
  it('has every source gone, every target live, and no chain or cycle', async () => {
    const redirects = await loadRedirects();
    expect(redirects.length).toBeGreaterThan(0);
    expect(redirectProblems(redirects, LIVE)).toEqual([]);
  });

  it('maps each of the four moved ai-and-ml topics to coding-agents', async () => {
    const redirects = new Map(await loadRedirects());
    for (const slug of [
      'context-is-a-budget',
      'documentation-vs-skill-vs-hook',
      'keeping-ai-native-docs-from-going-stale',
      'triaging-ai-code-review',
    ]) {
      expect(redirects.get(`ai-and-ml/${slug}`), slug).toBe(`coding-agents/${slug}`);
    }
  });
});
