/** The items before and after `item` in an ordered list (by slug), each null
 * at that end of the list. */
export function neighbours<T extends { slug: string }>(
  list: readonly T[],
  item: T,
): { prev: T | null; next: T | null } {
  const index = list.findIndex((other) => other.slug === item.slug);
  return {
    prev: index > 0 ? list[index - 1] : null,
    next: index < list.length - 1 ? list[index + 1] : null,
  };
}
