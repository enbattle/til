// Link extraction over raw markdown. Kept pure (no `import.meta.glob`, no `@/`
// alias) so `vite.config.ts` can import it for the build-time `?links` query,
// the same way it imports `frontmatter.ts`.

/** `body` with every fenced code block removed, so a link shown *as an
 * example* inside one isn't counted as a real link. */
function stripFencedCode(body: string): string {
  const kept: string[] = [];
  let fence: { char: string; length: number } | null = null;
  for (const line of body.split('\n')) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (!fence) {
      if (marker) {
        fence = { char: marker[1][0], length: marker[1].length };
      } else {
        kept.push(line);
      }
    } else if (
      marker &&
      marker[1][0] === fence.char &&
      marker[1].length >= fence.length
    ) {
      fence = null;
    }
  }
  return kept.join('\n');
}

/** Destinations of inline markdown links (`[text](dest)`), with any `#fragment`
 * or `?query` dropped. The text may span lines; images are skipped. */
function linkDestinations(body: string): string[] {
  const destinations: string[] = [];
  for (const match of stripFencedCode(body).matchAll(
    /(?<!!)\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g,
  )) {
    destinations.push(match[1].replace(/[#?].*$/, ''));
  }
  return destinations;
}

export interface TopicRef {
  section: string;
  slug: string;
}

/** Inline markdown links in `body` whose destination is exactly
 * `/<section>/<slug>`, first appearance first, de-duplicated. Excludes
 * external, single-segment and `/system-design/...` links. Doesn't check that
 * the topic exists. */
export function extractTopicRefs(body: string): TopicRef[] {
  const seen = new Set<string>();
  const refs: TopicRef[] = [];
  for (const destination of linkDestinations(body)) {
    const match = /^\/([^/]+)\/([^/]+)$/.exec(destination);
    if (!match || match[1] === 'system-design') continue;
    const key = `${match[1]}/${match[2]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ section: match[1], slug: match[2] });
  }
  return refs;
}

/** Slugs of `/system-design/<slug>` inline links in `body` (links to other
 * case studies), first appearance first, de-duplicated. */
export function extractCaseStudyRefs(body: string): string[] {
  const slugs: string[] = [];
  for (const destination of linkDestinations(body)) {
    const match = /^\/system-design\/([^/]+)$/.exec(destination);
    if (match && !slugs.includes(match[1])) slugs.push(match[1]);
  }
  return slugs;
}
