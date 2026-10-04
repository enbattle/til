import { describe, expect, it } from 'vitest';
import { MinHeap, RunningMedian } from './two-heaps';

function sortedMedian(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const mid = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('MinHeap (TypeScript)', () => {
  it('pops in order', () => {
    const heap = new MinHeap<number>((a, b) => a < b);
    for (const v of [5, 1, 4, 1, 3]) heap.push(v);
    expect(heap.size).toBe(5);
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop());
    expect(out).toEqual([1, 1, 3, 4, 5]);
  });
});

describe('RunningMedian (TypeScript)', () => {
  it('throws on an empty stream', () => {
    const stream = new RunningMedian();
    expect(stream.size).toBe(0);
    expect(() => stream.median()).toThrow();
  });

  it('handles a single element', () => {
    const stream = new RunningMedian();
    stream.add(7);
    expect(stream.size).toBe(1);
    expect(stream.median()).toBe(7);
  });

  it('gives the mean of two elements', () => {
    const stream = new RunningMedian();
    stream.add(1);
    stream.add(2);
    expect(stream.median()).toBe(1.5);
  });

  it('matches the worked example', () => {
    const stream = new RunningMedian();
    const medians: number[] = [];
    for (const value of [5, 2, 8, 1, 9, 3]) {
      stream.add(value);
      medians.push(stream.median());
    }
    expect(medians).toEqual([5, 3.5, 5, 3.5, 5, 4]);
  });

  it('handles ascending and descending input', () => {
    const ascending = Array.from({ length: 20 }, (_, i) => i);
    for (const values of [ascending, [...ascending].reverse()]) {
      const stream = new RunningMedian();
      values.forEach((value, i) => {
        stream.add(value);
        expect(stream.median()).toBe(sortedMedian(values.slice(0, i + 1)));
      });
    }
  });

  it('handles duplicates', () => {
    const stream = new RunningMedian();
    for (let i = 0; i < 5; i++) {
      stream.add(4);
      expect(stream.median()).toBe(4);
    }
  });

  it('handles negatives and zero', () => {
    const stream = new RunningMedian();
    const seen: number[] = [];
    for (const value of [-5, 0, -3, 0, -10, 2]) {
      stream.add(value);
      seen.push(value);
      expect(stream.median()).toBe(sortedMedian(seen));
    }
  });

  it('matches sorting on many random streams', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const random = seededRandom(seed);
      const stream = new RunningMedian();
      const seen: number[] = [];
      const length = 1 + Math.floor(random() * 40);
      for (let i = 0; i < length; i++) {
        const value = Math.floor(random() * 21) - 10;
        stream.add(value);
        seen.push(value);
        const at = `seed ${seed}: ${JSON.stringify(seen)}`;
        expect(stream.size, at).toBe(seen.length);
        expect(stream.median(), at).toBe(sortedMedian(seen));
      }
    }
  });
});
