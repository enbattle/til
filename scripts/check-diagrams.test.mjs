// @vitest-environment node
// Planted-violation tests for scripts/check-diagrams.mjs: clean fixtures,
// widths, the lock's messages and contrast. The group has no nested
// `describe`, so it is split across files by its top-level tests to keep any
// one file from setting vitest's wall time:
//
// - check-diagrams.references.test.mjs: diagram references and path rules;
// - check-diagrams.planted-1.test.mjs and check-diagrams.planted-2.test.mjs:
//   the table of planted violations ("fails on %s"), in two halves.
//
// The fixture, and the interface it assumes, are in src/test/guard-helpers.mjs.
// The SVG allowlist's own vector tables (NON_NEGOTIABLES #6) stay in
// checks.test.mjs.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanTemps,
  diagramFixture,
  gitInit,
  run,
  tempDir,
} from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

const { SOURCE, SVG, TOKENS, CSS, write, lock, repo, plantSvg, plantSource } =
  diagramFixture;

describe('check-diagrams', () => {
  it('passes on the repository itself', () => {
    expect(run('check-diagrams.mjs').status).toBe(0);
  });

  it('passes a clean fixture (internal #fragment hrefs and xmlns URLs are fine)', () => {
    const { result } = repo();
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('passes a clean fixture whose source has CRLF line endings', () => {
    const { root, check } = repo();
    write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE.replace(/\n/g, '\r\n'));
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose SVGs have CRLF line endings (autocrlf checkout)', () => {
    const { root, check } = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', SVG().replace(/\n/g, '\r\n'));
    write(root, 'public/diagrams/demo/flow.dark.svg', SVG().replace(/\n/g, '\r\n'));
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose SVG text has escaped characters in text content', () => {
    // D2 escapes `&`, `<` and quotes in labels; entity references are only
    // suspicious inside attribute values.
    const { root, check } = repo();
    plantSvg(
      'public/diagrams/demo/flow.light.svg',
      SVG(
        '<g><text x="1" y="1">reads &amp; writes &lt; 1 ms, &#34;hot&#34; keys</text></g>',
      ),
    )(root);
    expect(check()).toBe(0);
  });

  it('passes a clean fixture whose source uses non-color styles', () => {
    const { root, check } = repo();
    plantSource(
      `${SOURCE}db.shape: cylinder\napi: API {\n  style.multiple: true\n  style.stroke-dash: 3\n  style.bold: true\n}\n`,
    )(root);
    expect(check()).toBe(0);
  });

  // Review L7: `#` followed by a number or word in a label or comment is not a
  // color. check-diagrams is the only hex guard over `.d2` files.
  it.each([
    ['a label with an issue number', `${SOURCE}x: "Issue #123"\n`],
    ['a comment', `# add a node\n${SOURCE}`],
    ['a trailing comment', `${SOURCE}x: Cache # add a node later\n`],
  ])('passes a .d2 with # that is not a color: %s', (_label, source) => {
    const { root, result } = repo();
    plantSource(source)(root);
    const { status, stderr } = result();
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  it('passes a copy of a real committed D2 v0.9 diagram (url-shortener/architecture)', () => {
    // Keeps the SVG allowlist honest: whatever check-diagrams permits must
    // include everything real d2 output uses (nested <svg>, <style> with a
    // data: font URL, <g>, <mask>, <marker>, <polygon>, ...).
    const repoRoot = resolve('.');
    const root = tempDir();
    gitInit(root);
    write(root, 'src/index.css', CSS());
    for (const [from, to] of [
      [
        'src/system-design/diagrams/url-shortener/architecture.d2',
        'src/system-design/diagrams/url-shortener/architecture.d2',
      ],
      [
        'public/diagrams/url-shortener/architecture.light.svg',
        'public/diagrams/url-shortener/architecture.light.svg',
      ],
      [
        'public/diagrams/url-shortener/architecture.dark.svg',
        'public/diagrams/url-shortener/architecture.dark.svg',
      ],
    ]) {
      mkdirSync(dirname(join(root, to)), { recursive: true });
      copyFileSync(join(repoRoot, from), join(root, to));
    }
    write(
      root,
      'src/system-design/case-studies/url-shortener.md',
      '---\ntitle: Design a URL Shortener\nsummary: A demo.\ndate: 2026-09-28\norder: 1\n---\n\n## High-level architecture\n\n![The architecture](/diagrams/url-shortener/architecture.svg)\n',
    );
    lock(root);
    const { status, stderr } = run('check-diagrams.mjs', [], {
      CHECK_DIAGRAMS_ROOT: root,
    });
    expect(stderr).toBe('');
    expect(status).toBe(0);
  });

  // A diagram wider than 960 px scales below 0.75 in the ~720 px column
  // (add-case-study checklist item 5), so its recorded width fails the check.
  const wideSvg = (width) =>
    SVG().replace(
      'viewBox="0 0 100 50" width="100"',
      `viewBox="0 0 ${width} 50" width="${width}"`,
    );
  it.each([
    [960, 0],
    [961, 1],
  ])('checks the recorded width: %i px exits %i', (width, expected) => {
    const { root, result } = repo();
    write(root, 'public/diagrams/demo/flow.light.svg', wideSvg(width));
    plantSvg('public/diagrams/demo/flow.dark.svg', wideSvg(width))(root);
    const { status, stderr } = result();
    expect(status).toBe(expected);
    if (expected) expect(stderr).toMatch(/demo\/flow\.d2: .*961 px wide.*960/);
    else expect(stderr).toBe('');
  });

  it('names the stale SVG when its bytes no longer match the manifest', () => {
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(
      root,
      'public/diagrams/demo/flow.dark.svg',
      SVG('<rect width="1" height="1"/>'),
    );
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/flow\.dark\.svg/);
  });

  it('names the tokens when src/index.css no longer matches the manifest', () => {
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(
      root,
      'src/index.css',
      CSS({ ...TOKENS, light: { ...TOKENS.light, accent: '#1d4ed8' } }),
    );
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/accent|index\.css|token/i);
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
    const { root, check, result } = repo();
    expect(check()).toBe(0);
    write(root, 'src/index.css', CSS(tokens));
    lock(root);
    const { status, stderr } = result();
    expect(status).not.toBe(0);
    expect(stderr).toMatch(/4\.5|contrast/i);
  });
});
