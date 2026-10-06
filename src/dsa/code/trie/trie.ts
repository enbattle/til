class TrieNode {
  readonly children = new Map<string, TrieNode>();
  isWord = false;
}

/** A set of strings stored as a tree with one character per edge. */
export class Trie {
  private readonly root = new TrieNode();

  insert(word: string): void {
    let node = this.root;
    // for...of steps by code point; word[i] would split an emoji in two.
    for (const ch of word) {
      let child = node.children.get(ch);
      if (child === undefined) {
        child = new TrieNode();
        node.children.set(ch, child);
      }
      node = child;
    }
    // The node may exist already as a step toward a longer word.
    node.isWord = true;
  }

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
    // Reaching the node isn't enough: "app" is a step toward "apple".
    return this.find(word)?.isWord ?? false;
  }

  startsWith(prefix: string): boolean {
    const node = this.find(prefix);
    // An unmarked node with no children is only the root of an empty
    // trie, which has no word to start with "".
    return node !== undefined && (node.isWord || node.children.size > 0);
  }

  /** Every stored word that starts with prefix, in no fixed order. */
  wordsWithPrefix(prefix: string): string[] {
    const start = this.find(prefix);
    if (start === undefined) return [];
    const found: string[] = [];
    // A stack, not recursion: one frame per character would overflow
    // on a very long word.
    const stack: [TrieNode, string][] = [[start, prefix]];
    for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
      const [node, word] = top;
      if (node.isWord) found.push(word);
      for (const [ch, child] of node.children) stack.push([child, word + ch]);
    }
    return found;
  }

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
    // Stop at a marked node: deleting "apple" must keep "app".
    while (path.length > 0 && !node.isWord && node.children.size === 0) {
      const [parent, ch] = path.pop() as [TrieNode, string];
      parent.children.delete(ch);
      node = parent;
    }
    return true;
  }
}
