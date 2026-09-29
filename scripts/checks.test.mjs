// Planted-violation tests for the guard scripts under scripts/. A guard that
// has only ever passed hasn't been tested (feature/SKILL.md, Stage 3), so each
// case plants the violation the script exists to catch and asserts it fails,
// plus a clean case that must pass. These used to be run by hand and recorded
// only in commit messages; here `verify` runs them.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diagramTokens, svgProblems } from './diagram-manifest.mjs';

// Vitest runs from the repository root; import.meta.url isn't a file URL under jsdom.
const SCRIPTS = resolve('scripts');
const temps = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'til-checks-'));
  temps.push(dir);
  return dir;
}
afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [join(SCRIPTS, script), ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('check-pipeline-log', () => {
  const header = readFileSync(join(SCRIPTS, '../docs/pipeline-log.md'), 'utf8');
  const row = (
    retro,
    { gates = '0', findings = '0/0/0', run = '/feature docs/specs/x.md' } = {},
  ) => `| 2026-09-23 | ${run} | ${gates} | ${findings} | 0 | ${retro} |  |`;
  function check(...rows) {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${rows.join('\n')}\n`);
    return run('check-pipeline-log.mjs', [file]).status;
  }

  it('passes the real, empty log and a well-formed row', () => {
    expect(check()).toBe(0);
    expect(check(row('nothing to change'))).toBe(0);
    expect(check(row('fixed in 4a; no process gap', { findings: '0/1/0, pre:2' }))).toBe(
      0,
    );
  });

  it('passes a row whose columns were padded (Prettier re-pads the table)', () => {
    expect(
      check('|  2026-09-23  |  /feature docs/specs/x.md  | 0 | 0/0/0 | 0 |  ok  |    |'),
    ).toBe(0);
  });

  it.each([
    ['a bare retro after friction', row('nothing to change', { gates: '1 test-lock' })],
    [
      'a retro with punctuation after friction',
      row('Nothing to change.', { findings: '0/1/0' }),
    ],
    ['an empty retro', row('')],
    ['n/a on a /feature row', row('n/a', { findings: '0/1/0' })],
    ['a placeholder retro', row('none')],
    ['an impossible date', row('ok').replace('2026-09-23', '2026-99-99')],
    ['a wrong cell count', '| 2026-09-23 | /feature x | 0 |'],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });

  it('allows n/a only on an add-topic row', () => {
    expect(check(row('n/a', { run: 'add-topic src/content/a/b.md' }))).toBe(0);
  });

  // Retro: the add-case-study skill logs its runs too, and like add-topic it
  // has no retro stage of its own, so its rows may say n/a.
  it('allows n/a on an add-case-study row naming its path', () => {
    expect(
      check(row('n/a', { run: 'add-case-study src/system-design/case-studies/x.md' })),
    ).toBe(0);
    expect(
      check(
        row('ok', {
          run: 'add-case-study src/system-design/case-studies/x.md',
          findings: '0/2/1',
        }),
      ),
    ).toBe(0);
  });

  it.each([
    ['add-case-study with no path', row('n/a', { run: 'add-case-study' })],
    ['add-case-study with a trailing space only', row('n/a', { run: 'add-case-study ' })],
    ['n/a on a /feature row with no friction', row('n/a')],
  ])('fails %s', (_label, bad) => {
    expect(check(bad)).toBe(1);
  });

  it('reports an empty Gate failures cell exactly once', () => {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${row('ok', { gates: '' })}\n`);
    const { status, stderr } = run('check-pipeline-log.mjs', [file]);
    expect(status).toBe(1);
    const messages = stderr.split(/\r?\n/).filter((line) => /Gate failures/.test(line));
    expect(messages).toHaveLength(1);
  });

  it('reports an empty Retro cell exactly once, even after friction', () => {
    const file = join(tempDir(), 'log.md');
    writeFileSync(file, `${header.trimEnd()}\n${row('', { gates: '1 test-lock' })}\n`);
    const { status, stderr } = run('check-pipeline-log.mjs', [file]);
    expect(status).toBe(1);
    const messages = stderr.split(/\r?\n/).filter((line) => /Retro/.test(line));
    expect(messages).toHaveLength(1);
  });

  it('fails a row placed after the table ended', () => {
    expect(check(row('ok'), '', row('nothing to change', { gates: '1 x' }))).toBe(1);
  });

  // Retro: a fix round past the skill's cap of two happens only when the user
  // authorizes it, and the log records that as `N (user-authorized)`.
  const withRounds = (rounds) =>
    row('ok').replace('| 0/0/0 | 0 |', `| 0/0/0 | ${rounds} |`);

  it.each([
    '0',
    '1',
    '2',
    '3 (user-authorized)',
    '4 (user-authorized)',
    '12 (user-authorized)',
  ])('accepts Fix rounds %s', (rounds) => {
    expect(check(withRounds(rounds))).toBe(0);
  });

  it.each(['3', '10', 'x', '(user-authorized)', '3 (authorized)', '3(user-authorized)x'])(
    'rejects Fix rounds %s',
    (rounds) => {
      expect(check(withRounds(rounds))).toBe(1);
    },
  );
});

describe('check-raw-html', () => {
  function repo(files) {
    const root = tempDir();
    mkdirSync(join(root, 'src/components'), { recursive: true });
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify(files.pkg ?? { dependencies: {} }),
    );
    for (const [path, content] of Object.entries(files.src ?? {})) {
      writeFileSync(join(root, 'src', path), content);
    }
    return run('check-raw-html.mjs', [], { CHECK_RAW_HTML_ROOT: root }).status;
  }

  it('passes clean code and the allowed CodeBlock usage', () => {
    expect(
      repo({
        src: { 'components/CodeBlock.tsx': 'dangerouslySetInnerHTML={{ __html }}' },
      }),
    ).toBe(0);
  });

  it.each([
    ['rehype-raw installed', { pkg: { dependencies: { 'rehype-raw': '^7' } } }],
    [
      'dangerouslySetInnerHTML elsewhere',
      { src: { 'components/Bad.tsx': 'dangerouslySetInnerHTML={{}}' } },
    ],
    ['an innerHTML write', { src: { 'components/Bad.tsx': 'el.innerHTML = html;' } }],
    [
      'insertAdjacentHTML',
      { src: { 'components/Bad.tsx': "el.insertAdjacentHTML('beforeend', s)" } },
    ],
    ['document.write', { src: { 'components/Bad.tsx': 'document.write(s)' } }],
  ])('fails on %s', (_label, files) => {
    expect(repo(files)).toBe(1);
  });
});

describe('check-test-lock', () => {
  // The script finds the repository from its own location, so each case runs
  // a copy of it inside a throwaway git repository.
  function repo() {
    const root = tempDir();
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    copyFileSync(
      join(SCRIPTS, 'check-test-lock.mjs'),
      join(root, 'scripts/check-test-lock.mjs'),
    );
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ scripts: { 'test:run': 'vitest run' } }),
    );
    writeFileSync(
      join(root, 'vite.config.ts'),
      "export default {\n  test: {\n    coverage: { enabled: false },\n    include: ['src/**'],\n  },\n};\n",
    );
    writeFileSync(join(root, 'src/lib/a.test.ts'), 'it("a", () => {});\n');
    execFileSync('git', ['init', '-q'], { cwd: root });
    const lock = (mode) =>
      spawnSync(process.execPath, [join(root, 'scripts/check-test-lock.mjs'), mode], {
        encoding: 'utf8',
      }).status;
    return { root, lock };
  }

  it('passes when nothing changed, and fails with no snapshot', () => {
    const { lock } = repo();
    expect(lock('--verify')).toBe(1);
    expect(lock('--snapshot')).toBe(0);
    expect(lock('--verify')).toBe(0);
  });

  it.each([
    [
      'an edited untracked test',
      (root) => writeFileSync(join(root, 'src/lib/a.test.ts'), 'weakened\n'),
    ],
    [
      'an added spec file',
      (root) => writeFileSync(join(root, 'src/lib/b.spec.ts'), 'x\n'),
    ],
    [
      'a narrowed include after a nested block',
      (root) => {
        const path = join(root, 'vite.config.ts');
        writeFileSync(
          path,
          readFileSync(path, 'utf8').replace(
            "include: ['src/**']",
            "include: ['src/none/**']",
          ),
        );
      },
    ],
    [
      'a changed test script',
      (root) =>
        writeFileSync(
          join(root, 'package.json'),
          JSON.stringify({ scripts: { 'test:run': 'vitest run --passWithNoTests' } }),
        ),
    ],
    [
      'a new vitest.config',
      (root) => writeFileSync(join(root, 'vitest.config.ts'), 'export default {};\n'),
    ],
  ])('fails on %s', (_label, plant) => {
    const { root, lock } = repo();
    expect(lock('--snapshot')).toBe(0);
    plant(root);
    expect(lock('--verify')).toBe(1);
  });

  it('allows edits to vite.config.ts outside the test block', () => {
    const { root, lock } = repo();
    expect(lock('--snapshot')).toBe(0);
    const path = join(root, 'vite.config.ts');
    writeFileSync(path, `// a plugin change\n${readFileSync(path, 'utf8')}`);
    expect(lock('--verify')).toBe(0);
  });
});

describe('check-diagrams', () => {
  // Interface assumed for scripts/check-diagrams.mjs (spec: "Diagrams (D2)"):
  //
  // - Run as `node scripts/check-diagrams.mjs` with no arguments. The root it
  //   checks is the repository by default, or the directory in the
  //   CHECK_DIAGRAMS_ROOT environment variable (like CHECK_RAW_HTML_ROOT).
  // - Under that root it reads:
  //     src/system-design/diagrams/<case>/<name>.d2          (sources)
  //     public/diagrams/<case>/<name>.light.svg / .dark.svg  (rendered)
  //     public/diagrams/manifest.json                        (lock file)
  //     src/system-design/case-studies/*.md                  (references)
  //     src/index.css                                        (color tokens)
  // - A case study references a diagram as `/diagrams/<case>/<name>.svg` in a
  //   markdown image; that reference exists when both themed SVGs exist.
  // - Exit 0 when clean, non-zero on any violation.
  //
  // Manifest shape (the lock file; `npm run diagrams` writes it, this checks it).
  // It extends the original shape: every source entry keeps `sha256` (and the
  // optional `width`/`height` the app reads), gains `svgs`, and one reserved
  // top-level key, `$tokens`, records the colors the SVGs were rendered with:
  //
  //   {
  //     "$tokens": {
  //       "light": { "<token>": "#rrggbb", ... },   // from src/index.css `:root {`
  //       "dark":  { "<token>": "#rrggbb", ... }    // from src/index.css `.dark {`
  //     },
  //     "<case>/<name>.d2": {
  //       "sha256": "<hex SHA-256 of the .d2, CRLF normalized to LF>",
  //       "width": 811, "height": 1113,             // optional here
  //       "svgs": {
  //         "light": "<hex SHA-256 of <name>.light.svg, CRLF normalized to LF>",
  //         "dark":  "<hex SHA-256 of <name>.dark.svg, CRLF normalized to LF>"
  //       }
  //     }
  //   }
  //
  // - `$tokens` keys are the token names without the `--color-` prefix
  //   (`text-primary`, `accent-soft`, ...) with lowercase `#rrggbb` values, for
  //   the tokens render-diagrams.mjs maps into the D2 theme (its SLOTS table).
  //   The fixture's src/index.css defines exactly those nine tokens per block,
  //   so recording every `--color-*` declaration in the block is equivalent here.
  //   All SVG and token hashes use the same CRLF->LF normalization as `sha256`
  //   (i.e. `sourceHash` from scripts/diagram-manifest.mjs), so a Windows
  //   checkout with autocrlf and CI agree.
  // - check-diagrams fails when `$tokens` is missing, when a recorded token
  //   value differs from (or is missing in) src/index.css, when an entry has no
  //   `svgs` or an SVG's bytes don't hash to its recorded value, and when the
  //   tokens in src/index.css would put D2 text below WCAG AA (4.5:1) on a fill,
  //   using render-diagrams.mjs's TEXT_ON pairs. `$tokens` is not a source, so
  //   it is never reported as "lists a source that no longer exists".
  // - It also rejects any `.d2` source that names a color, by any syntax (the
  //   render script's own guard only runs where d2 is installed; CI runs this).
  const SOURCE = 'direction: right\nclient -> api: POST /urls\napi -> db: insert\n';
  const SVG = (extra = '') =>
    `<?xml version="1.0" encoding="utf-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 50" width="100" height="50"><defs><marker id="arrow"><path d="M0 0L10 5"/></marker></defs><rect width="10" height="10"/><use href="#arrow"/><use xlink:href="#arrow"/>${extra}</svg>\n`;
  const sha256 = (text) =>
    createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex');
  const CASE_STUDY = (extra = '') =>
    `---\ntitle: Design a Demo\nsummary: A demo.\ndate: 2026-09-28\norder: 1\n---\n\n## High-level architecture\n\n![The request flow](/diagrams/demo/flow.svg)\n${extra}`;

  // The nine tokens render-diagrams.mjs maps into the D2 theme, with the
  // site's current values (all pairs in its TEXT_ON table pass 4.5:1).
  const TOKENS = {
    light: {
      'bg-primary': '#faf6f0',
      'bg-secondary': '#f2ebe0',
      'bg-tertiary': '#ece2d3',
      'text-primary': '#2b2420',
      'text-secondary': '#5c5147',
      'text-tertiary': '#6e6356',
      border: '#ddd1bf',
      accent: '#92400e',
      'accent-soft': '#f3e3c8',
    },
    dark: {
      'bg-primary': '#201a14',
      'bg-secondary': '#2a231b',
      'bg-tertiary': '#342c22',
      'text-primary': '#f2e9dc',
      'text-secondary': '#c9bba6',
      'text-tertiary': '#a39683',
      border: '#3d3428',
      accent: '#f0a83c',
      'accent-soft': '#3d2f16',
    },
  };
  const CSS = (tokens = TOKENS) => {
    const block = (selector, values) =>
      `${selector} {\n${Object.entries(values)
        .map(([name, hex]) => `  --color-${name}: ${hex};`)
        .join('\n')}\n}\n`;
    return `@import 'tailwindcss';\n\n${block(':root', tokens.light)}\n${block('.dark', tokens.dark)}`;
  };

  function write(root, path, content) {
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  /** Every file under `dir` (recursively) ending in `suffix`, relative, with `/`. */
  function list(dir, suffix, base = dir, files = []) {
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) list(path, suffix, base, files);
      else if (entry.endsWith(suffix))
        files.push(relative(base, path).split('\\').join('/'));
    }
    return files;
  }

  /** The `--color-*` values in one src/index.css block, as render-diagrams reads them. */
  function cssTokens(css, selector) {
    const start = css.indexOf(`${selector} {`);
    const block = css.slice(start, css.indexOf('}', start));
    const values = {};
    for (const [, name, hex] of block.matchAll(
      /--color-([a-z-]+):\s*(#[0-9a-fA-F]{6});/g,
    )) {
      values[name] = hex.toLowerCase();
    }
    return values;
  }

  /** What `npm run diagrams` would record for the fixture as it is on disk now
   * (without re-rendering): the manifest in the shape documented above. */
  function lock(root) {
    const sources = join(root, 'src/system-design/diagrams');
    const rendered = join(root, 'public/diagrams');
    const css = readFileSync(join(root, 'src/index.css'), 'utf8');
    const manifest = {
      $tokens: { light: cssTokens(css, ':root'), dark: cssTokens(css, '.dark') },
    };
    for (const source of list(sources, '.d2').sort()) {
      const name = source.replace(/\.d2$/, '');
      const svgs = {};
      let size = {};
      for (const theme of ['light', 'dark']) {
        const path = join(rendered, `${name}.${theme}.svg`);
        if (!existsSync(path)) continue;
        const svg = readFileSync(path, 'utf8');
        svgs[theme] = sha256(svg);
        const viewBox = /<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(
          svg,
        );
        if (viewBox) {
          size = {
            width: Math.round(Number(viewBox[1])),
            height: Math.round(Number(viewBox[2])),
          };
        }
      }
      manifest[source] = {
        sha256: sha256(readFileSync(join(sources, source), 'utf8')),
        ...size,
        svgs,
      };
    }
    write(
      root,
      'public/diagrams/manifest.json',
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  function editManifest(root, edit) {
    const path = join(root, 'public/diagrams/manifest.json');
    const manifest = JSON.parse(readFileSync(path, 'utf8'));
    edit(manifest);
    writeFileSync(path, JSON.stringify(manifest, null, 2));
  }

  /** A clean fixture: one case study referencing one diagram, rendered and locked. */
  function repo() {
    const root = tempDir();
    write(root, 'src/index.css', CSS());
    write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE);
    write(root, 'public/diagrams/demo/flow.light.svg', SVG());
    write(root, 'public/diagrams/demo/flow.dark.svg', SVG());
    write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY());
    lock(root);
    const result = () => run('check-diagrams.mjs', [], { CHECK_DIAGRAMS_ROOT: root });
    const check = () => result().status;
    return { root, check, result };
  }

  /** Replace the fixture's SVG and re-lock, so only its content is under test
   * (not the SVG-hash lock). */
  const plantSvg = (path, svg) => (root) => {
    write(root, path, svg);
    lock(root);
  };
  /** Replace the fixture's `.d2` source and re-lock, so only its content is
   * under test (not the staleness check). */
  const plantSource = (source) => (root) => {
    write(root, 'src/system-design/diagrams/demo/flow.d2', source);
    lock(root);
  };

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
  // color. (check-hex-colors.mjs also scans `.d2` files for hex, but it has no
  // root override, so it isn't covered here.)
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
      'a .d2 with style.stroke: blue in a block',
      plantSource(`${SOURCE}api: API {\n  style.stroke: blue\n}\n`),
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
    [
      'a .d2 spreading an import from outside (...@../../outside)',
      plantSource(`${SOURCE}...@../../outside\n`),
    ],
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

  /** Plant a complete, locked diagram (source and both SVGs) at `name`, so only
   * the path rules can fail it. */
  function plantDiagram(root, name) {
    write(root, `src/system-design/diagrams/${name}.d2`, SOURCE);
    write(root, `public/diagrams/${name}.light.svg`, SVG());
    write(root, `public/diagrams/${name}.dark.svg`, SVG());
    lock(root);
  }

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

describe('check-bundle covers case-study bodies (criterion 5)', () => {
  // The script finds the repository from its own location, so each case runs a
  // copy of it inside a throwaway directory with a fake build output.
  const TOPIC_LINE =
    'Topic body sentence that is long enough to be checked by the guard.';
  const CASE_LINE =
    'Case study body sentence that is long enough to be checked by the guard too.';

  function check(assets) {
    const root = tempDir();
    const write = (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    };
    mkdirSync(join(root, 'scripts'));
    copyFileSync(
      join(SCRIPTS, 'check-bundle.mjs'),
      join(root, 'scripts/check-bundle.mjs'),
    );
    write(
      'src/content/alpha/topic.md',
      `---\ntitle: T\nsummary: S.\ndate: 2026-09-28\n---\n\n${TOPIC_LINE}\n`,
    );
    write(
      'src/system-design/case-studies/demo.md',
      `---\ntitle: C\nsummary: S.\ndate: 2026-09-28\norder: 1\n---\n\n${CASE_LINE}\n`,
    );
    for (const [name, text] of Object.entries(assets)) write(`dist/assets/${name}`, text);
    return spawnSync(process.execPath, [join(root, 'scripts/check-bundle.mjs')], {
      encoding: 'utf8',
    }).status;
  }

  it('passes when each body is in its own lazy chunk', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js"); import("./demo-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
        'demo-1.js': `export default ${JSON.stringify(CASE_LINE)};`,
      }),
    ).toBe(0);
  });

  it('fails when a case-study body is inlined in the main chunk', () => {
    expect(
      check({
        'index-abc.js': `const body = ${JSON.stringify(CASE_LINE)}; import("./topic-1.js");`,
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });

  it('fails when a case-study body is in no chunk at all', () => {
    expect(
      check({
        'index-abc.js': 'import("./topic-1.js");',
        'topic-1.js': `export default ${JSON.stringify(TOPIC_LINE)};`,
      }),
    ).toBe(1);
  });
});

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

// Retro: a stylesheet can declare a theme's tokens in more than one block, and
// CSS applies the later declaration. Reading only the first block would check
// (and render diagrams with) colors the site doesn't show.
const LIGHT = {
  'bg-primary': '#faf6f0',
  'bg-secondary': '#f2ebe0',
  'bg-tertiary': '#ece2d3',
  'text-primary': '#2b2420',
  'text-secondary': '#5c5147',
  'text-tertiary': '#6e6356',
  border: '#ddd1bf',
  accent: '#92400e',
  'accent-hover': '#7c3609',
  'accent-soft': '#f3e3c8',
};
const DARK = {
  'bg-primary': '#201a14',
  'bg-secondary': '#2a231b',
  'bg-tertiary': '#342c22',
  'text-primary': '#f2e9dc',
  'text-secondary': '#c9bba6',
  'text-tertiary': '#a39683',
  border: '#3d3428',
  accent: '#f0a83c',
  'accent-hover': '#f7bb5c',
  'accent-soft': '#3d2f16',
};
// The shared token reader the copied scripts import (check-contrast and
// check-design-tokens have no root override, so their tests run copies).
const TOKEN_SCRIPT_DEPS = ['css-tokens.mjs'];

const tokenBlock = (selector, values) =>
  `${selector} {\n${Object.entries(values)
    .map(([name, hex]) => `  --color-${name}: ${hex};`)
    .join('\n')}\n}\n`;
const themeCss = (...extra) =>
  `@import 'tailwindcss';\n\n${tokenBlock(':root', LIGHT)}\n${tokenBlock('.dark', DARK)}\n${extra.join('\n')}`;

// The token parsing itself (later blocks win, comments, value formats,
// unsupported places) is tested once, in css-tokens.test.mjs, against the
// shared reader every script uses. These cases check diagramTokens sits on it.
describe('diagramTokens reads every block for a theme (retro)', () => {
  it('diagramTokens records the later value for both themes', () => {
    const { tokens, problems } = diagramTokens(
      themeCss(
        ':root {\n  --color-text-primary: #111111;\n}\n',
        '.dark {\n  --color-accent-soft: #332211;\n}\n',
      ),
    );
    expect(problems).toEqual([]);
    expect(tokens.light['text-primary']).toBe('#111111');
    expect(tokens.light['bg-primary']).toBe(LIGHT['bg-primary']);
    expect(tokens.dark['accent-soft']).toBe('#332211');
    expect(tokens.dark['text-primary']).toBe(DARK['text-primary']);
  });

  it.each([
    [
      'a token overridden under @media',
      '@media (min-width: 1px) {\n  :root {\n    --color-text-primary: #111111;\n  }\n}\n',
    ],
    [
      'a later block with a non-hex value',
      ':root {\n  --color-text-primary: rgb(0 0 0);\n}\n',
    ],
    [
      'a later block commented out',
      '/*\n:root {\n  --color-text-primary: #111111;\n}\n*/\n',
    ],
  ])('never silently records a value CSS disagrees with: %s', (label, extra) => {
    let result;
    try {
      result = diagramTokens(themeCss(extra));
    } catch (error) {
      // Throwing, naming the token, is one acceptable way to fail loudly.
      expect(String(error)).toMatch(/--color-text-primary/);
      return;
    }
    if (label.includes('commented out')) {
      expect(result.problems).toEqual([]);
      expect(result.tokens.light['text-primary']).toBe(LIGHT['text-primary']);
    } else {
      expect(result.problems.join('\n')).toMatch(/--color-text-primary/);
    }
  });
});

describe('check-contrast reads every block for a theme (retro)', () => {
  // The script finds the repository from its own location (no root override),
  // so each case runs a copy of it inside a throwaway directory with its own
  // src/index.css, like the check-bundle tests. It reads tokens through the
  // shared ./css-tokens.mjs, so that is copied alongside it.
  function check(css) {
    const root = tempDir();
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'src'));
    for (const file of TOKEN_SCRIPT_DEPS) {
      copyFileSync(join(SCRIPTS, file), join(root, 'scripts', file));
    }
    copyFileSync(
      join(SCRIPTS, 'check-contrast.mjs'),
      join(root, 'scripts/check-contrast.mjs'),
    );
    writeFileSync(join(root, 'src/index.css'), css);
    return spawnSync(process.execPath, [join(root, 'scripts/check-contrast.mjs')], {
      encoding: 'utf8',
    });
  }

  it('passes the palette as it is (the copy harness works)', () => {
    expect(check(themeCss()).status).toBe(0);
  });

  it('fails when a later :root block overrides a text token into a failing pair', () => {
    const { status, stderr } = check(
      themeCss(':root {\n  --color-text-primary: #d0d0d0;\n}\n'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/light: text-primary \(#d0d0d0\)/);
  });

  it('fails when a later .dark block overrides a text token into a failing pair', () => {
    const { status, stderr } = check(
      themeCss('.dark {\n  --color-text-primary: #3a3a3a;\n}\n'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/dark: text-primary \(#3a3a3a\)/);
  });

  it('passes when a later :root block fixes a failing value from an earlier one', () => {
    const css = themeCss().replace(
      `--color-text-primary: ${LIGHT['text-primary']};`,
      '--color-text-primary: #d0d0d0;',
    );
    expect(check(css).status).toBe(1);
    expect(
      check(`${css}\n:root {\n  --color-text-primary: ${LIGHT['text-primary']};\n}\n`)
        .status,
    ).toBe(0);
  });
});

describe('check-design-tokens reads every block for a theme, as CSS does (retro)', () => {
  // Like check-contrast it has no root override, so each case runs a copy of
  // it (and the shared token reader) with its own src/index.css and
  // docs/DESIGN.md table.
  const table = (light = LIGHT, dark = DARK) =>
    `# Design\n\n## Tokens\n\n| Token | Light | Dark |\n| --- | --- | --- |\n${Object.keys(
      light,
    )
      .map((name) => `| \`${name}\` | \`${light[name]}\` | \`${dark[name]}\` |`)
      .join('\n')}\n`;
  function check(css, design = table()) {
    const root = tempDir();
    for (const dir of ['scripts', 'src', 'docs']) mkdirSync(join(root, dir));
    for (const file of [...TOKEN_SCRIPT_DEPS, 'check-design-tokens.mjs']) {
      copyFileSync(join(SCRIPTS, file), join(root, 'scripts', file));
    }
    writeFileSync(join(root, 'src/index.css'), css);
    writeFileSync(join(root, 'docs/DESIGN.md'), design);
    return spawnSync(process.execPath, [join(root, 'scripts/check-design-tokens.mjs')], {
      encoding: 'utf8',
    });
  }

  it('passes a matching table (the copy harness works)', () => {
    expect(check(themeCss()).status).toBe(0);
  });

  it('fails when the table has a wrong value (the check still bites)', () => {
    const { status, stderr } = check(themeCss(), table({ ...LIGHT, accent: '#000000' }));
    expect(status).toBe(1);
    expect(stderr).toMatch(/accent/);
  });

  it('fails when a later :root block overrides a token the table documents', () => {
    const { status, stderr } = check(
      themeCss(':root {\n  --color-accent: #7a3000;\n}\n'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/accent[\s\S]*#7a3000/);
  });

  it('fails when a later .dark block overrides a token the table documents', () => {
    const { status, stderr } = check(
      themeCss('.dark {\n  --color-border: #4a4034;\n}\n'),
    );
    expect(status).toBe(1);
    expect(stderr).toMatch(/border[\s\S]*#4a4034/);
  });

  it('passes when a later block and the table agree', () => {
    expect(
      check(
        themeCss(':root {\n  --color-accent: #7a3000;\n}\n'),
        table({ ...LIGHT, accent: '#7a3000' }),
      ).status,
    ).toBe(0);
  });

  it('ignores a :root block inside a comment before the real one', () => {
    const css = themeCss().replace(
      "@import 'tailwindcss';\n",
      "@import 'tailwindcss';\n/* e.g. :root { --color-accent: #000000; } */\n",
    );
    expect(check(css).status).toBe(0);
  });

  it('fails loudly on a token defined under @media', () => {
    const { status } = check(
      themeCss(
        '@media (min-width: 1px) {\n  :root {\n    --color-accent: #7a3000;\n  }\n}\n',
      ),
    );
    expect(status).toBe(1);
  });
});

describe('check-claude-md', () => {
  function root(claude, files = {}) {
    const dir = tempDir();
    writeFileSync(join(dir, 'CLAUDE.md'), claude);
    for (const [path, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), body);
    }
    return dir;
  }
  const check = (dir) => run('check-claude-md.mjs', [], { CHECK_CLAUDE_MD_ROOT: dir });

  it('passes on the repository itself', () => {
    expect(run('check-claude-md.mjs').status).toBe(0);
  });

  it('passes a short file whose links resolve', () => {
    const dir = root(
      '# CLAUDE.md\n\nSee [docs](docs/a.md) and [site](https://example.com).\n',
      {
        'docs/a.md': 'x',
      },
    );
    expect(check(dir).status).toBe(0);
  });

  it('fails when CLAUDE.md passes 150 lines', () => {
    const dir = root(
      Array.from({ length: 151 }, (_, i) => `line ${i}`).join('\n') + '\n',
    );
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/151 lines/);
  });

  it('fails on a relative link to a missing file', () => {
    const dir = root('# CLAUDE.md\n\nSee [gone](docs/missing.md#part).\n');
    const result = check(dir);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/docs\/missing\.md/);
  });
});
