// @vitest-environment node
// Allowlist vector tables, and the token consumers. NON_NEGOTIABLES #6: each
// allowlist check that decides whether a file the site publishes as-is is safe
// keeps its table of the vectors it must reject here (for the SVG check: the
// `svgProblems` vector table plus the encoding and character-reference cases).
// These run in-process in milliseconds.
//
// Each guard script's planted-violation tests live in a test file named after
// it (scripts/check-*.test.mjs), with their shared helpers in
// src/test/guard-helpers.mjs.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diagramTokens, svgProblems } from './diagram-manifest.mjs';
import { cleanTemps, copyScripts, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

describe('svgProblems rejects fetch and script vectors (retro regression guard)', () => {
  // Each vector is injected into a copy of a real committed SVG, so the only
  // thing wrong with it is the vector. Most go inside d2's inner <svg> (right
  // after its opening tag), some into the root tag, the <style> CDATA, the
  // @font-face, or the prolog. The URLs are placeholders that can't resolve.
  // (encoding="utf-7" was in the original probe too; it lives in the next
  // describe, since it is the one vector the allowlist accepted.)
  const base = readFileSync(
    resolve('public/diagrams/url-shortener/architecture.light.svg'),
    'utf8',
  );
  const innerOpen = base.indexOf('<svg', base.indexOf('<svg') + 4);
  const firstInner = base.indexOf('>', innerOpen) + 1;
  const at = (s) => base.slice(0, firstInner) + s + base.slice(firstInner);
  const root = (attr) => base.replace('<svg ', `<svg ${attr} `);
  const inStyle = (css) => base.replace('<![CDATA[', `<![CDATA[\n${css}\n`);
  const U = (n) => `http://example.invalid/${n}`;

  const VECTORS = {
    image: at(`<image href="${U('image')}" width="1" height="1"/>`),
    imageXlink: at(`<image xlink:href="${U('imagex')}" width="1" height="1"/>`),
    use: at(`<use href="${U('use')}#a"/>`),
    feImage: at(`<filter id="f"><feImage href="${U('feimage')}"/></filter>`),
    aHref: at(`<a href="${U('a')}"><rect width="1" height="1"/></a>`),
    styleAttrUrl: at(`<rect width="1" height="1" style="fill:url(${U('sattr')})"/>`),
    styleAttrUrlNoQuote: at(
      `<rect width="1" height="1" style="mask:url(${U('smask')})"/>`,
    ),
    styleAttrImageSet: at(
      `<rect width="1" height="1" style="mask-image:image-set(${U('iset')} 1x)"/>`,
    ),
    fillAttrUrl: at(`<rect width="1" height="1" fill="url(${U('fillurl')})"/>`),
    fillAttrUrlUpper: at(`<rect width="1" height="1" fill="URL(${U('fillurlup')})"/>`),
    markerAttr: at(`<path d="M0 0L1 1" marker-end="url(${U('marker')}#m)"/>`),
    maskAttrSpaced: at(`<rect width="1" height="1" mask="url( ${U('maskspace')} )"/>`),
    styleImport: inStyle(`@import url(${U('import')});`),
    styleImportBare: inStyle(`@import '${U('importbare')}';`),
    styleBg: inStyle(`.x{background:url(${U('stylebg')})}`),
    styleBgUpper: inStyle(`.x{background:URL(${U('stylebgup')})}`),
    styleEscape: inStyle(`.x{background:\\75rl(${U('esc')})}`),
    styleFontFaceExtra: base.replace(
      'src: url("data:',
      `src: url(${U('ff')}), url("data:`,
    ),
    xmlStylesheet: base.replace('?>', `?><?xml-stylesheet href="${U('xss')}"?>`),
    doctypeEntity: base.replace(
      '?>',
      `?><!DOCTYPE svg [<!ENTITY e SYSTEM "${U('ent')}">]>`,
    ),
    nsPrefix: at(`<x:image xmlns:x="http://www.w3.org/2000/svg" href="${U('ns')}"/>`),
    attrCase: at(`<image HREF="${U('case')}" width="1" height="1"/>`),
    tabWhitespace: at(`<image\thref="${U('tab')}"\twidth="1"\theight="1"/>`),
    cdataSplit: base.replace(
      '<![CDATA[',
      `<![CDATA[ .x{background:url(${U('cdata')})} ]]><![CDATA[`,
    ),
    onload: root(`onload="fetch('${U('onload')}')"`),
    script: at(`<script>fetch('${U('script')}')</script>`),
    foreignObject: at(
      `<foreignObject><img xmlns="http://www.w3.org/1999/xhtml" src="${U('fo')}"/></foreignObject>`,
    ),
    animate: at(
      `<a><animate attributeName="href" to="${U('anim')}"/><rect width="1" height="1"/></a>`,
    ),
    cursor: at(`<rect width="1" height="1" cursor="url(${U('cursor')}),auto"/>`),
    clipPath: at(`<rect width="1" height="1" clip-path="url(${U('clip')}#c)"/>`),
    filterAttr: at(`<rect width="1" height="1" filter="url(${U('filt')}#f)"/>`),
    fontFamilyUrl: inStyle(`.x{font-family:"a";src:url(${U('ffsrc')})}`),
  };

  it('accepts the unmodified committed SVG', () => {
    expect(svgProblems(base)).toEqual([]);
  });

  it('injects every vector (each one changes the file)', () => {
    for (const svg of Object.values(VECTORS)) expect(svg).not.toBe(base);
  });

  it.each(Object.entries(VECTORS))('rejects %s', (_name, svg) => {
    expect(svgProblems(svg).length).toBeGreaterThan(0);
  });
});

describe('svgProblems accepts only a UTF-8 XML declaration (retro)', () => {
  // A declared encoding other than UTF-8 makes the parser decode the bytes
  // differently from how the allowlist read them (UTF-7 can spell `<script>`
  // as `+ADw-script+AD4-`), so the allowlist only means anything for UTF-8.
  const svg = (decl) =>
    `${decl}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="1" height="1"/></svg>\n`;

  it.each([
    ['encoding="utf-8"', '<?xml version="1.0" encoding="utf-8"?>'],
    ['encoding="UTF-8"', '<?xml version="1.0" encoding="UTF-8"?>'],
    ['no encoding attribute', '<?xml version="1.0"?>'],
    ['no XML declaration', ''],
  ])('accepts %s', (_label, decl) => {
    expect(svgProblems(svg(decl))).toEqual([]);
  });

  it.each([
    ['utf-7', '<?xml version="1.0" encoding="utf-7"?>'],
    ['UTF-7', '<?xml version="1.0" encoding="UTF-7"?>'],
    ['ISO-8859-1', '<?xml version="1.0" encoding="ISO-8859-1"?>'],
    ['utf-16', '<?xml version="1.0" encoding="utf-16"?>'],
    ['windows-1252', '<?xml version="1.0" encoding="windows-1252"?>'],
  ])('rejects encoding="%s"', (_label, decl) => {
    expect(svgProblems(svg(decl)).length).toBeGreaterThan(0);
  });

  // Retro: the declaration is an allowlist of its own. The only accepted shape
  // is `<?xml version="1.0"` then optionally ` encoding="utf-8"` (any case)
  // then optionally ` standalone="yes|no"`, in that order, each at most once,
  // single spaces, double quotes, then `?>`. Anything else, including a
  // duplicate encoding whose second value a parser might honor, is rejected.
  it.each([
    ['encoding="Utf-8"', '<?xml version="1.0" encoding="Utf-8"?>'],
    ['standalone="yes"', '<?xml version="1.0" standalone="yes"?>'],
    ['standalone="no"', '<?xml version="1.0" standalone="no"?>'],
    [
      'encoding then standalone',
      '<?xml version="1.0" encoding="utf-8" standalone="yes"?>',
    ],
  ])('accepts %s', (_label, decl) => {
    expect(svgProblems(svg(decl))).toEqual([]);
  });

  it.each([
    [
      'a duplicate encoding (utf-8 then utf-7)',
      '<?xml version="1.0" encoding="utf-8" encoding="utf-7"?>',
    ],
    [
      'a duplicate encoding (utf-8 twice)',
      '<?xml version="1.0" encoding="utf-8" encoding="utf-8"?>',
    ],
    ['a duplicate version', '<?xml version="1.0" version="1.0"?>'],
    ['a duplicate standalone', '<?xml version="1.0" standalone="yes" standalone="no"?>'],
    ['encoding before version', '<?xml encoding="utf-8" version="1.0"?>'],
    [
      'standalone before encoding',
      '<?xml version="1.0" standalone="yes" encoding="utf-8"?>',
    ],
    ['no version', '<?xml encoding="utf-8"?>'],
    ['an empty declaration', '<?xml?>'],
    ['version 1.1', '<?xml version="1.1"?>'],
    ['an unknown attribute', '<?xml version="1.0" foo="bar"?>'],
    [
      'an unknown attribute after encoding',
      '<?xml version="1.0" encoding="utf-8" x="y"?>',
    ],
    ['standalone="maybe"', '<?xml version="1.0" standalone="maybe"?>'],
    ['single quotes', "<?xml version='1.0' encoding='utf-8'?>"],
    ['a double space', '<?xml version="1.0"  encoding="utf-8"?>'],
    ['a tab separator', '<?xml version="1.0"\tencoding="utf-8"?>'],
    ['a newline separator', '<?xml version="1.0"\nencoding="utf-8"?>'],
    ['a space before ?>', '<?xml version="1.0" ?>'],
    ['an uppercase XML target', '<?XML version="1.0"?>'],
    ['encoding="utf8"', '<?xml version="1.0" encoding="utf8"?>'],
  ])('rejects %s', (_label, decl) => {
    expect(svgProblems(svg(decl)).length).toBeGreaterThan(0);
  });

  it('accepts the exact declaration the committed SVGs use', () => {
    const base = readFileSync(
      resolve('public/diagrams/url-shortener/architecture.light.svg'),
      'utf8',
    );
    expect(base.startsWith('<?xml version="1.0" encoding="utf-8"?><svg ')).toBe(true);
    expect(svgProblems(base)).toEqual([]);
  });

  it('rejects utf-7 in a copy of the committed SVG (the probe vector)', () => {
    const base = readFileSync(
      resolve('public/diagrams/url-shortener/architecture.light.svg'),
      'utf8',
    );
    expect(base).toContain('encoding="utf-8"');
    expect(
      svgProblems(base.replace('encoding="utf-8"', 'encoding="utf-7"')).length,
    ).toBeGreaterThan(0);
  });
});

// The token parsing itself is tested once, in css-tokens.test.mjs. Each
// consumer below gets one test that it reads the real tokens through it.
describe('the token consumers read the real src/index.css', () => {
  const realCss = readFileSync(resolve('src/index.css'), 'utf8');
  const lightText = /(--color-text-primary:\s*)#[0-9a-f]{6}/;
  // check-contrast and check-design-tokens have no root override, so each runs
  // as a copy (with the shared reader) beside its own src/index.css and docs.
  function copyRun(script, css) {
    const root = tempDir();
    for (const dir of ['src', 'docs']) mkdirSync(join(root, dir));
    copyScripts(root, 'css-tokens.mjs', script);
    writeFileSync(join(root, 'src/index.css'), css);
    copyFileSync(resolve('docs/DESIGN.md'), join(root, 'docs/DESIGN.md'));
    return spawnSync(process.execPath, [join(root, 'scripts', script)], {
      encoding: 'utf8',
    });
  }

  it('diagramTokens records the real light and dark values', () => {
    const { tokens, problems } = diagramTokens(realCss);
    expect(problems).toEqual([]);
    expect(tokens.light['text-primary']).toBe(lightText.exec(realCss)[0].slice(-7));
    expect(tokens.light['bg-primary']).not.toBe(tokens.dark['bg-primary']);
  });

  it('check-contrast passes the real palette and fails a planted low-contrast token', () => {
    expect(copyRun('check-contrast.mjs', realCss).status).toBe(0);
    const { status, stderr } = copyRun(
      'check-contrast.mjs',
      realCss.replace(lightText, '$1#d0d0d0'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/light: text-primary \(#d0d0d0\)/);
  });

  it('check-design-tokens passes the real table and fails a token it no longer matches', () => {
    expect(copyRun('check-design-tokens.mjs', realCss).status).toBe(0);
    const { status, stderr } = copyRun(
      'check-design-tokens.mjs',
      realCss.replace(lightText, '$1#111111'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/text-primary[\s\S]*#111111/);
  });
});
