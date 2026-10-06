/** Indices [i, j], i < j, of two values in sorted `nums` that add up to `target`. */
export function pairWithSum(nums: number[], target: number): [number, number] | null {
  let left = 0;
  let right = nums.length - 1;
  // < not <=: with equal pointers one element would be paired with itself.
  while (left < right) {
    const total = nums[left] + nums[right];
    if (total === target) return [left, right];
    // Too small: nums[left] is too small even beside the largest value still
    // in play, so no pair uses it. Too big: nums[right] fails the same way
    // beside the smallest. Either move rules one element out for good.
    if (total < target) left++;
    else right--;
  }
  return null;
}

export class ListNode {
  val: number;
  next: ListNode | null;

  constructor(val: number, next: ListNode | null = null) {
    this.val = val;
    this.next = next;
  }
}

/** True when following next from head never reaches the end. */
export function hasCycle(head: ListNode | null): boolean {
  let slow = head;
  let fast = head;
  // Test fast and fast.next: fast.next.next reads the next of nothing when
  // an odd-length list leaves fast on its last node.
  while (fast !== null && fast.next !== null) {
    slow = slow!.next;
    fast = fast.next.next;
    // After moving, not before: both start at head, so before always matches.
    // === compares nodes, not values: two different nodes can hold equal values.
    if (slow === fast) return true;
  }
  return false;
}
