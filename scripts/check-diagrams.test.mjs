// @vitest-environment node
// Planted-violation tests for scripts/check-diagrams.mjs, called in-process
// through its exported `diagramProblems(root)` (docs/specs/
// in-process-checks.md, criteria 1, 2 and 4): clean fixtures, widths, the
// lock's messages and contrast, the table of planted violations, diagram
// references and path rules, and the one run as a script.
//
// The fixture, and the interface it assumes, are in src/test/guard-helpers.mjs.
// The SVG allowlist's own vector tables (NON_NEGOTIABLES #6) stay in
// checks.test.mjs.
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  cleanTemps,
  diagramFixture,
  repoWith,
  slashes,
  tempDir,
} from '../src/test/guard-helpers.mjs';
import { diagramProblems } from './check-diagrams.mjs';

afterEach(cleanTemps);

const {
  SOURCE,
  SVG,
  CASE_STUDY,
  TOKENS,
  CSS,
  write,
  lock,
  editManifest,
  plantSvg,
  plantSource,
  plantDiagram,
} = diagramFixture;

// Every case starts from the same clean fixture, so it is built once and each
// case plants into its own copy (a fresh git repository costs more than a
// copy on Windows). The clean fixture's own test below shows it passes.
let base;
beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'til-diagrams-base-'));
  cpSync(diagramFixture.repo(), base, { recursive: true });
});
afterAll(() => rmSync(base, { recursive: true, force: true }));

/** A copy of the clean fixture. */
function repo() {
  const root = tempDir();
  cpSync(base, root, { recursive: true });
  return root;
}

const problems = (root) => slashes(diagramProblems(root));
// Every problem names the file at fault: a source, an SVG, the manifest,
// src/index.css or a case study.
const NAMES_A_FILE = /\.(d2|svg|md|json|css|xml|html|txt)\b/i;

describe('check-diagrams', () => {
  it('returns no problems for the repository itself', () => {
    expect(problems(resolve('.'))).toEqual([]);
    expect(slashes(diagramProblems())).toEqual([]);
  });

  // Criterion 2: the one run as a script.
  it('exits 0 with its success message when run on the repository', () => {
    const result = spawnSync(process.execPath, [resolve('scripts/check-diagrams.mjs')], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/diagrams are rendered, current and safe/);
  });

  it('passes a clean fixture (internal #fragment hrefs and xmlns URLs are fine)', () => {
    expect(problems(repo())).toEqual([]);
  });

  it('passes a clean fixture whose source has CRLF line endings', () => {
    const root = repo();
    write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE.replace(/\n/g, '\r\n'));
    expect(problems(root)).toEqual([]);
  });

  it('passes a clean fixture whose SVGs have CRLF line endings (autocrlf checkout)', () => {
    const root = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', SVG().replace(/\n/g, '\r\n'));
    write(root, 'public/diagrams/demo/flow.dark.svg', SVG().replace(/\n/g, '\r\n'));
    expect(problems(root)).toEqual([]);
  });

  it('passes a clean fixture whose SVG text has escaped characters in text content', () => {
    // D2 escapes `&`, `<` and quotes in labels; entity references are only
    // suspicious inside attribute values.
    const root = repo();
    plantSvg(
      'public/diagrams/demo/flow.light.svg',
      SVG(
        '<g><text x="1" y="1">reads &amp; writes &lt; 1 ms, &#34;hot&#34; keys</text></g>',
      ),
    )(root);
    expect(problems(root)).toEqual([]);
  });

  it('passes a clean fixture whose source uses non-color styles', () => {
    const root = repo();
    plantSource(
      `${SOURCE}db.shape: cylinder\napi: API {\n  style.multiple: true\n  style.stroke-dash: 3\n  style.bold: true\n}\n`,
    )(root);
    expect(problems(root)).toEqual([]);
  });

  // Review L7: `#` followed by a number or word in a label or comment is not a
  // color. check-diagrams is the only hex guard over `.d2` files.
  it.each([
    ['a label with an issue number', `${SOURCE}x: "Issue #123"\n`],
    ['a comment', `# add a node\n${SOURCE}`],
    ['a trailing comment', `${SOURCE}x: Cache # add a node later\n`],
  ])('passes a .d2 with # that is not a color: %s', (_label, source) => {
    const root = repo();
    plantSource(source)(root);
    expect(problems(root)).toEqual([]);
  });

  it('passes a copy of a real committed D2 v0.9 diagram (url-shortener/architecture)', () => {
    // Keeps the SVG allowlist honest: whatever check-diagrams permits must
    // include everything real d2 output uses (nested <svg>, <style> with a
    // data: font URL, <g>, <mask>, <marker>, <polygon>, ...).
    const root = repoWith({ 'src/index.css': CSS() });
    for (const path of [
      'src/system-design/diagrams/url-shortener/architecture.d2',
      'public/diagrams/url-shortener/architecture.light.svg',
      'public/diagrams/url-shortener/architecture.dark.svg',
    ]) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      copyFileSync(resolve(path), join(root, path));
    }
    write(
      root,
      'src/system-design/case-studies/url-shortener.md',
      '---\ntitle: Design a URL Shortener\nsummary: A demo.\ndate: 2026-09-28\norder: 1\n---\n\n## High-level architecture\n\n![The architecture](/diagrams/url-shortener/architecture.svg)\n',
    );
    lock(root);
    expect(problems(root)).toEqual([]);
  });

  // A diagram wider than 960 px scales below 0.75 in the ~720 px column
  // (add-case-study checklist item 5), so its recorded width fails the check.
  const wideSvg = (width) =>
    SVG().replace(
      'viewBox="0 0 100 50" width="100"',
      `viewBox="0 0 ${width} 50" width="${width}"`,
    );
  it('passes a recorded width of 960 px', () => {
    const root = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', wideSvg(960));
    plantSvg('public/diagrams/demo/flow.dark.svg', wideSvg(960))(root);
    expect(problems(root)).toEqual([]);
  });

  it('fails a recorded width of 961 px, naming the source', () => {
    const root = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', wideSvg(961));
    plantSvg('public/diagrams/demo/flow.dark.svg', wideSvg(961))(root);
    expect(problems(root).join('\n')).toMatch(/demo\/flow\.d2: .*961 px wide.*960/);
  });

  it('names the stale SVG when its bytes no longer match the manifest', () => {
    const root = repo();
    write(
      root,
      'public/diagrams/demo/flow.dark.svg',
      SVG('<rect width="1" height="1"/>'),
    );
    expect(problems(root).join('\n')).toMatch(/flow\.dark\.svg/);
  });

  it('names the tokens when src/index.css no longer matches the manifest', () => {
    const root = repo();
    write(
      root,
      'src/index.css',
      CSS({ ...TOKENS, light: { ...TOKENS.light, accent: '#1d4ed8' } }),
    );
    const found = problems(root);
    expect(found).not.toEqual([]);
    expect(found.join('\n')).toMatch(/index\.css/);
    expect(found.join('\n')).toMatch(/accent/);
  });

  // --- M3 contrast: CI enforces what render-diagrams checks before rendering.
  // The tokens and manifest agree (as if re-rendered), so only contrast fails.
  it.each([
    [
      'dark text-secondary (connection labels) on the dark accent-soft fill',
      { ...TOKENS, dark: { ...TOKENS.dark, 'text-secondary': '#5a4a35' } },
    ],
    [
      'light text-primary (labels) on the light bg-tertiary fill',
      { ...TOKENS, light: { ...TOKENS.light, 'text-primary': '#a89c8c' } },
    ],
  ])('fails when tokens put diagram text below 4.5:1: %s', (_label, tokens) => {
    const root = repo();
    write(root, 'src/index.css', CSS(tokens));
    lock(root);
    const found = problems(root);
    expect(found).not.toEqual([]);
    expect(found.join('\n')).toMatch(/4\.5|contrast/i);
    expect(found.join('\n')).toMatch(/index\.css/);
  });

  // The table of violations, each planted into a clean fixture.
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

    // --- M3: the lock covers the rendered SVG bytes and the color tokens.
    [
      'a committed SVG edited without re-render (one color changed)',
      (root) =>
        write(
          root,
          'public/diagrams/demo/flow.light.svg',
          SVG().replace(
            '<rect width="10" height="10"/>',
            '<rect width="10" height="10" fill="red"/>',
          ),
        ),
    ],
    [
      'a manifest entry with no svgs hashes',
      (root) => editManifest(root, (manifest) => delete manifest['demo/flow.d2'].svgs),
    ],
    [
      'a manifest with no $tokens',
      (root) => editManifest(root, (manifest) => delete manifest.$tokens),
    ],
    [
      'a --color-* token in src/index.css changed without re-render',
      (root) =>
        write(
          root,
          'src/index.css',
          CSS({ ...TOKENS, light: { ...TOKENS.light, accent: '#1d4ed8' } }),
        ),
    ],
    [
      'a dark --color-* token in src/index.css changed without re-render',
      (root) =>
        write(
          root,
          'src/index.css',
          CSS({ ...TOKENS, dark: { ...TOKENS.dark, 'bg-secondary': '#2b231b' } }),
        ),
    ],

    // --- L5: a .d2 source naming a color by any syntax, not just hex. Each
    // plant re-locks, so only the color guard can fail it.
    ['a .d2 with x.style.fill: red', plantSource(`${SOURCE}api.style.fill: red\n`)],
    [
      'a .d2 with an inline {style.fill: red}',
      plantSource(`${SOURCE}cache: Cache {style.fill: red}\n`),
    ],
    [
      'a .d2 with style.font-color: green',
      plantSource(`${SOURCE}db: DB {\n  style.font-color: green\n}\n`),
    ],
    [
      'a .d2 with a nested style map setting fill',
      plantSource(`${SOURCE}api: API {\n  style: {\n    fill: red\n  }\n}\n`),
    ],
    [
      'a .d2 with a connection style.stroke',
      plantSource(`${SOURCE}(client -> api)[0].style.stroke: blue\n`),
    ],

    // --- Review M1: CSS that loads an external resource without a literal
    // `url(`. Each plant re-locks, so only the SVG allowlist can fail it.
    [
      'an SVG with image-set() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          `<rect width="1" height="1" style="mask-image:image-set('http://x.example/a.png' 1x)"/>`,
        ),
      ),
    ],
    [
      'an SVG with -webkit-image-set() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG(
          `<rect width="1" height="1" style="-webkit-mask-image:-webkit-image-set('http://x.example/a.png' 1x)"/>`,
        ),
      ),
    ],
    [
      'an SVG with a CSS-escaped url() in a style attribute',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<rect width="1" height="1" style="mask-image:u\\72l(http://x.example/a.png)"/>',
        ),
      ),
    ],
    [
      'an SVG with a backslash in an attribute value',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<rect width="1" height="1" class="a\\62 c"/>'),
      ),
    ],
    [
      'an SVG whose root <svg> has an image-set() background',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG().replace(
          '<svg xmlns=',
          `<svg style="background-image:image-set('http://x.example/a.png' 1x)" xmlns=`,
        ),
      ),
    ],
    [
      'an SVG with image-set() inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<style>.x{background:image-set("http://x.example/a.png" 1x)}</style>'),
      ),
    ],
    [
      'an SVG with cross-fade() inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.light.svg',
        SVG(
          '<style>.x{background:cross-fade("http://x.example/a.png" 50%, "http://x.example/b.png")}</style>',
        ),
      ),
    ],
    [
      'an SVG with a bare-string @import inside <style>',
      plantSvg(
        'public/diagrams/demo/flow.dark.svg',
        SVG('<style>@import "http://x.example/a.css";</style>'),
      ),
    ],

    // --- Review L3: D2 imports pull in files outside the source hash and the
    // color guard. Each plant re-locks, so only an import check can fail it.
    ['a .d2 spreading an import (...@other)', plantSource(`${SOURCE}...@other\n`)],
    ['a .d2 importing as a value (x: @../other)', plantSource(`${SOURCE}x: @../other\n`)],
    [
      'a .d2 importing inside a block',
      plantSource(`${SOURCE}api: API {\n  ...@shared\n}\n`),
    ],

    // --- Review L7: a real hex color is still caught.
    [
      'a .d2 with style.fill: "#ff0000"',
      plantSource(`${SOURCE}x.style.fill: "#ff0000"\n`),
    ],
    [
      'a .d2 with a hex color as a whole quoted value',
      plantSource(`${SOURCE}vars: {\n  brand: "#ff0000"\n}\n`),
    ],
  ])('fails on %s, naming the file', (_label, plant) => {
    const root = repo();
    plant(root);
    const found = problems(root);
    expect(found).not.toEqual([]);
    expect(
      found.every((problem) => NAMES_A_FILE.test(problem)),
      found.join('\n'),
    ).toBe(true);
  });

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
      const root = repo();
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      const found = problems(root).join('\n');
      expect(found).toMatch(/demo\.md/);
      expect(found).toMatch(/demo\/nope/);
    },
  );

  it.each(IMAGE_SYNTAXES('/diagrams/demo/flow.svg'))(
    'passes an existing diagram referenced by %s',
    (_label, markdown) => {
      const root = repo();
      write(
        root,
        'src/system-design/case-studies/demo.md',
        CASE_STUDY(`\n${markdown}\n`),
      );
      expect(problems(root)).toEqual([]);
    },
  );

  it.each([
    ['a fenced code block', '```md\n![x](/diagrams/demo/nope.svg)\n```'],
    ['a tilde-fenced code block', '~~~\n![x](/diagrams/demo/nope.svg)\n~~~'],
    ['inline code', 'Write `![x](/diagrams/demo/nope.svg)` on its own line.'],
    ['an indented code block', '    ![x](/diagrams/demo/nope.svg)'],
  ])('passes a missing diagram path shown only inside %s', (_label, markdown) => {
    const root = repo();
    write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY(`\n${markdown}\n`));
    expect(problems(root)).toEqual([]);
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
      const root = repo();
      write(root, path, content);
      expect(problems(root).join('\n')).toContain(path.replace('public/diagrams/', ''));
    },
  );

  it('fails on rendered SVGs nested deeper than public/diagrams/<case>/', () => {
    const root = repo();
    plantDiagram(root, 'demo/sub/deep');
    expect(problems(root).join('\n')).toMatch(/demo\/sub\/deep/);
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
      const root = repo();
      plantDiagram(root, name);
      expect(problems(root).join('\n')).toContain(shown);
    },
  );
});
