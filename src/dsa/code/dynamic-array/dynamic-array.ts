/** A growable array on fixed-size storage that doubles when it fills up. */
export class DynamicArray<T> {
  private data: (T | undefined)[];
  private count = 0;

  constructor(capacity = 4) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError('capacity must be a positive integer');
    }
    this.data = new Array<T | undefined>(capacity).fill(undefined);
  }

  get length(): number {
    return this.count;
  }

  get capacity(): number {
    return this.data.length;
  }

  private checkIndex(index: number, last = this.count - 1): void {
    if (!Number.isInteger(index) || index < 0 || index > last) {
      throw new RangeError(`index ${index} is out of range`);
    }
  }

  get(index: number): T {
    this.checkIndex(index);
    return this.data[index] as T;
  }

  set(index: number, value: T): void {
    this.checkIndex(index);
    this.data[index] = value;
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (let i = 0; i < this.count; i++) yield this.data[i] as T;
  }

  private resize(capacity: number): void {
    const next = new Array<T | undefined>(capacity).fill(undefined);
    for (let i = 0; i < this.count; i++) next[i] = this.data[i];
    this.data = next;
  }

  push(value: T): void {
    if (this.count === this.data.length) this.resize(this.data.length * 2);
    this.data[this.count] = value;
    this.count++;
  }

  insert(index: number, value: T): void {
    this.checkIndex(index, this.count);
    if (this.count === this.data.length) this.resize(this.data.length * 2);
    this.data.copyWithin(index + 1, index, this.count);
    this.data[index] = value;
    this.count++;
  }

  removeAt(index: number): T {
    this.checkIndex(index);
    const value = this.data[index] as T;
    this.data.copyWithin(index, index + 1, this.count);
    this.count--;
    this.data[this.count] = undefined;
    if (this.count <= this.data.length / 4 && this.data.length > 1) {
      this.resize(Math.floor(this.data.length / 2));
    }
    return value;
  }

  pop(): T | undefined {
    return this.count === 0 ? undefined : this.removeAt(this.count - 1);
  }
}
