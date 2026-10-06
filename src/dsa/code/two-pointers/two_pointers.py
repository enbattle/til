def pair_with_sum(nums: list[int], target: int) -> tuple[int, int] | None:
    """Indices (i, j), i < j, of two values in sorted nums that add up to target."""
    left, right = 0, len(nums) - 1
    # < not <=: with equal pointers one element would be paired with itself.
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return left, right
        # Too small: nums[left] is too small even beside the largest value still
        # in play, so no pair uses it. Too big: nums[right] fails the same way
        # beside the smallest. Either move rules one element out for good.
        if total < target:
            left += 1
        else:
            right -= 1
    return None


class ListNode:
    """One node of a singly linked list: a value and a link to the next node."""

    def __init__(self, val: int, next: "ListNode | None" = None) -> None:
        self.val = val
        self.next = next


def has_cycle(head: ListNode | None) -> bool:
    """True when following next from head never reaches the end."""
    slow = fast = head
    # Test fast and fast.next: fast.next.next reads the next of nothing when
    # an odd-length list leaves fast on its last node.
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        # After moving, not before: both start at head, so before always matches.
        # `is`, not ==: two different nodes can hold equal values.
        if slow is fast:
            return True
    return False
