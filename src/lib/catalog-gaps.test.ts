import { beforeAll, describe, expect, it } from 'vitest';
import { TOPICS, getTopic, loadAllTopicBodies } from './content';
import { DSA_ENTRIES, getDsaEntry, loadAllDsaBodies } from './dsa';
import { extractCaseStudyRefs, extractTopicRefs } from './markdown.mjs';
import { CASE_STUDIES, getCaseStudy, loadAllCaseStudyBodies } from './system-design';

/**
 * Every internal link in every published body resolves: each `/<section>/<slug>`
 * link names a topic that exists, each `/system-design/<slug>` link names a
 * case study that exists, and each `/dsa/<slug>` link names a DSA entry that
 * exists. Covers every topic in every section, every case study and every DSA
 * entry, so a renamed or removed page can't leave a dead link anywhere.
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
      const live = section === 'dsa' ? getDsaEntry(slug) : getTopic(section, slug);
      if (!live) dead.push(`${label} -> /${section}/${slug}`);
    }
    for (const slug of extractCaseStudyRefs(body)) {
      if (!getCaseStudy(slug)) dead.push(`${label} -> /system-design/${slug}`);
    }
  }
  return dead;
}

let bodies: Labelled[];
let dsaBodies: Labelled[];
beforeAll(async () => {
  const [topicBodies, caseStudyBodies, dsa] = await Promise.all([
    loadAllTopicBodies(),
    loadAllCaseStudyBodies(),
    loadAllDsaBodies(),
  ]);
  dsaBodies = [...dsa].map(([slug, body]) => ({ label: `/dsa/${slug}`, body }));
  bodies = [
    ...[...topicBodies].map(([key, body]) => ({ label: `/${key}`, body })),
    ...[...caseStudyBodies].map(([slug, body]) => ({
      label: `/system-design/${slug}`,
      body,
    })),
    ...dsaBodies,
  ];
});

describe('the dead-link check itself', () => {
  // A DSA-shaped body: a link to another DSA entry (live), and a catalog link
  // the way src/dsa/entries/binary-search.md makes one, here to a topic that
  // doesn't exist.
  const DSA_BODY = [
    '## Prerequisites',
    '- [Hash map](/dsa/hash-map)',
    '## When to use it',
    'A sorted index is how a database finds a row',
    '([database indexing](/systems-and-infrastructure/no-such-topic)).',
  ].join('\n\n');

  it('catches a dead catalog link in a DSA entry body, naming it', () => {
    expect(deadLinks([{ label: '/dsa/planted', body: DSA_BODY }])).toEqual([
      '/dsa/planted -> /systems-and-infrastructure/no-such-topic',
    ]);
  });

  it('passes the same body once the catalog link names a live topic', () => {
    const body = DSA_BODY.replace('no-such-topic', 'database-indexing');
    expect(getTopic('systems-and-infrastructure', 'database-indexing')).toBeDefined();
    expect(deadLinks([{ label: '/dsa/planted', body }])).toEqual([]);
  });
});

describe('internal links', () => {
  it('resolve to a topic, case study or DSA entry that exists, in every topic, case study and DSA body', () => {
    expect(bodies).toHaveLength(TOPICS.length + CASE_STUDIES.length + DSA_ENTRIES.length);
    expect(deadLinks(bodies)).toEqual([]);
  });

  it('covers the catalog links in DSA entry bodies (binary-search links a topic)', () => {
    expect(dsaBodies).toHaveLength(DSA_ENTRIES.length);
    const binary = dsaBodies.find((b) => b.label === '/dsa/binary-search');
    expect(binary, 'the binary-search DSA body is loaded').toBeDefined();
    expect(
      extractTopicRefs(binary!.body).filter((r) => r.section !== 'dsa'),
    ).toContainEqual({
      section: 'systems-and-infrastructure',
      slug: 'database-indexing',
    });
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
