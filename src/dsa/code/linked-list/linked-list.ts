/** One link: a value and the next node, or null at the end. */
export class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

/** A singly linked list that keeps pointers to both ends. */
export class LinkedList<T> implements Iterable<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;

  *[Symbol.iterator](): Iterator<T> {
    for (let node = this.head; node !== null; node = node.next) {
      yield node.value;
    }
  }

  pushFront(value: T): void {
    const node = new ListNode(value);
    // Aim the new node at the old head before moving head. The other order
    // makes it point at itself and drops the rest of the list.
    node.next = this.head;
    this.head = node;
    this.tail ??= node;
  }

  pushBack(value: T): void {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
    } else {
      // Through the tail; walking from head to find it would cost O(n).
      this.tail.next = node;
    }
    this.tail = node;
  }

  popFront(): T | undefined {
    const node = this.head;
    if (node === null) return undefined;
    this.head = node.next;
    // Left alone, tail keeps the popped node and the next pushBack links
    // after it, so head never gets set.
    if (this.head === null) this.tail = null;
    return node.value;
  }

  remove(value: T): boolean {
    // A node can't say who points at it, so carry that node along.
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
    // Left alone, pushBack would link after a node that's gone.
    if (node === this.tail) this.tail = prev;
    return true;
  }

  reverse(): void {
    let prev: ListNode<T> | null = null;
    let node = this.head;
    // The old head ends up last, and nothing will point at it afterward.
    this.tail = node;
    while (node !== null) {
      // Saved first: the next line overwrites the only way forward.
      const following: ListNode<T> | null = node.next;
      node.next = prev;
      prev = node;
      node = following;
    }
    this.head = prev;
  }
}
