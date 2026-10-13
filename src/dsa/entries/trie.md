---
title: Trie
summary: A tree that stores strings one character per level, so words that share a prefix share nodes and a lookup costs the length of the key, not the number of words.
date: 2026-10-05
kind: data-structure
---

Type "ap" into a search box and it offers "app", "apple" and "apt" before you
finish. A hash set can tell you whether "apple" is stored, but to find the
words that start with "ap" it has to check every one. A **trie** (from
re*trie*val, said "try") answers that by storing a shared beginning once, so
every word with a given prefix hangs below one spot.

## Prerequisites

- [Hash map](/dsa/hash-map): each node keeps its children in one, keyed by
  character, and the costs below assume its O(1) average lookup.
- [Arrays and strings](/dsa/arrays-and-strings): the code steps through a key
  by code point, so a single-code-point emoji such as 😀 is one step and not two halves.

## What it is

A **tree** is nodes joined by links, with one **root** at the top; every other
node has one **parent** above it and any number of **children** below. In a
trie each link carries one character, and a node stands for the string spelled
by the links from the root down to it. The root is the empty string.

Insert `"app"`, `"apple"`, `"apt"` and `"bat"`. Each node below is drawn as the
character on its incoming link, and `●` marks a node where a stored word ends:

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

The words hold 3 + 5 + 3 + 3 = 14 characters, but the trie has 9 nodes:
`"apple"` reuses the three nodes of `"app"` and adds `l` and `e`, `"apt"`
reuses `a` and `p` and adds `t`, and `"bat"` shares nothing and adds three.

Why the `●`? The node for `"app"` exists whether or not `"app"` was inserted,
because `"apple"` passes through it. Without a flag on each node you couldn't
tell a stored word from a step on the way to one. That also means inserting
`"app"` after `"apple"` creates no nodes: setting the flag is the whole insert.

Every operation is a walk from the root, one character per step. Looking up
`"apt"` follows `a`, `p`, `t` and checks the flag. The words starting with
`"ap"` are exactly the marked nodes below the node you reach after `a`, `p`,
and that is what autocomplete does.

## When to use it

- The problem asks about **prefixes**: autocomplete, "all words starting with",
  "does any word start with this".
- You must decide, partway through building a string, whether it can still grow
  into a stored word. A word search on a grid of letters prunes a path this way
  the moment no dictionary word begins with it.
- You need the longest stored prefix of a string, as when routing picks the
  most specific match for an address.

If you only ask "is this exact word stored?", use a hash set. It is as fast
and much smaller. If you need keys of any type kept in sorted order, use a
[binary search tree](/dsa/binary-search-tree).

## Operations and costs

L is the key's length in characters, P a prefix's length, σ the number of
distinct characters a node can have as children (26 for lowercase English), k
the number of nodes below the prefix's node, and d the length of the longest
word found there.

| Operation                   | Average             | Worst case          |
| --------------------------- | ------------------- | ------------------- |
| `insert(word)`              | O(L)                | O(σL)               |
| `word in trie`              | O(L)                | O(σL)               |
| `starts_with(prefix)`       | O(P)                | O(σP)               |
| `words_with_prefix(prefix)` | O(P + k·d)          | O(σP + k·d)         |
| `delete(word)`              | O(L)                | O(σL)               |
| Space                       | O(total characters) | O(total characters) |

None of the per-word costs mention the number of words. Each step is one
lookup in one node's map, so a key of length L takes L steps whether the trie
holds ten words or ten million. The worst case is that map's worst case: a
lookup that compares against every child, of which a node has at most σ.

A hash set also costs O(L) for an exact lookup, since hashing reads every
character. The trie wins on prefix questions: `words_with_prefix` walks P
steps, then visits each of the k nodes below once, and `word + ch` copies up
to d characters each time.

Space is at most one node per inserted character, fewer when prefixes are
shared. Each node is an object holding its own map, though, so a trie often
costs several times the memory of a set of the same words.

## Implementation

A node is a map of children and the end-of-word flag. `insert` walks down and
creates a node only where the path runs out.

```python region=trie-node

```

```typescript region=trie-node

```

Inserting the four words in the order above creates 3, 2, 1 and 3 nodes, the
9 you saw drawn. Every read starts with the same walk, so it gets one helper:
follow the characters and return the node they lead to, or nothing as soon as
a link is missing. The two questions then differ only in what they ask of that
node.

```python region=find

```

```typescript region=find

```

On the example, `"ap"` is not stored but `starts_with("ap")` is true, and
`"apples"` fails at the sixth step. Listing the words below a prefix means
visiting every node under it, so it uses an explicit **stack** (a list where
the last item pushed is the first popped; see [stacks and queues](/dsa/stacks-and-queues)). Each entry carries the string
spelled so far.

```python region=words-with-prefix

```

```typescript region=words-with-prefix

```

Here is `words_with_prefix("ap")`, with children visited in insertion order:

| Pop            | Marked? | Pushed (last pops next)  | `found`                   |
| -------------- | ------- | ------------------------ | ------------------------- |
| `p`, `"ap"`    | no      | `p` `"app"`, `t` `"apt"` | `[]`                      |
| `t`, `"apt"`   | yes     | nothing                  | `["apt"]`                 |
| `p`, `"app"`   | yes     | `l` `"appl"`             | `["apt", "app"]`          |
| `l`, `"appl"`  | no      | `e` `"apple"`            | `["apt", "app"]`          |
| `e`, `"apple"` | yes     | nothing                  | `["apt", "app", "apple"]` |

The order depends on insertion, which is why the docstring promises none.
Deleting is the last job: clear the flag, then remove nodes that no longer lead
to a word. A node knows its children but not its parent, so the walk down
records each parent and the character used to leave it.

```python region=delete

```

```typescript region=delete

```

Deleting `"apple"` clears the flag on `e`, removes `e` and then `l`, and stops
at the `p` of `"app"`, leaving 7 nodes. Deleting `"app"` instead clears its
flag and removes nothing, since `l` still hangs below it. The pruning keeps one
invariant: every node below the root is marked or has a child, so a node that
exists always leads to a stored word, and `starts_with` can answer from it
alone.

## Pitfalls

- **Treating a reached node as a stored word.** `return node is not None` in
  `__contains__` says `"app"` is stored when only `"apple"` is. The flag check
  on that line is what separates a word from a step toward one.
- **Pruning past a marked node.** Without `not node.is_word` in `delete`'s
  loop, removing `"apple"` keeps cutting through the `p` of `"app"`, which has
  no children by then, and deletes `"app"` too.
- **Skipping the prune.** If `delete` only cleared the flag, `starts_with("appl")`
  would keep returning true for a word that's gone, because that line trusts
  that an existing node leads to a word.
- **Indexing a string in TypeScript.** Replacing `for (const ch of word)` with
  `word[i]` steps by UTF-16 unit, so an emoji becomes two nodes and
  `startsWith` of half an emoji returns true.
