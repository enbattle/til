/** Collects pieces in an array and joins them once, in time linear in the total. */
export class StringBuilder {
  private parts: string[] = [];
  private units = 0;

  append(piece: string): this {
    this.parts.push(piece);
    this.units += piece.length;
    return this;
  }

  /** UTF-16 code units appended so far, the same count as `build().length`. */
  get length(): number {
    return this.units;
  }

  build(): string {
    const text = this.parts.join('');
    this.parts = [text];
    return text;
  }
}

export function reverseCodePoints(s: string): string {
  return Array.from(s).reverse().join('');
}

const LETTER_OR_DIGIT = /^[\p{L}\p{N}]$/u;

/** Whether s reads the same both ways, counting only letters and digits
 * and ignoring case. */
export function isPalindrome(s: string): boolean {
  const chars = Array.from(s);
  let i = 0;
  let j = chars.length - 1;
  while (i < j) {
    if (!LETTER_OR_DIGIT.test(chars[i])) {
      i++;
    } else if (!LETTER_OR_DIGIT.test(chars[j])) {
      j--;
    } else if (chars[i].toLowerCase() !== chars[j].toLowerCase()) {
      return false;
    } else {
      i++;
      j--;
    }
  }
  return true;
}
