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
