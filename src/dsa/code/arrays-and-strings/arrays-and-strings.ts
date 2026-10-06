/** A growable array on fixed-size storage that doubles when it fills. */
export class DynamicArray<T> {
  private data: (T | undefined)[] = [undefined];
  private count = 0;

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this.data.length;
  }

  get(i: number): T {
    // Check against the length, not the capacity: the spare slots past it
    // would hand back undefined as if it were an item.
    if (!Number.isInteger(i) || i < 0 || i >= this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    return this.data[i] as T;
  }

  insert(i: number, item: T): void {
    // i === length is allowed: that is an append.
    if (!Number.isInteger(i) || i < 0 || i > this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    if (this.count === this.data.length) {
      // Double rather than add a fixed number of slots: a fixed step
      // copies everything every few appends, so n appends cost O(n^2).
      const spare = new Array<T | undefined>(this.data.length).fill(undefined);
      this.data = this.data.concat(spare);
    }
    // Shift from the right end: from the left, each item would overwrite
    // its neighbor before that neighbor had moved.
    for (let j = this.count; j > i; j--) {
      this.data[j] = this.data[j - 1];
    }
    this.data[i] = item;
    this.count += 1;
  }

  append(item: T): void {
    this.insert(this.count, item);
  }
}

/** Collects pieces and joins them once, in time linear in the total. */
export class StringBuilder {
  private parts: string[] = [];

  append(piece: string): this {
    // Storing the piece copies no text; += on a string would copy it all.
    this.parts.push(piece);
    return this;
  }

  build(): string {
    const text = this.parts.join('');
    // Keep the result as one piece, so a second build won't join it all again.
    this.parts = [text];
    return text;
  }
}

export function reverseCodePoints(s: string): string {
  // split('') cuts an emoji's surrogate pair in two; spread walks code points.
  // It still splits an "e" from the combining accent written after it.
  return [...s].reverse().join('');
}
