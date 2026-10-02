/** One link: a value and the next node, or null at the end of the list. */
export class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/** A singly linked list that keeps pointers to its first and last nodes. */
export class LinkedList<T> implements Iterable<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private count = 0;

  constructor(values: Iterable<T> = []) {
    for (const value of values) this.pushBack(value);
  }

  get size(): number {
    return this.count;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  pushFront(value: T): void {
    const node = new ListNode(value);
    node.next = this.head;
    this.head = node;
    this.tail ??= node;
    this.count++;
  }

  pushBack(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
    } else {
      this.tail.next = node;
    }
    this.tail = node;
    this.count++;
  }

  popFront(): T | undefined {
    const node = this.head;
    if (node === null) return undefined;
    this.head = node.next;
    if (this.head === null) this.tail = null;
    this.count--;
    return node.value;
  }

  find(value: T): ListNode<T> | null {
    let node = this.head;
    while (node !== null && node.value !== value) node = node.next;
    return node;
  }

  remove(value: T): boolean {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    while (node !== null && node.value !== value) {
      prev = node;
      node = node.next;
    }
    if (node === null) return false;
    if (prev === null) {
      this.head = node.next;
    } else {
      prev.next = node.next;
    }
    if (node === this.tail) this.tail = prev;
    this.count--;
    return true;
  }

  reverse(): void {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    this.tail = node;
    while (node !== null) {
      const following: ListNode<T> | null = node.next;
      node.next = prev;
      prev = node;
      node = following;
    }
    this.head = prev;
  }
}
