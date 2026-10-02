export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/** The middle node; the second of the two middles when the length is even. */
export function middleNode(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
  }
  return slow;
}

/** A node inside the cycle where slow and fast meet, or null without a cycle. */
export function meetingNode(head: ListNode | null): ListNode | null {
  let slow = head;
  let fast = head;
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
    if (slow === fast) return slow;
  }
  return null;
}

export function hasCycle(head: ListNode | null): boolean {
  return meetingNode(head) !== null;
}

/** The first node of the cycle, or null when the list ends. */
export function cycleStart(head: ListNode | null): ListNode | null {
  let meet = meetingNode(head);
  if (meet === null) return null;
  let walker = head;
  while (walker !== meet) {
    walker = walker!.next;
    meet = meet.next;
  }
  return walker;
}
