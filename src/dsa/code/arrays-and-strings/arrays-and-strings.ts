// #region dynamic-array
/** A growable array on fixed-size storage that doubles when it fills. */
export class DynamicArray {
  data: string[] = [''];
  count = 0;

  size(): number {
    return this.count;
  }

  capacity(): number {
    return this.data.length;
  }

  get(i: number): string {
    // Check against the size, not the capacity: spare slots aren't items.
    if (i < 0 || i >= this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    return this.data[i];
  }
  // #endregion

  // #region insert
  insert(i: number, item: string): void {
    // i === size is allowed: that is an append.
    if (i < 0 || i > this.count) {
      throw new RangeError(`index ${i} out of range`);
    }
    if (this.count === this.data.length) {
      // Double rather than add a fixed number of slots: a fixed step
      // copies everything every few appends, so n appends cost O(n^2).
      const bigger: string[] = [];
      for (let j = 0; j < 2 * this.data.length; j++) {
        bigger.push('');
      }
      for (let j = 0; j < this.count; j++) {
        bigger[j] = this.data[j];
      }
      this.data = bigger;
    }
    // Shift from the right end: from the left, each item would overwrite
    // its neighbor before that neighbor had moved.
    for (let j = this.count; j > i; j--) {
      this.data[j] = this.data[j - 1];
    }
    this.data[i] = item;
    this.count += 1;
  }

  append(item: string): void {
    this.insert(this.count, item);
  }
}
// #endregion

// #region string-builder
/** Collects pieces and joins them once, in time linear in the total. */
export class StringBuilder {
  parts: string[] = [];

  append(piece: string): void {
    // Storing the piece copies no text; += on a string would copy it all.
    this.parts.push(piece);
  }

  build(): string {
    const text = this.parts.join('');
    // Keep the result as one piece, so a second build won't join it all again.
    this.parts = [text];
    return text;
  }
}
// #endregion

// #region reverse-string
export function reverseString(s: string): string {
  // A string can't be edited, so swap inside an array and join once at the end.
  // Array.from splits by code point. s.split('') would split an emoji
  // into its two halves, and the swaps would put them in the wrong order.
  const chars = Array.from(s);
  let left = 0;
  let right = chars.length - 1;
  while (left < right) {
    [chars[left], chars[right]] = [chars[right], chars[left]];
    left += 1;
    right -= 1;
  }
  return chars.join('');
}
// #endregion
