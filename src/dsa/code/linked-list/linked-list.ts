// #region list-node
/** One link: a value and the next node, or null at the end. */
export class ListNode {
  value: number;
  next: ListNode | null = null;

  constructor(value: number) {
    this.value = value;
  }
}

/** A singly linked list that keeps pointers to both ends. */
export class LinkedList {
  head: ListNode | null = null;
  tail: ListNode | null = null;
  // #endregion

  // #region to-list
  toArray(): number[] {
    const values: number[] = [];
    let node = this.head;
    while (node !== null) {
      values.push(node.value);
      node = node.next;
    }
    return values;
  }
  // #endregion

  // #region push-front
  pushFront(value: number): void {
    const node = new ListNode(value);
    // Aim the new node at the old head before moving head. The other order
    // makes it point at itself and drops the rest of the list.
    node.next = this.head;
    this.head = node;
    if (this.tail === null) {
      this.tail = node;
    }
  }

  pushBack(value: number): void {
    const node = new ListNode(value);
    if (this.tail === null) {
      this.head = node;
    } else {
      // Through the tail; walking from head to find it would cost O(n).
      this.tail.next = node;
    }
    this.tail = node;
  }
  // #endregion

  // #region pop-front
  popFront(): number | undefined {
    const node = this.head;
    if (node === null) return undefined;
    this.head = node.next;
    if (this.head === null) {
      // Left alone, tail keeps the popped node and the next pushBack links
      // after it, so head never gets set.
      this.tail = null;
    }
    return node.value;
  }
  // #endregion

  // #region remove
  remove(value: number): boolean {
    // A node can't say who points at it, so carry that node along.
    let prev: ListNode | null = null;
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
    if (node === this.tail) {
      // Left alone, pushBack would link after a node that's gone.
      this.tail = prev;
    }
    return true;
  }
  // #endregion

  // #region reverse
  reverse(): void {
    let prev: ListNode | null = null;
    let node = this.head;
    // The old head ends up last, and nothing will point at it afterward.
    this.tail = node;
    while (node !== null) {
      // Saved first: the next line overwrites the only way forward.
      const following: ListNode | null = node.next;
      node.next = prev;
      prev = node;
      node = following;
    }
    this.head = prev;
  }
}
// #endregion
