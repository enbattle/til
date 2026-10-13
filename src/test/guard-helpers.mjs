// Shared helpers for the guard scripts' planted-violation tests
// (scripts/check-*.test.mjs). Not a test file itself; it lives under src/test/
// so check:test-lock locks it as test support, like the tests that import it.
//
// Every guard exports a function that takes the root it checks
// (docs/specs/in-process-checks.md), so a planted case builds a throwaway
// git repository here and calls that function in-process; no case spawns
// `node`. Each test file gets its own copy of this module (Vitest isolates
// modules per file), so `temps` is per file; each file registers
// `afterEach(cleanTemps)`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
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

// Vitest runs from the repository root.
export const REPO = resolve('.');
const temps = [];
export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'til-checks-'));
  temps.push(dir);
  return dir;
}
/** Remove every directory `tempDir` made; register with `afterEach`. */
export function cleanTemps() {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
}

// The scripts list their inputs through `git ls-files` (so .gitignore is
// respected), so a throwaway root must be a git repository.
export function gitInit(root) {
  execFileSync('git', ['init', '-q', '--template='], { cwd: root });
}

/** Write `content` to `root/path`, creating its directories. */
export function write(root, path, content) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/** A throwaway git repository holding `files` ({ path: content }). */
export function repoWith(files = {}) {
  const root = tempDir();
  gitInit(root);
  for (const [path, content] of Object.entries(files)) write(root, path, content);
  return root;
}

/** Problem lines with forward slashes, so a Windows path matches too. */
export const slashes = (lines) => lines.map((line) => String(line).split('\\').join('/'));

// --- check-diagrams (scripts/check-diagrams.test.mjs) ---
//
// Interface assumed for scripts/check-diagrams.mjs (docs/specs/
// in-process-checks.md): it exports `diagramProblems(root)`, which checks
// `root` (default: the repository) and returns its problems as strings, each
// naming the file at fault; `[]` when clean. Importing it runs nothing. Under
// `root` it reads:
//     src/system-design/diagrams/<case>/<name>.d2          (sources)
//     public/diagrams/<case>/<name>.light.svg / .dark.svg  (rendered)
//     public/diagrams/manifest.json                        (lock file)
//     src/system-design/case-studies/*.md                  (references)
//     src/index.css                                        (color tokens)
// A case study references a diagram as `/diagrams/<case>/<name>.svg` in a
// markdown image; that reference exists when both themed SVGs exist.
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
// site's current values (all pairs in its TEXT_ON table pass 4.5:1). They are
// fixture data in src/test/diagram-tokens.json (locked like this file) rather
// than a literal here, because check:hex-colors scans `.mjs` under src/ for
// app code using raw colors.
const TOKENS = JSON.parse(readFileSync(resolve('src/test/diagram-tokens.json'), 'utf8'));
const CSS = (tokens = TOKENS) => {
  const block = (selector, values) =>
    `${selector} {\n${Object.entries(values)
      .map(([name, hex]) => `  --color-${name}: ${hex};`)
      .join('\n')}\n}\n`;
  return `@import 'tailwindcss';\n\n${block(':root', tokens.light)}\n${block('.dark', tokens.dark)}`;
};

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
      const viewBox = /<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
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
  write(root, 'public/diagrams/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
}

function editManifest(root, edit) {
  const path = join(root, 'public/diagrams/manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  edit(manifest);
  writeFileSync(path, JSON.stringify(manifest, null, 2));
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

/** A clean fixture (its root): one case study referencing one diagram,
 * rendered and locked. */
function diagramRepo() {
  const root = tempDir();
  gitInit(root);
  write(root, 'src/index.css', CSS());
  write(root, 'src/system-design/diagrams/demo/flow.d2', SOURCE);
  write(root, 'public/diagrams/demo/flow.light.svg', SVG());
  write(root, 'public/diagrams/demo/flow.dark.svg', SVG());
  write(root, 'src/system-design/case-studies/demo.md', CASE_STUDY());
  lock(root);
  return root;
}

/** Plant a complete, locked diagram (source and both SVGs) at `name`, so only
 * the path rules can fail it. */
function plantDiagram(root, name) {
  write(root, `src/system-design/diagrams/${name}.d2`, SOURCE);
  write(root, `public/diagrams/${name}.light.svg`, SVG());
  write(root, `public/diagrams/${name}.dark.svg`, SVG());
  lock(root);
}

export const diagramFixture = {
  SOURCE,
  SVG,
  CASE_STUDY,
  TOKENS,
  CSS,
  write,
  lock,
  editManifest,
  repo: diagramRepo,
  plantSvg,
  plantSource,
  plantDiagram,
};
