---
title: Trie
summary: A tree that stores strings one character per level, so words that share a prefix share nodes and a lookup costs the length of the key, not the number of words.
date: 2026-10-01
kind: data-structure
---

Type "ap" into a search box and it offers "app", "apple" and "apt" before you
finish. Behind that sits a question a hash set can't answer quickly: which of
the stored words begin with these letters? A set can tell you whether "apple"
is in it, but to find every word starting with "ap" it has to look at all of
them. A **trie** (from re*trie*val, usually said "try") answers it by storing
the words so that a shared beginning is stored once, and the words that start
with a prefix all hang below one spot.

## Prerequisites

- [Hash Map](/dsa/hash-map): each node keeps its children in a map from a
  character to the next node, and the costs below assume that map's O(1)
  average lookup.
- [Arrays and strings](/dsa/arrays-and-strings): what a key is, and why the code steps through it by
  code point, so an emoji is one step and not two halves.

## What it is

A **tree** is a set of **nodes** joined by links, with one node at the top
called the **root**. Each link goes from a **parent** down to a **child**, and
every node except the root has exactly one parent. In a trie, each link is
labelled with one character, and each node stands for the string you spell by
reading the labels on the path from the root down to it. The root stands for
the empty string.

Here is the trie after inserting `"app"`, `"apple"`, `"apt"` and `"bat"`. Each
node is drawn as the character on the link into it, and `●` marks a node where
a stored word ends:

```text
root
├── a
│   └── p
│       ├── p ●          "app"
│       │   └── l
│       │       └── e ●  "apple"
│       └── t ●          "apt"
└── b
    └── a
        └── t ●          "bat"
```

The four words have 3 + 5 + 3 + 3 = 14 characters, but the trie has 9 nodes
below the root. `"apple"` reused the three nodes of `"app"` and added `l` and
`e`; `"apt"` reused `a` and `p` and added `t`; `"bat"` shares nothing with the
others and added three.

The `●` is the **end-of-word marker**, a true-or-false flag on every node, and
the trie can't work without it. The node for `"app"` is there whether or not
`"app"` was inserted, because `"apple"` needs it as a step on the way down.
Insert only `"apple"` and the path a-p-p still exists; without the flag, asking
whether `"app"` is stored would find the node and wrongly say yes. With it, the
answer is "the node exists but isn't marked", so no. And inserting `"app"`
after `"apple"` creates no nodes at all: setting the flag is the whole insert.

Every operation is a walk from the root, one character of the key per step.
Looking up `"apt"` follows `a`, then `p`, then `t`, and checks the flag.
Finding every word that starts with `"ap"` follows `a` and `p`, then lists
every marked node below that point. The words that start with a prefix are
exactly the marked nodes under the prefix's node, which is why a trie is the
usual answer to autocomplete.

## Operations and costs

L is the length of the key or prefix in characters (P for a prefix), n the
number of stored words, σ (sigma) the number of different characters a node can
have as children (26 for lowercase English), and k the number of nodes below
the prefix's node, with d the length of the longest word found there.

| Operation                   | Average              | Worst case             |
| --------------------------- | -------------------- | ---------------------- |
| `insert(word)`              | O(L)                 | O(σ·L)                 |
| `word in trie`, `has(word)` | O(L)                 | O(σ·L)                 |
| `starts_with(prefix)`       | O(P)                 | O(σ·P)                 |
| `words_with_prefix(prefix)` | O(P + k·(d + log σ)) | O(σ·P + k·(d + log σ)) |
| `delete(word)`              | O(L)                 | O(σ·L)                 |
| Space                       | O(total characters)  | O(total characters)    |

None of the per-word costs mention n. Each step down the trie is one lookup in
one node's children map, O(1) on average, and a key of length L takes L steps
whether the trie holds ten words or ten million. The worst-case column is the
hash map's worst case, a lookup that compares against every child in the node,
and a node has at most σ children.

That doesn't make a trie faster than a hash set for exact lookups. A hash set
also costs O(L) to check a word, because hashing the word reads every
character, and it does so in one tight loop rather than L separate map
lookups. The trie earns its place with prefix questions. `words_with_prefix`
walks P steps to the prefix's node, then visits each of the k nodes below it
once. Building each node's string with `word + ch` copies up to d characters,
and sorting a node's children so the words come out in order costs a log σ
factor per child.

Space is at most one node per character inserted, plus the root; shared
prefixes make it less. Per character, though, a node is expensive. Each one is
an object holding its own hash map, and in CPython 3.14, inserting 9,998
random lowercase words of 4 to 10 letters (69,970 characters, 48,168 nodes)
used about 10 MB, where a set of the same strings used about 1 MB, the strings
themselves included. When the alphabet is small and fixed, nodes often hold an
array of σ slots instead of a map: a lookup is a plain index, but every node
pays for all σ slots, used or not. A **radix tree** (also called a compressed
trie) saves the most by merging each chain of single-child nodes into one node
labelled with a whole substring.

## Implementation

A node is two fields: the map of children and the end-of-word flag. The trie
keeps its root and a count of stored words.

```python
class TrieNode:
    __slots__ = ("children", "is_word")

    def __init__(self) -> None:
        self.children: dict[str, TrieNode] = {}
        self.is_word = False


class Trie:
    """A set of strings stored as a tree with one character per edge."""

    def __init__(self) -> None:
        self._root = TrieNode()
        self._size = 0

    def __len__(self) -> int:
        return self._size
```

```typescript
class TrieNode {
  readonly children = new Map<string, TrieNode>();
  isWord = false;
}

type Edge = [string, TrieNode];

/** Orders edges by their one-code-point labels, largest first. */
function byLabelDescending([a]: Edge, [b]: Edge): number {
  return (b.codePointAt(0) ?? 0) - (a.codePointAt(0) ?? 0);
}

/** A set of strings stored as a tree with one character per edge. */
export class Trie {
  private readonly root = new TrieNode();
  private count = 0;

  get size(): number {
    return this.count;
  }
```

`__slots__` tells Python that a `TrieNode` has exactly these two attributes, so
each node skips the per-object dictionary Python would otherwise give it to
hold attributes. A trie makes one node per character, so the saving is paid
back many times over. The count is kept in its own field so that `len(trie)` is
O(1) instead of a walk over the whole tree. `byLabelDescending` is used by
`wordsWithPrefix` below.

```python
    def insert(self, word: str) -> bool:
        node = self._root
        for ch in word:
            child = node.children.get(ch)
            if child is None:
                child = node.children[ch] = TrieNode()
            node = child
        if node.is_word:
            return False
        node.is_word = True
        self._size += 1
        return True
```

```typescript
  insert(word: string): boolean {
    let node = this.root;
    for (const ch of word) {
      let child = node.children.get(ch);
      if (child === undefined) {
        child = new TrieNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    if (node.isWord) return false;
    node.isWord = true;
    this.count++;
    return true;
  }
```

`insert` walks down one character at a time and creates a node only where the
path runs out, so it follows shared prefixes for free. Both loops step through
the word by code point: Python's `for ch in word` already does, and
JavaScript's `for...of` does too, where indexing `word[i]` would step by UTF-16
unit and split an emoji into two nodes. When the walk ends, `node` is the
word's node, and the flag decides the rest. If it's already set the word is
stored already, and returning before `self._size += 1` keeps a repeated insert
from counting the word twice. The return value says whether the set changed,
the same answer Python's `set.add` would need a separate `in` check for.

```python
    def _find(self, prefix: str) -> TrieNode | None:
        node = self._root
        for ch in prefix:
            child = node.children.get(ch)
            if child is None:
                return None
            node = child
        return node

    def __contains__(self, word: str) -> bool:
        node = self._find(word)
        return node is not None and node.is_word

    def starts_with(self, prefix: str) -> bool:
        node = self._find(prefix)
        return node is not None and (node.is_word or bool(node.children))
```

```typescript
  private find(prefix: string): TrieNode | undefined {
    let node = this.root;
    for (const ch of prefix) {
      const child = node.children.get(ch);
      if (child === undefined) return undefined;
      node = child;
    }
    return node;
  }

  has(word: string): boolean {
    return this.find(word)?.isWord ?? false;
  }

  startsWith(prefix: string): boolean {
    const node = this.find(prefix);
    return node !== undefined && (node.isWord || node.children.size > 0);
  }
```

`_find` is the walk shared by every read: follow the characters and return the
node they lead to, or nothing as soon as a child is missing. The two questions
then differ only in what they ask of that node. An exact word needs the node to
exist and be marked; checking only that it exists is the `"app"` mistake from
earlier. A prefix needs the node to exist and to lead to some word, which is
what `node.is_word or bool(node.children)` tests; the Invariants section says
why that test is enough.

```python
    def words_with_prefix(self, prefix: str) -> list[str]:
        """Every stored word that starts with prefix, in code point order."""
        start = self._find(prefix)
        if start is None:
            return []
        found: list[str] = []
        stack = [(start, prefix)]
        while stack:
            node, word = stack.pop()
            if node.is_word:
                found.append(word)
            for ch, child in sorted(node.children.items(), reverse=True):
                stack.append((child, word + ch))
        return found
```

```typescript
  /** Every stored word that starts with prefix, in code point order. */
  wordsWithPrefix(prefix: string): string[] {
    const start = this.find(prefix);
    if (start === undefined) return [];
    const found: string[] = [];
    const stack: [TrieNode, string][] = [[start, prefix]];
    for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
      const [node, word] = top;
      if (node.isWord) found.push(word);
      for (const [ch, child] of [...node.children].sort(byLabelDescending)) {
        stack.push([child, word + ch]);
      }
    }
    return found;
  }
```

After finding the prefix's node, the method visits everything below it with an
explicit **stack**, a list where the last item pushed is the first popped, and
each entry carries the string spelled so far. A node's own word is recorded
before any of its children are pushed, so `"app"` comes out before `"apple"`,
as a shorter word should when it's a prefix of a longer one. The children are
pushed largest character first, so the smallest is popped next and its whole
subtree is listed before its next sibling comes off the stack. Here is
`words_with_prefix("ap")` on the trie above:

| Pop            | Marked? | Pushed (last pops next)  | `found`                   |
| -------------- | ------- | ------------------------ | ------------------------- |
| `p`, `"ap"`    | no      | `t` `"apt"`, `p` `"app"` | `[]`                      |
| `p`, `"app"`   | yes     | `l` `"appl"`             | `["app"]`                 |
| `l`, `"appl"`  | no      | `e` `"apple"`            | `["app"]`                 |
| `e`, `"apple"` | yes     | nothing                  | `["app", "apple"]`        |
| `t`, `"apt"`   | yes     | nothing                  | `["app", "apple", "apt"]` |

A recursive version that calls itself for each child would be shorter, but it
goes one call deeper per character, and Python stops at a recursion depth of
1,000 by default, so a word of a thousand-odd characters would raise
`RecursionError`. The explicit stack has no such limit.

```python
    def delete(self, word: str) -> bool:
        path: list[tuple[TrieNode, str]] = []
        node = self._root
        for ch in word:
            child = node.children.get(ch)
            if child is None:
                return False
            path.append((node, ch))
            node = child
        if not node.is_word:
            return False
        node.is_word = False
        self._size -= 1
        while path and not node.is_word and not node.children:
            parent, ch = path.pop()
            del parent.children[ch]
            node = parent
        return True
```

```typescript
  delete(word: string): boolean {
    const path: [TrieNode, string][] = [];
    let node = this.root;
    for (const ch of word) {
      const child = node.children.get(ch);
      if (child === undefined) return false;
      path.push([node, ch]);
      node = child;
    }
    if (!node.isWord) return false;
    node.isWord = false;
    this.count--;
    while (path.length > 0 && !node.isWord && node.children.size === 0) {
      const [parent, ch] = path.pop() as [TrieNode, string];
      parent.children.delete(ch);
      node = parent;
    }
    return true;
  }
}
```

Deleting a word is two jobs: clear its flag, then remove the nodes that no
longer lead to any word. Nodes only know their children, not their parent, so
the walk down records each parent and the character used to leave it in
`path`. Then it climbs back up, cutting the current node loose from its parent
for as long as the node is unmarked and childless. Deleting `"apple"` from the
trie above clears the flag on `e`, removes `e` (no children), then `l` (no
children now), and stops at the `p` of `"app"` because it is marked. Deleting
`"app"` instead clears that flag and removes nothing, because the node still
has `l` below it. A word that isn't stored, whether its path breaks off
partway or ends at an unmarked node, returns `False` before anything changes.

## Invariants

These hold after every call returns:

- **Each node stands for one string**, the labels on its path from the root,
  and it is marked exactly when that string is stored.
- **Every node except the root is marked or has a child.** `insert` only adds
  nodes on the path to a word it marks, and `delete` prunes upward until it
  reaches a node that is marked or still has a child. So every node below the
  root lies on the way to some stored word, which is what lets `starts_with`
  answer from the prefix's node alone. The root is the exception: it exists
  even in an empty trie, which is why `starts_with` still checks the node's
  flag and children rather than only that the node exists.
- **The count equals the number of marked nodes.** It changes only where a
  flag flips: up in `insert`, down in `delete`.
- **A node's children have different labels, each one code point**, because
  they are keys of one map and both languages step through words by code
  point.

## Tricky lines

- `node.is_word or bool(node.children)` in `starts_with`, not just
  `node is not None`. The shorter test is wrong twice. The root always exists,
  so an empty trie would claim that some word starts with `""`. And it would
  be wrong after any delete if `delete` didn't prune: deleting `"apple"` from
  a trie holding only `"apple"` and leaving the nodes in place would let
  `starts_with("appl")` keep returning true.
- `child = node.children.get(ch)` followed by a check for `None` in `insert`,
  rather than `node = node.children.setdefault(ch, TrieNode())`. The one-liner
  gives the right trie, but Python evaluates arguments before calling, so it
  builds a new `TrieNode` for every character of every insert and throws it
  away whenever the child already exists.
- `for (const ch of word)` in TypeScript, not `for (let i = 0; i < word.length;
i++)` with `word[i]`. Indexing steps through UTF-16 units, so 😀 would become
  two nodes, one for each half of its surrogate pair, and `startsWith('\ud83d')`
  (a lone half that isn't a character) would return true.
- `sort(byLabelDescending)` in `wordsWithPrefix`, not a plain `sort()`.
  JavaScript's default sort turns each `[label, node]` pair into a string and
  compares UTF-16 units, and a character above U+FFFF starts with a unit
  between U+D800 and U+DBFF. So `～` (U+FF5E) would sort after 😀 (U+1F600),
  the opposite of their code point order and of Python's `sorted`, and the
  two languages would list the same trie's words in different orders.
- `sorted(node.children.items(), reverse=True)` in Python sorts
  `(label, node)` pairs. Two pairs are compared by label, and only on a tie
  would Python compare the nodes, which raises `TypeError` since nodes have no
  order. Labels are keys of one dict, so there is never a tie. `reverse=True`
  (and largest-first in TypeScript) is there because the stack pops the last
  child pushed first.
- `not node.is_word` in `delete`'s climbing loop. Without it, deleting
  `"apple"` would keep pruning past `l` into the `p` of `"app"`, which has no
  children left at that point, and silently delete `"app"` too.

## When to use it

Use a trie when the questions are about prefixes: autocomplete, listing the
words that start with what the user has typed, checking whether a partial
word can still be finished (the pruning step in a word-search puzzle that
looks for dictionary words in a grid of letters), or finding the longest
stored prefix of a string, which IP routers do with trie variants when they
pick the most specific route for an address. Listing words in sorted order
costs only a sort of each visited node's children (free with a fixed array of
child slots instead of a hash map), which suits a suggestion list.

For "is this exact word here?" alone, a hash set is simpler, about as fast and
far smaller, as the memory figures above show. If you need sorted order and
range questions ("every key between `m` and `p`") over keys that aren't
strings, a [binary search tree](/dsa/binary-search-tree) keeps any comparable
keys in order. When the trie's memory is the problem, a radix tree or a
fixed-size child array is the usual next step.
