// @vitest-environment node
// Planted-violation tests for scripts/check-diagrams.mjs: the first half of
// the table of violations each planted into a clean fixture (staleness,
// missing and orphan files, and M2 SVG content that runs script or loads
// content). The second half is in check-diagrams.planted-2.test.mjs; both
// share the test title and body, split only so neither file sets vitest's wall
// time (see check-diagrams.test.mjs).
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, diagramFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { SOURCE, SVG, CASE_STUDY, write, repo, plantSvg } = diagramFixture;

describe('check-diagrams', () => {
  it.each([
    [
      'an edited .d2 without re-render',
      (root) =>
        write(
          root,
          'src/system-design/diagrams/demo/flow.d2',
          `${SOURCE}db -> cache: warm\n`,
        ),
    ],
    [
      'a .d2 with no manifest entry',
      (root) => {
        write(root, 'src/system-design/diagrams/demo/extra.d2', SOURCE);
        write(root, 'public/diagrams/demo/extra.light.svg', SVG());
        write(root, 'public/diagrams/demo/extra.dark.svg', SVG());
      },
    ],
    [
      'a missing .dark.svg',
      (root) => rmSync(join(root, 'public/diagrams/demo/flow.dark.svg')),
    ],
    [
      'a missing .light.svg',
      (root) => rmSync(join(root, 'public/diagrams/demo/flow.light.svg')),
    ],
    [
      'an orphan SVG with no source',
      (root) => write(root, 'public/diagrams/demo/ghost.light.svg', SVG()),
    ],
    [
      'an SVG containing <script>',
      plantSvg('public/diagrams/demo/flow.dark.svg', SVG('<script>alert(1)</script>')),
    ],
    [
      'an SVG with an onload= attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<rect onload="alert(1)" width="1" height="1"/>'),
      ),
    ],
    [
      'an SVG with an external href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a href="https://evil.example/"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with an external xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<image xlink:href="http://evil.example/x.png" width="1" height="1"/>'),
      ),
    ],
    [
      'a case study referencing a nonexistent diagram',
      (root) =>
        write(
          root,
          'src/system-design/case-studies/demo.md',
          CASE_STUDY('\n![Missing](/diagrams/demo/missing.svg)\n'),
        ),
    ],

    // --- M2: SVG content that runs script or loads content some other way.
    // Each plant re-locks the manifest, so only the content is under test.
    [
      'an SVG with a <foreignObject>',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
        ),
      ),
    ],
    [
      'an SVG with an <iframe>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<iframe src="#arrow" width="1" height="1"></iframe>'),
      ),
    ],
    [
      'an SVG with a srcdoc= attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<g srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"><text>x</text></g>'),
      ),
    ],
    [
      'an SVG with <set> rewriting an href to javascript:',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a><set attributeName="href" to="javascript:alert(1)"/><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with <animate> rewriting an href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          '<a><animate attributeName="href" values="javascript:alert(1)"/><text>x</text></a>',
        ),
      ),
    ],
    [
      'an SVG with a decimal character reference in an href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a href="&#106;avascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a hex character reference in an href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<a href="&#x6A;avascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a character reference in an xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<a xlink:href="&#x6a;&#x61;vascript:alert(1)"><text>x</text></a>'),
      ),
    ],
    [
      'an SVG with a character reference in any attribute value',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<rect width="&#49;0" height="10"/>'),
      ),
    ],
    [
      'an SVG with <use href="data:...">',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<use href="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="/>'),
      ),
    ],
    [
      'an SVG with a data: URL in an xlink:href',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          '<image xlink:href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E" width="1" height="1"/>',
        ),
      ),
    ],
    [
      'an SVG with an element outside the allowlist (<embed>)',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG('<embed src="#arrow" width="1" height="1"/>'),
      ),
    ],
  ])('fails on %s', (_label, plant) => {
    const { root, check } = repo();
    expect(check()).toBe(0);
    plant(root);
    expect(check()).not.toBe(0);
  });
});
