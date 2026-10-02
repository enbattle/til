import { describe, expect, it } from 'vitest';
import { Trie } from './trie';

// The trie entry's TypeScript code, compared against a plain Set of words.
// API: `new Trie()` with `insert` and `delete` (each returns whether the set
// changed), `has` for exact words, `startsWith`, `wordsWithPrefix` (sorted by
// code point) and `size`.

/** A small seeded random number generator (mulberry32), returning [0, 1). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NodeShape {
  children: Map<string, NodeShape>;
}

function countNodes(trie: Trie): number {
  let total = 0;
  const stack = [(trie as unknown as { root: NodeShape }).root];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    total++;
    stack.push(...node.children.values());
  }
  return total;
}

/** Compares strings code point by code point, as Python's sort does. */
function byCodePoint(a: string, b: string): number {
  const x = Array.from(a, (c) => c.codePointAt(0) ?? 0);
  const y = Array.from(b, (c) => c.codePointAt(0) ?? 0);
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (x[i] !== y[i]) return x[i] - y[i];
  }
  return x.length - y.length;
}

/** Every prefix (in code points) of every word, plus '' for the root. */
function prefixesOf(words: Set<string>): Set<string> {
  const out = new Set<string>(['']);
  for (const w of words) {
    const chars = Array.from(w);
    for (let i = 1; i <= chars.length; i++) out.add(chars.slice(0, i).join(''));
  }
  return out;
}

function make(...words: string[]): Trie {
  const trie = new Trie();
  for (const w of words) trie.insert(w);
  return trie;
}

describe('Trie (TypeScript)', () => {
  it('starts empty', () => {
    const trie = new Trie();
    expect(trie.size).toBe(0);
    expect(trie.has('')).toBe(false);
    expect(trie.has('a')).toBe(false);
    expect(trie.startsWith('')).toBe(false);
    expect(trie.startsWith('a')).toBe(false);
    expect(trie.wordsWithPrefix('')).toEqual([]);
    expect(trie.delete('a')).toBe(false);
    expect(trie.delete('')).toBe(false);
  });

  it('inserts words and finds exactly those words', () => {
    const trie = make('app', 'apple', 'apt', 'bat');
    expect(trie.size).toBe(4);
    for (const w of ['app', 'apple', 'apt', 'bat']) expect(trie.has(w)).toBe(true);
    for (const w of ['a', 'ap', 'appl', 'ba', 'apples', 'b', 'cat']) {
      expect(trie.has(w)).toBe(false);
    }
    expect(countNodes(trie)).toBe(10);
  });

  it('reports whether an insert added a new word', () => {
    const trie = new Trie();
    expect(trie.insert('app')).toBe(true);
    expect(trie.insert('app')).toBe(false);
    expect(trie.size).toBe(1);
  });

  it('treats a prefix of a word as absent until it is inserted', () => {
    const trie = make('apple');
    expect(trie.has('app')).toBe(false);
    expect(trie.startsWith('app')).toBe(true);
    const nodes = countNodes(trie);
    expect(trie.insert('app')).toBe(true);
    expect(trie.has('app')).toBe(true);
    expect(countNodes(trie)).toBe(nodes);
  });

  it('answers startsWith', () => {
    const trie = make('app', 'apple', 'bat');
    for (const p of ['', 'a', 'ap', 'app', 'appl', 'apple', 'b', 'bat']) {
      expect(trie.startsWith(p)).toBe(true);
    }
    for (const p of ['apples', 'c', 'bb', 'bat ']) {
      expect(trie.startsWith(p)).toBe(false);
    }
  });

  it('lists the words with a prefix in sorted order', () => {
    const trie = make('bat', 'apt', 'apple', 'app', 'b');
    expect(trie.wordsWithPrefix('ap')).toEqual(['app', 'apple', 'apt']);
    expect(trie.wordsWithPrefix('')).toEqual(['app', 'apple', 'apt', 'b', 'bat']);
    expect(trie.wordsWithPrefix('apple')).toEqual(['apple']);
    expect(trie.wordsWithPrefix('appl')).toEqual(['apple']);
    expect(trie.wordsWithPrefix('c')).toEqual([]);
    expect(trie.wordsWithPrefix('apples')).toEqual([]);
  });

  it('stores the empty string as a word', () => {
    const trie = new Trie();
    expect(trie.insert('')).toBe(true);
    expect(trie.has('')).toBe(true);
    expect(trie.size).toBe(1);
    expect(trie.startsWith('')).toBe(true);
    expect(trie.startsWith('a')).toBe(false);
    trie.insert('a');
    expect(trie.wordsWithPrefix('')).toEqual(['', 'a']);
    expect(trie.delete('')).toBe(true);
    expect(trie.has('')).toBe(false);
    expect(trie.has('a')).toBe(true);
    expect(trie.delete('')).toBe(false);
    expect(trie.wordsWithPrefix('')).toEqual(['a']);
  });

  it('deletes a word that is a prefix of another without removing nodes', () => {
    const trie = make('app', 'apple');
    const nodes = countNodes(trie);
    expect(trie.delete('app')).toBe(true);
    expect(trie.has('app')).toBe(false);
    expect(trie.has('apple')).toBe(true);
    expect(trie.startsWith('app')).toBe(true);
    expect(countNodes(trie)).toBe(nodes);
    expect(trie.size).toBe(1);
  });

  it('deletes a word that has another as a prefix, pruning back to it', () => {
    const trie = make('app', 'apple');
    expect(trie.delete('apple')).toBe(true);
    expect(trie.has('apple')).toBe(false);
    expect(trie.has('app')).toBe(true);
    expect(trie.startsWith('appl')).toBe(false);
    expect(countNodes(trie)).toBe(4);
    expect(trie.wordsWithPrefix('')).toEqual(['app']);
  });

  it('prunes only the branch no other word uses', () => {
    const trie = make('apple', 'apt');
    expect(trie.delete('apple')).toBe(true);
    expect(countNodes(trie)).toBe(4);
    expect(trie.wordsWithPrefix('a')).toEqual(['apt']);
    expect(trie.delete('apt')).toBe(true);
    expect(countNodes(trie)).toBe(1);
    expect(trie.size).toBe(0);
    expect(trie.startsWith('')).toBe(false);
  });

  it.each(['ap', 'apples', 'b', '', 'app'])(
    'changes nothing when deleting the absent word %j',
    (absent) => {
      const trie = make('apple');
      if (absent === 'app') {
        trie.insert('app');
        trie.delete('app');
      }
      const nodes = countNodes(trie);
      expect(trie.delete(absent)).toBe(false);
      expect(trie.size).toBe(1);
      expect(trie.has('apple')).toBe(true);
      expect(countNodes(trie)).toBe(nodes);
    },
  );

  it('can insert a word again after deleting it', () => {
    const trie = make('apple');
    trie.delete('apple');
    expect(trie.insert('apple')).toBe(true);
    expect(trie.has('apple')).toBe(true);
    expect(countNodes(trie)).toBe(6);
  });

  it('takes one step per code point for non-ASCII and astral characters', () => {
    const trie = make('café', 'caf', '😀', '😀b', 'a😀');
    expect(countNodes(trie)).toBe(1 + 4 + 2 + 2);
    expect(trie.has('café')).toBe(true);
    expect(trie.has('cafe')).toBe(false);
    expect(trie.has('\ud83d')).toBe(false);
    expect(trie.startsWith('\ud83d')).toBe(false);
    expect(trie.startsWith('😀')).toBe(true);
    expect(trie.wordsWithPrefix('😀')).toEqual(['😀', '😀b']);
    expect(trie.delete('😀b')).toBe(true);
    expect(trie.wordsWithPrefix('😀')).toEqual(['😀']);
    expect(countNodes(trie)).toBe(1 + 4 + 1 + 2);
  });

  it('sorts by code point across the U+FFFF boundary, not by UTF-16 unit', () => {
    // U+FF5E sorts before U+1F600 by code point, after it by UTF-16 unit.
    const trie = make('\u{1f600}', '～', 'z');
    expect(trie.wordsWithPrefix('')).toEqual(['z', '～', '\u{1f600}']);
  });

  it('handles a word thousands of characters long', () => {
    const word = 'ab'.repeat(3000);
    const trie = make(word, word.slice(0, 4000));
    expect(trie.has(word)).toBe(true);
    expect(trie.wordsWithPrefix(word.slice(0, 5000))).toEqual([word]);
    expect(trie.wordsWithPrefix('ab')).toEqual([word.slice(0, 4000), word]);
    expect(trie.delete(word)).toBe(true);
    expect(countNodes(trie)).toBe(4001);
  });

  it('matches a Set of words on 200 seeded random operation sequences', () => {
    const alphabet = ['a', 'b', 'é', '～', '\u{1f600}'];
    for (let seed = 0; seed < 200; seed++) {
      const rand = seeded(seed);
      const randomWord = () => {
        const length = Math.floor(rand() * 5);
        let w = '';
        for (let i = 0; i < length; i++)
          w += alphabet[Math.floor(rand() * alphabet.length)];
        return w;
      };
      const trie = new Trie();
      const words = new Set<string>();
      for (let step = 0; step < 60; step++) {
        const w = randomWord();
        const op = rand();
        if (op < 0.45) {
          expect(trie.insert(w)).toBe(!words.has(w));
          words.add(w);
        } else if (op < 0.75) {
          expect(trie.delete(w)).toBe(words.has(w));
          words.delete(w);
        } else {
          const matching = [...words].filter((x) => x.startsWith(w)).sort(byCodePoint);
          expect(trie.has(w)).toBe(words.has(w));
          expect(trie.startsWith(w)).toBe(matching.length > 0);
          expect(trie.wordsWithPrefix(w)).toEqual(matching);
        }
        expect(trie.size).toBe(words.size);
        expect(countNodes(trie)).toBe(prefixesOf(words).size);
      }
      expect(trie.wordsWithPrefix('')).toEqual([...words].sort(byCodePoint));
    }
  });
});
