import { beforeAll, describe, expect, it } from 'vitest';
import { TOPICS, getTopic, loadAllTopicBodies } from './content';
import { extractCaseStudyRefs, extractTopicRefs } from './markdown.mjs';
import { CASE_STUDIES, getCaseStudy, loadAllCaseStudyBodies } from './system-design';

/**
 * Every internal link in every published body resolves: each `/<section>/<slug>`
 * link names a topic that exists, and each `/system-design/<slug>` link names a
 * case study that exists. Covers every topic in every section and every case
 * study, so a renamed or removed page can't leave a dead link anywhere.
 */

let bodies: { label: string; body: string }[];
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

describe('internal links', () => {
  it('resolve to a topic or case study that exists, in every topic and case study body', () => {
    expect(bodies).toHaveLength(TOPICS.length + CASE_STUDIES.length);
    const dead: string[] = [];
    for (const { label, body } of bodies) {
      for (const { section, slug } of extractTopicRefs(body)) {
        if (!getTopic(section, slug)) dead.push(`${label} -> /${section}/${slug}`);
      }
      for (const slug of extractCaseStudyRefs(body)) {
        if (!getCaseStudy(slug)) dead.push(`${label} -> /system-design/${slug}`);
      }
    }
    expect(dead).toEqual([]);
  });
});
