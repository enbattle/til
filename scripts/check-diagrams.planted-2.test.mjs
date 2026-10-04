// @vitest-environment node
// Planted-violation tests for scripts/check-diagrams.mjs: the second half of
// the table of violations each planted into a clean fixture (M3 the lock, L5
// .d2 colors, M1 CSS loads, L3 imports, L7 hex colors). The first half is in
// check-diagrams.planted-1.test.mjs; both share the test title and body, split
// only so neither file sets vitest's wall time (see check-diagrams.test.mjs).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, diagramFixture } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { SOURCE, SVG, TOKENS, CSS, write, editManifest, repo, plantSvg, plantSource } =
  diagramFixture;

describe('check-diagrams', () => {
  it.each([
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
  ])('fails on %s', (_label, plant) => {
    const { root, check } = repo();
    expect(check()).toBe(0);
    plant(root);
    expect(check()).not.toBe(0);
  });
});
