/**
 * Old catalog paths (`section/slug`) mapped to where the topic lives now, so a
 * moved, merged or renamed topic's old URL keeps working. `TopicPage` checks
 * this before falling back to /not-found. Entries are never removed, and a
 * target must be a live topic, never another source (`redirects.test.ts`).
 * See docs/content.md, "Moving, merging or renaming a topic".
 */
export const REDIRECTS: Readonly<Record<string, string>> = {
  'ai-and-ml/context-is-a-budget': 'coding-agents/context-is-a-budget',
  'ai-and-ml/documentation-vs-skill-vs-hook':
    'coding-agents/documentation-vs-skill-vs-hook',
  'ai-and-ml/keeping-ai-native-docs-from-going-stale':
    'coding-agents/keeping-ai-native-docs-from-going-stale',
  'ai-and-ml/triaging-ai-code-review': 'coding-agents/triaging-ai-code-review',
  'security/session-vs-token-auth': 'security/jwt',
  'systems-and-infrastructure/dead-letter-queue':
    'systems-and-infrastructure/message-queues',
};

/** The current path (`/section/slug`) for an old one, if it was redirected. */
export function redirectFor(section: string, slug: string): string | undefined {
  const target = Object.hasOwn(REDIRECTS, `${section}/${slug}`)
    ? REDIRECTS[`${section}/${slug}`]
    : undefined;
  return target && `/${target}`;
}
