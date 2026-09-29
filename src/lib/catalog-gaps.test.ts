import { beforeAll, describe, expect, it } from 'vitest';
import { TOPICS, getTopic, loadAllTopicBodies } from './content';
import { extractTopicRefs } from './markdown-links';

/**
 * Structural checks for docs/specs/fill-catalog-gaps.md against the real
 * content: nine new systems topics and the link-level edits to existing
 * topics. (That spec's question pages were removed by
 * docs/specs/system-design-case-studies.md, so their checks are gone.)
 * Frontmatter validity and the closing-section convention are enforced by
 * existing tests.
 */

const SECTION = 'systems-and-infrastructure';

const NEW_TOPICS: [slug: string, title: string][] = [
  ['caching', 'Caching: Placement, Hit Rate, and Eviction'],
  ['read-replicas', 'Read Replicas and Replication Lag'],
  ['batching-and-asynchronous-writes', 'Batching and Asynchronous Writes'],
  ['cqrs', 'CQRS: Separating Reads from Writes'],
  ['message-queues', 'Message Queues'],
  ['worker-pools', 'Worker Pools'],
  ['workflow-engines', 'Workflow Engines and Durable Execution'],
  [
    'websockets-vs-sse-vs-long-polling',
    'WebSockets vs. Server-Sent Events vs. Long Polling',
  ],
  ['self-healing-systems', 'Self-Healing Systems'],
];

const TOPIC_LINKS: [topicSlug: string, linked: string[]][] = [
  [
    'scaling-reads-vs-scaling-writes',
    ['caching', 'read-replicas', 'batching-and-asynchronous-writes'],
  ],
  ['dead-letter-queue', ['message-queues']],
  ['backpressure', ['message-queues']],
  ['outbox-pattern', ['message-queues']],
  ['saga-pattern', ['workflow-engines']],
  ['cache-invalidation', ['caching']],
];

// Topic bodies load on demand (`section/slug` -> frontmatter-stripped markdown).
let bodies: Map<string, string>;
beforeAll(async () => {
  bodies = await loadAllTopicBodies();
});

function bodyOf(section: string, slug: string): string {
  const body = bodies.get(`${section}/${slug}`);
  if (body === undefined) throw new Error(`no body loaded for ${section}/${slug}`);
  return body;
}

function linkedSlugs(body: string, section = SECTION): string[] {
  return extractTopicRefs(body)
    .filter((ref) => ref.section === section)
    .map((ref) => ref.slug);
}

describe('the nine new systems topics exist (criterion 1)', () => {
  it.each(NEW_TOPICS)('%s exists with title %j', (slug, title) => {
    const topic = getTopic(SECTION, slug);
    expect(topic, `${SECTION}/${slug} should exist`).toBeDefined();
    expect(topic?.title).toBe(title);
  });
});

describe('link-level additions to existing topics (criterion 3)', () => {
  const cases = TOPIC_LINKS.flatMap(([topicSlug, linked]) =>
    linked.map((slug) => [topicSlug, slug] as const),
  );

  it.each(cases)('%s links %s in its body', (topicSlug, linkedSlug) => {
    const topic = getTopic(SECTION, topicSlug);
    expect(topic, `${SECTION}/${topicSlug} should exist`).toBeDefined();
    expect(linkedSlugs(bodyOf(SECTION, topicSlug))).toContain(linkedSlug);
  });
});

describe('no dead links between systems topics (criterion 1)', () => {
  const systemsTopics = TOPICS.filter((t) => t.section === SECTION);

  it.each(systemsTopics.map((t) => [t.slug, t] as const))(
    '%s links only to systems topics that exist',
    (_slug, topic) => {
      for (const slug of linkedSlugs(bodyOf(topic.section, topic.slug))) {
        expect(getTopic(SECTION, slug), `${SECTION}/${slug}`).toBeDefined();
      }
    },
  );
});
