/** A remembered choice (the theme, the code language) read from localStorage:
 * the stored value if it's one of `allowed`, otherwise `fallback`.
 * localStorage can throw in private-browsing / restricted contexts, so a
 * failed read falls back silently. */
export function readStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  try {
    const stored = localStorage.getItem(key);
    if (allowed.includes(stored as T)) return stored as T;
  } catch {
    // Fall back silently.
  }
  return fallback;
}

/** Stores a choice for `readStoredChoice`. Best-effort persistence only. */
export function writeStoredChoice(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort persistence only.
  }
}
