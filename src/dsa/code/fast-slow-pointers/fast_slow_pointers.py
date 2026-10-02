class ListNode:
    """One node of a singly linked list: a value and a link to the next node."""

    def __init__(self, val: int, next: "ListNode | None" = None) -> None:
        self.val = val
        self.next = next


def middle_node(head: ListNode | None) -> ListNode | None:
    """The middle node; the second of the two middles when the length is even."""
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
    return slow


def meeting_node(head: ListNode | None) -> ListNode | None:
    """A node inside the cycle where slow and fast meet, or None without a cycle."""
    slow = fast = head
    while fast is not None and fast.next is not None:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return slow
    return None


def has_cycle(head: ListNode | None) -> bool:
    return meeting_node(head) is not None


def cycle_start(head: ListNode | None) -> ListNode | None:
    """The first node of the cycle, or None when the list ends."""
    meet = meeting_node(head)
    if meet is None:
        return None
    walker = head
    while walker is not meet:
        walker = walker.next
        meet = meet.next
    return walker
