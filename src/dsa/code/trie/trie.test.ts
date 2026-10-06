import { describe, expect, it } from 'vitest';
import { Trie } from './trie';

// The trie entry's TypeScript code. API: `new Trie()` with `insert(word)`,
// `has(word)`, `startsWith(prefix)`, `wordsWithPrefix(prefix)` (every stored
// word, in no fixed order) and `delete(word)` (true when the word was stored).

/** A small seeded generator (mulberry32), so a failing case can be replayed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Node {
  children: Map<string, Node>;
  isWord: boolean;
}
const rootOf = (t: Trie) => (t as unknown as { root: Node }).root;

const WORDS = ['app', 'apple', 'apt', 'bat'];
const build = (words: string[]) => {
  const t = new Trie();
  for (const w of words) t.insert(w);
  return t;
};
const sorted = (xs: string[]) => [...xs].sort();

/** Nodes below the root. */
function countNodes(t: Trie): number {
  let total = 0;
  const stack = [rootOf(t)];
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    total += n.children.size;
    stack.push(...n.children.values());
  }
  return total;
}

const prefixes = (words: string[]) =>
  new Set(words.flatMap((w) => [...Array(w.length)].map((_, i) => w.slice(0, i + 1))));

/** Counts every lookup with get on every node's children map. */
function instrument(t: Trie): { gets: number } {
  const counter = { gets: 0 };
  const stack = [rootOf(t)];
  for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
    const kids = n.children;
    const original = kids.get.bind(kids);
    kids.get = (k: string) => {
      counter.gets++;
      return original(k);
    };
    stack.push(...kids.values());
  }
  return counter;
}

function randomWords(r: () => number): string[] {
  const count = Math.floor(r() * 13);
  return Array.from({ length: count }, () =>
    Array.from({ length: Math.floor(r() * 6) }, () => 'abc'[Math.floor(r() * 3)]).join(
      '',
    ),
  );
}

describe('Trie (TypeScript)', () => {
  it('handles an empty trie', () => {
    const t = new Trie();
    expect(t.has('')).toBe(false);
    expect(t.has('a')).toBe(false);
    expect(t.startsWith('')).toBe(false);
    expect(t.startsWith('a')).toBe(false);
    expect(t.wordsWithPrefix('')).toEqual([]);
    expect(t.delete('a')).toBe(false);
  });

  it('handles a single word', () => {
    const t = build(['a']);
    expect(t.has('a')).toBe(true);
    expect(t.has('b')).toBe(false);
    expect(t.startsWith('')).toBe(true);
    expect(t.wordsWithPrefix('a')).toEqual(['a']);
  });

  it('answers the running example', () => {
    const t = build(WORDS);
    for (const w of WORDS) expect(t.has(w)).toBe(true);
    for (const w of ['ap', 'appl', 'apples']) expect(t.has(w)).toBe(false);
    expect(t.startsWith('ap')).toBe(true);
    expect(t.startsWith('apple')).toBe(true);
    expect(t.startsWith('apples')).toBe(false);
    expect(t.startsWith('c')).toBe(false);
    expect(sorted(t.wordsWithPrefix('ap'))).toEqual(['app', 'apple', 'apt']);
    expect(sorted(t.wordsWithPrefix(''))).toEqual(sorted(WORDS));
    expect(t.wordsWithPrefix('appl')).toEqual(['apple']);
    expect(t.wordsWithPrefix('x')).toEqual([]);
  });

  it('does not store a word that is only a prefix', () => {
    const t = build(['apple']);
    expect(t.has('app')).toBe(false);
    expect(t.startsWith('app')).toBe(true);
  });

  it('adds no nodes when a prefix is inserted after the longer word', () => {
    const t = build(['apple']);
    const before = countNodes(t);
    t.insert('app');
    expect(countNodes(t)).toBe(before);
    expect(t.has('app')).toBe(true);
  });

  it('ignores a duplicate insert', () => {
    const t = build(WORDS);
    t.insert(['ap', 'ple'].join(''));
    expect(countNodes(t)).toBe(9);
    expect(sorted(t.wordsWithPrefix(''))).toEqual(sorted(WORDS));
  });

  it('stores the empty string as a word', () => {
    const t = build(['']);
    expect(t.has('')).toBe(true);
    expect(t.wordsWithPrefix('')).toEqual(['']);
    expect(t.delete('')).toBe(true);
    expect(t.has('')).toBe(false);
  });

  it('steps by code point', () => {
    const t = build(['hé', '\u{1f600}x', '\u{1f600}y']);
    expect(t.has('hé')).toBe(true);
    expect(t.startsWith('\u{1f600}')).toBe(true);
    expect(t.startsWith('\ud83d')).toBe(false);
    expect(sorted(t.wordsWithPrefix('\u{1f600}'))).toEqual(['\u{1f600}x', '\u{1f600}y']);
    expect(rootOf(t).children.size).toBe(2);
  });

  it('handles a very long word without recursion', () => {
    const word = 'a'.repeat(50000);
    const t = build([word]);
    expect(t.has(word)).toBe(true);
    expect(t.wordsWithPrefix('')).toEqual([word]);
    expect(t.delete(word)).toBe(true);
    expect(countNodes(t)).toBe(0);
  });

  it('deleting the longer word keeps the shorter one', () => {
    const t = build(WORDS);
    expect(t.delete('apple')).toBe(true);
    expect(t.has('apple')).toBe(false);
    expect(t.has('app')).toBe(true);
    expect(t.startsWith('appl')).toBe(false);
    expect(countNodes(t)).toBe(7);
  });

  it('deleting the shorter word keeps the longer one', () => {
    const t = build(WORDS);
    expect(t.delete('app')).toBe(true);
    expect(t.has('app')).toBe(false);
    expect(t.has('apple')).toBe(true);
    expect(countNodes(t)).toBe(9);
  });

  it('refuses to delete a word that is not stored', () => {
    const t = build(WORDS);
    for (const w of ['ap', 'apples', 'zzz']) expect(t.delete(w)).toBe(false);
    expect(countNodes(t)).toBe(9);
    expect(sorted(t.wordsWithPrefix(''))).toEqual(sorted(WORDS));
  });

  it('leaves only the root after deleting everything', () => {
    const t = build(WORDS);
    for (const w of WORDS) expect(t.delete(w)).toBe(true);
    expect(countNodes(t)).toBe(0);
    expect(t.startsWith('')).toBe(false);
    expect(t.delete('app')).toBe(false);
  });

  it('shares nodes between words with a common prefix', () => {
    // 14 characters, 9 nodes; one chain per word would make 14.
    const t = build(WORDS);
    expect(countNodes(t)).toBe(9);
    expect(countNodes(t)).toBe(prefixes(WORDS).size);
    expect([...rootOf(t).children.keys()].sort()).toEqual(['a', 'b']);
  });

  it('takes one step per character whatever the size', () => {
    const r = rng(7);
    const big = new Set<string>();
    while (big.size < 500) {
      big.add(Array.from({ length: 8 }, () => 'abcdefgh'[Math.floor(r() * 8)]).join(''));
    }
    for (const words of [['apple'], [...big, 'apple']]) {
      const t = build(words);
      const counter = instrument(t);
      expect(t.has('apple'), `${words.length} words`).toBe(true);
      expect(counter.gets, `${words.length} words`).toBe(5);
      counter.gets = 0;
      expect(t.startsWith('app'), `${words.length} words`).toBe(true);
      expect(counter.gets, `${words.length} words`).toBe(3);
    }
  });

  it('matches a set on random words', () => {
    for (let seed = 0; seed < 50; seed++) {
      const words = randomWords(rng(seed));
      const t = build(words);
      const stored = new Set(words);
      expect(countNodes(t), `seed ${seed}`).toBe(prefixes(words).size);
      for (const probe of [...prefixes(words), '', 'abcab', 'ccccc']) {
        const want = sorted([...stored].filter((w) => w.startsWith(probe)));
        expect(t.has(probe), `seed ${seed} ${probe}`).toBe(stored.has(probe));
        expect(sorted(t.wordsWithPrefix(probe)), `seed ${seed} prefix ${probe}`).toEqual(
          want,
        );
        expect(t.startsWith(probe), `seed ${seed} ${probe}`).toBe(want.length > 0);
      }
    }
  });

  it('matches a set and prunes after random deletes', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = rng(seed);
      const words = randomWords(r);
      const t = build(words);
      const stored = new Set(words);
      const pool = [...words, 'abc', 'cab'];
      for (let step = 0; step < 12; step++) {
        const word = pool[Math.floor(r() * pool.length)];
        expect(t.delete(word), `seed ${seed} step ${step}`).toBe(stored.has(word));
        stored.delete(word);
        expect(t.has(word), `seed ${seed} step ${step}`).toBe(false);
        expect(countNodes(t), `seed ${seed} step ${step}`).toBe(
          prefixes([...stored]).size,
        );
      }
      expect(sorted(t.wordsWithPrefix('')), `seed ${seed}`).toEqual(sorted([...stored]));
    }
  });
});
