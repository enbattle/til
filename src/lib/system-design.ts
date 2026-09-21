import type { Question, Topic } from '@/types';
import { getTopic } from './content';
import { parseFrontmatter } from './frontmatter';

const files = import.meta.glob('/src/system-design/questions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const PATH_PATTERN = /^\/src\/system-design\/questions\/([^/]+)\.md$/;

/**
 * Parses one question file. Exported (rather than private like `parseTopic`)
 * so the frontmatter contract, including `order`, can be unit-tested against
 * fixture strings instead of only the real files.
 */
export function parseQuestion(filePath: string, raw: string): Question {
  const match = PATH_PATTERN.exec(filePath);
  if (!match) {
    throw new Error(
      `Question file path doesn't match /src/system-design/questions/<slug>.md: ${filePath}`,
    );
  }
  const [, slug] = match;
  const { data, content } = parseFrontmatter(raw);

  for (const field of ['title', 'summary', 'date', 'order'] as const) {
    if (!data[field]) {
      throw new Error(
        `system-design/questions/${slug}.md is missing required frontmatter field "${field}"`,
      );
    }
  }
  if (!/^\d+$/.test(data.order) || Number(data.order) < 1) {
    throw new Error(
      `system-design/questions/${slug}.md has an invalid "order" (${JSON.stringify(data.order)}): expected a positive integer`,
    );
  }

  return {
    slug,
    title: data.title,
    summary: data.summary,
    date: data.date,
    order: Number(data.order),
    body: content,
  };
}

/** Every question, sorted by `order` ascending. */
export const QUESTIONS: Question[] = Object.entries(files)
  .map(([filePath, raw]) => parseQuestion(filePath, raw))
  .sort((a, b) => a.order - b.order);

export function getQuestion(slug: string): Question | undefined {
  return QUESTIONS.find((question) => question.slug === slug);
}

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

/** Inline markdown links in `body` whose destination is exactly
 * `/<section>/<slug>`, first appearance first, de-duplicated. Excludes
 * external, single-segment and `/system-design/...` links. Doesn't check that
 * the topic exists. */
export function extractTopicRefs(body: string): { section: string; slug: string }[] {
  const seen = new Set<string>();
  const refs: { section: string; slug: string }[] = [];
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

/** Slugs of `/system-design/<slug>` inline links in `body`, first appearance
 * first, de-duplicated. */
export function extractQuestionRefs(body: string): string[] {
  const slugs: string[] = [];
  for (const destination of linkDestinations(body)) {
    const match = /^\/system-design\/([^/]+)$/.exec(destination);
    if (match && !slugs.includes(match[1])) slugs.push(match[1]);
  }
  return slugs;
}

/** The catalog topics `question` links to, in order of first appearance. A
 * ref that doesn't resolve is skipped rather than thrown on — a dead link is
 * caught by a test, not by breaking the page at render time. */
export function topicsForQuestion(question: Question): Topic[] {
  return extractTopicRefs(question.body)
    .map(({ section, slug }) => getTopic(section, slug))
    .filter((topic): topic is Topic => topic !== undefined);
}

// topic key (`section/slug`) -> the questions linking to it, in `order`.
// Built once from the static question set.
const QUESTIONS_BY_TOPIC = new Map<string, Question[]>();
for (const question of QUESTIONS) {
  for (const { section, slug } of extractTopicRefs(question.body)) {
    const key = `${section}/${slug}`;
    QUESTIONS_BY_TOPIC.set(key, [...(QUESTIONS_BY_TOPIC.get(key) ?? []), question]);
  }
}

/** The questions whose bodies link to the given topic, in `order`. */
export function questionsForTopic(section: string, slug: string): Question[] {
  return QUESTIONS_BY_TOPIC.get(`${section}/${slug}`) ?? [];
}

/** Whether `pathname` is the System Design landing page or one of its
 * question pages. Shared by the header tabs and the sidebar so both switch on
 * exactly the same routes. */
export function isSystemDesignPath(pathname: string): boolean {
  return pathname === '/system-design' || pathname.startsWith('/system-design/');
}
