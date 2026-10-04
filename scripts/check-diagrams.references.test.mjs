// @vitest-environment node
// Planted-violation tests for scripts/check-diagrams.mjs: diagram references
// in case studies, and the path rules under public/diagrams/ and the sources.
// Split from check-diagrams.test.mjs (see its header); the fixture is in
// src/test/guard-helpers.mjs.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, diagramFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { SVG, CASE_STUDY, write, repo, plantDiagram } = diagramFixture;

describe('check-diagrams', () => {
  // --- Review M2: "referenced" means exactly "would render as a diagram", so
  // the reference check parses the case study with the site's markdown stack
  // (remark-parse + remark-gfm) instead of matching one line at a time. Every
  // markdown image syntax that renders a `/diagrams/...svg` image counts, and
  // an example shown as code doesn't.
  const IMAGE_SYNTAXES = (path) => [
    [
      'an image whose alt text wraps onto a second line',
      `![A long alt text that\nwraps onto the next line](${path})`,
    ],
    [
      'an image whose alt text wraps across three lines',
      `![A long alt text that\nwraps onto the next line\nand onto a third](${path})`,
    ],
    ['a reference-style image', `![x][miss]\n\n[miss]: ${path}`],
    ['an image with an angle-bracket destination', `![x](<${path}>)`],
    ['an image with a title', `![x](${path} "Title")`],
  ];

  it.each(IMAGE_SYNTAXES('/diagrams/demo/nope.svg'))(
    'fails, naming the case study and the path, on a missing diagram referenced by %s',
    (_label, markdown) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toMatch(/demo\.md/);
      expect(stderr).toMatch(/demo\/nope/);
    },
  );

  it.each(IMAGE_SYNTAXES('/diagrams/demo/flow.svg'))(
    'passes an existing diagram referenced by %s',
    (_label, markdown) => {
      const { root, result } = repo();
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      const { status, stderr } = result();
      expect(stderr).toBe('');
      expect(status).toBe(0);
    },
  );

  it.each([
    ['a fenced code block', '```md\n![x](/diagrams/demo/nope.svg)\n```'],
    ['a tilde-fenced code block', '~~~\n![x](/diagrams/demo/nope.svg)\n~~~'],
    ['inline code', 'Write `![x](/diagrams/demo/nope.svg)` on its own line.'],
    ['an indented code block', '    ![x](/diagrams/demo/nope.svg)'],
  ])('passes a missing diagram path shown only inside %s', (_label, markdown) => {
    const { root, result } = repo();
    write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY(`\n${markdown}\n`));
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  // --- Review L1: public/diagrams/ holds only `<case>/<name>.light.svg`,
  // `<case>/<name>.dark.svg` and the root manifest.json. Anything else fails
  // and is named, even when its extension isn't a lowercase `.svg`.
  it.each([
    ['an uppercase .SVG extension', 'public/diagrams/demo/extra.light.SVG', SVG()],
    ['an .xml file', 'public/diagrams/demo/extra.xml', SVG()],
    ['an .html page', 'public/diagrams/demo/page.html', '<!doctype html><p>x</p>\n'],
    ['a stray notes.txt', 'public/diagrams/demo/notes.txt', 'notes\n'],
    ['a stray file at the root', 'public/diagrams/notes.txt', 'notes\n'],
  ])(
    'fails on an unexpected file under public/diagrams/: %s',
    (_label, path, content) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      write(root, path, content);
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toContain(path.replace('public/diagrams/', ''));
    },
  );

  it('fails on rendered SVGs nested deeper than public/diagrams/<case>/', () => {
    const { root, check } = repo();
    expect(check()).toBe(0);
    plantDiagram(root, 'demo/sub/deep');
    expect(check()).not.toBe(0);
  });

  // --- Review L3: sources follow render-diagrams.mjs's naming rule,
  // /^[a-z0-9-]+\/[a-z0-9-]+\.d2$/ (lowercase kebab-case `<case>/<name>.d2`,
  // one level deep). check-diagrams enforces it without d2, naming the source.
  it.each([
    ['an uppercase name', 'url-shortener/Architecture', 'Architecture.d2'],
    [
      'an uppercase, underscored case folder',
      'URL_Shortener/arch',
      'URL_Shortener/arch.d2',
    ],
    ['a source with no case folder', 'top', 'top.d2'],
    ['a source nested two levels deep', 'demo/sub/deep', 'demo/sub/deep.d2'],
  ])(
    'fails on a .d2 source path that breaks the naming rule: %s',
    (_label, name, shown) => {
      const { root, check, result } = repo();
      expect(check()).toBe(0);
      plantDiagram(root, name);
      const { status, stderr } = result();
      expect(status).not.toBe(0);
      expect(stderr).toContain(shown);
    },
  );
});
