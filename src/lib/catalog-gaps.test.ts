import { beforeAll, describe, expect, it } from 'vitest';
import { TOPICS, getTopic, loadAllTopicBodies } from './content';
import { extractCaseStudyRefs, extractTopicRefs } from './markdown.mjs';
import { CASE_STUDIES, getCaseStudy, loadAllCaseStudyBodies } from './system-design';

/**
 * Every internal link in every published body resolves: each `/<section>/<slug>`
 * link names a topic that exists, and each `/system-design/<slug>` link names a
 * case study that exists. Covers every topic in every section and every case
 * study, so a renamed or removed page can't leave a dead link anywhere. A link
 * resolves against topics and case studies only (docs/specs/remove-dsa-tab.md,
 * criterion 4), so a link to the retired DSA tab is dead like any other.
 */

interface Labelled {
  label: string;
  body: string;
}

/** Every dead internal link in `bodies`, as `label -> /path`. */
function deadLinks(bodies: Labelled[]): string[] {
  const dead: string[] = [];
  for (const { label, body } of bodies) {
    for (const { section, slug } of extractTopicRefs(body)) {
      if (!getTopic(section, slug)) dead.push(`${label} -> /${section}/${slug}`);
    }
    for (const slug of extractCaseStudyRefs(body)) {
      if (!getCaseStudy(slug)) dead.push(`${label} -> /system-design/${slug}`);
    }
  }
  return dead;
}

let bodies: Labelled[];
beforeAll(async () => {
  const [topicBodies, caseStudyBodies] = await Promise.all([
    loadAllTopicBodies(),
    loadAllCaseStudyBodies(),
  ]);
  bodies = [
    ...[...topicBodies].map(([key, body]) => ({ label: `/${key}`, body })),
    ...[...caseStudyBodies].map(([slug, body]) => ({
      label: `/system-design/${slug}`,
      body,
    })),
  ];
});

describe('the dead-link check itself', () => {
  // A topic-shaped body with a link to the retired DSA tab and a catalog link
  // to a topic that doesn't exist.
  const BODY = [
    '## How it works',
    'A [heap](/dsa/heap) keeps the smallest key on top.',
    'A sorted index is how a database finds a row',
    '([database indexing](/systems-and-infrastructure/no-such-topic)).',
  ].join('\n\n');

  it('reports a link to the retired DSA tab and a dead catalog link, naming each', () => {
    expect(deadLinks([{ label: '/s/planted', body: BODY }])).toEqual([
      '/s/planted -> /dsa/heap',
      '/s/planted -> /systems-and-infrastructure/no-such-topic',
    ]);
  });

  it('passes a body whose links name a live topic and a live case study', () => {
    const body = [
      'A [database index](/systems-and-infrastructure/database-indexing) finds a row.',
      'See the [URL shortener](/system-design/url-shortener).',
    ].join('\n\n');
    expect(getTopic('systems-and-infrastructure', 'database-indexing')).toBeDefined();
    expect(deadLinks([{ label: '/s/planted', body }])).toEqual([]);
  });

  it('reports a link to a case study that does not exist', () => {
    const body = 'See the [missing design](/system-design/no-such-case-study).';
    expect(deadLinks([{ label: '/s/planted', body }])).toEqual([
      '/s/planted -> /system-design/no-such-case-study',
    ]);
  });
});

describe('internal links', () => {
  it('resolve to a topic or case study that exists, in every topic and case study body', () => {
    expect(bodies).toHaveLength(TOPICS.length + CASE_STUDIES.length);
    expect(deadLinks(bodies)).toEqual([]);
  });

  // docs/specs/catalog-standard.md, criterion 7: the four topics moved to
  // coding-agents are linked at their new paths, never through a redirect.
  it('link the four moved topics at /coding-agents, not their old /ai-and-ml paths', () => {
    const moved = [
      'context-is-a-budget',
      'documentation-vs-skill-vs-hook',
      'keeping-ai-native-docs-from-going-stale',
      'triaging-ai-code-review',
    ];
    for (const slug of moved) expect(getTopic('coding-agents', slug), slug).toBeDefined();
    const old: string[] = [];
    for (const { label, body } of bodies) {
      for (const { section, slug } of extractTopicRefs(body)) {
        if (section === 'ai-and-ml' && moved.includes(slug)) {
          old.push(`${label} -> /${section}/${slug}`);
        }
      }
    }
    expect(old).toEqual([]);
  });
});
