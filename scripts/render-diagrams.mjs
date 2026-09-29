#!/usr/bin/env node
// Renders every D2 diagram source to a light and a dark SVG, colored from the
// site's own design tokens (docs/specs/system-design-case-studies.md). Run it
// after adding or editing a source, or after changing a `--color-*` token the
// diagrams use: `npm run diagrams`.
//
//   src/system-design/diagrams/<case>/<name>.d2
//     -> public/diagrams/<case>/<name>.light.svg
//     -> public/diagrams/<case>/<name>.dark.svg
//     -> an entry in public/diagrams/manifest.json (source hash, size, SVG hashes)
//   src/index.css tokens -> manifest `$tokens`
//
// Colors: the `--color-*` tokens are read from src/index.css (the `:root` block
// for light, `.dark` for dark) and passed to d2 as theme overrides, so a palette
// change there reaches the diagrams on the next render and no `.d2` file ever
// names a color. Before rendering it refuses a source that names a color or imports another
// file, and checks that the text colors d2 uses are readable (WCAG AA, 4.5:1) on every
// fill they can sit on, in both themes. Those checks, the token mapping and the
// manifest format live in scripts/diagram-manifest.mjs, which
// `npm run check:diagrams` shares so CI enforces the same rules without d2.
//
// Needs d2 v0.9.x on PATH. CI doesn't have it: the SVGs and the manifest are
// committed, and `npm run check:diagrams` (no d2 needed) proves they match the
// sources and tokens. Output is deterministic for a given d2 version and input,
// so re-rendering unchanged sources produces no diff.
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  contrastProblems,
  d2SourceProblem,
  diagramTokens,
  sourceHash,
  sourcePathProblem,
  themeSlots,
  TOKENS_KEY,
} from './diagram-manifest.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SOURCES = join(ROOT, 'src', 'system-design', 'diagrams');
const RENDERED = join(ROOT, 'public', 'diagrams');
const MANIFEST = join(RENDERED, 'manifest.json');
const CSS = join(ROOT, 'src', 'index.css');
const D2_VERSION = /^v?0\.9\.\d+/;

const INSTALL = `Install d2 v0.9.x and make sure \`d2\` is on PATH:
  Windows: scoop install d2
  macOS:   brew install d2
  Linux:   curl -fsSL https://d2lang.com/install.sh | sh -s -- --version v0.9.0
  Any OS:  go install oss.terrastruct.com/d2@v0.9.0
Then run \`npm run diagrams\` again.`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

// --- d2 itself ---------------------------------------------------------------

const version = spawnSync('d2', ['--version'], { encoding: 'utf8', shell: false });
if (version.error || version.status !== 0) {
  fail(`\`d2\` was not found on PATH.\n\n${INSTALL}`);
}
if (!D2_VERSION.test(version.stdout.trim())) {
  fail(
    `Found d2 ${version.stdout.trim()}, but the committed diagrams are rendered with v0.9.x (a different version lays out and styles them differently).\n\n${INSTALL}`,
  );
}

// --- theme from the design tokens --------------------------------------------

let read;
try {
  read = diagramTokens(readFileSync(CSS, 'utf8'));
} catch (error) {
  fail(`src/index.css: ${error.message}`);
}
const { tokens, problems } = read;
const tokenProblems = [...problems, ...contrastProblems(tokens)];
if (tokenProblems.length > 0) fail(tokenProblems.join('\n'));
const THEMES = { light: themeSlots(tokens.light), dark: themeSlots(tokens.dark) };

/** The `vars` block prepended to every source: the overrides plus the render
 * settings every diagram shares. A source may add its own `vars.d2-config`
 * (e.g. `layout-engine: elk`); D2 merges the two maps. */
function preamble(theme) {
  const overrides = Object.entries(theme)
    .map(([slot, hex]) => `      ${slot}: "${hex}"`)
    .join('\n');
  return `vars: {\n  d2-config: {\n    theme-id: 0\n    pad: 24\n    theme-overrides: {\n${overrides}\n    }\n  }\n}\n`;
}

// --- sources -------------------------------------------------------------------

function list(dir, suffix, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) list(path, suffix, files);
    else if (entry.endsWith(suffix)) files.push(path);
  }
  return files;
}

const manifest = { [TOKENS_KEY]: tokens };
const expected = new Set();
const sources = list(SOURCES, '.d2').sort();
if (sources.length === 0)
  console.warn('No .d2 sources under src/system-design/diagrams/.');

for (const file of sources) {
  const source = relative(SOURCES, file).split('\\').join('/');
  const pathProblem = sourcePathProblem(source);
  if (pathProblem) fail(`src/system-design/diagrams/${source}: ${pathProblem}`);
  const text = readFileSync(file, 'utf8');
  const problem = d2SourceProblem(text);
  if (problem) fail(`${source}: ${problem}.`);
  const name = source.replace(/\.d2$/, '');
  let size;
  const svgs = {};
  for (const [themeName, theme] of Object.entries(THEMES)) {
    const out = join(RENDERED, `${name}.${themeName}.svg`);
    mkdirSync(dirname(out), { recursive: true });
    const result = spawnSync('d2', ['-', out], {
      input: `${preamble(theme)}\n${text.replace(/\r\n/g, '\n')}`,
      encoding: 'utf8',
    });
    if (result.status !== 0) {
      fail(`${source} (${themeName}): d2 failed\n${result.stderr || result.stdout}`);
    }
    expected.add(out);
    // d2 draws group frames (e.g. a sequence diagram's "Cache miss" box) at 50%
    // opacity with `mix-blend-mode: multiply`, which is meant for a white
    // canvas: on the dark theme's charcoal it turns the frame nearly black.
    // Plain 50% opacity gives the same tint on the light canvas and a readable
    // one on the dark canvas.
    const svg = readFileSync(out, 'utf8').replace(/mix-blend-mode:\s*multiply;\s*/g, '');
    writeFileSync(out, svg);
    svgs[themeName] = sourceHash(svg);
    const viewBox = /<svg[^>]*\bviewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(svg);
    if (!viewBox) fail(`${out}: no viewBox on the root <svg>`);
    size = {
      width: Math.round(Number(viewBox[1])),
      height: Math.round(Number(viewBox[2])),
    };
  }
  manifest[source] = { sha256: sourceHash(text), ...size, svgs };
  console.log(`rendered ${source} (${size.width}x${size.height})`);
}

// Remove SVGs whose source is gone, so check:diagrams doesn't flag orphans.
for (const svg of list(RENDERED, '.svg')) {
  if (!expected.has(svg)) {
    rmSync(svg);
    console.log(`removed orphan ${relative(ROOT, svg).split('\\').join('/')}`);
  }
}

mkdirSync(RENDERED, { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`wrote public/diagrams/manifest.json (${sources.length} diagrams)`);
