#!/usr/bin/env node
// Guardrail for the build-time D2 diagrams (docs/specs/system-design-case-studies.md).
// `npm run diagrams` (scripts/render-diagrams.mjs) needs the d2 binary, which CI
// doesn't have, so the rendered SVGs are committed. This proves they're current
// and safe without d2. It fails when:
//
// - a `.d2` source has no manifest entry, or its hash differs from the one
//   recorded at render time (it was edited without re-rendering), or the
//   manifest lists a source that no longer exists;
// - a `.d2` source isn't at `<case-slug>/<name>.d2` (lowercase kebab-case,
//   one folder deep), the rule render-diagrams.mjs renders by (SOURCE_PATH);
// - a `.d2` source names a color by any syntax (`style.fill`, a `style: {...}`
//   map, a connection's `style.stroke`, a theme override, a hex color used as a
//   value): diagram colors come only from the design tokens. A `#` inside a
//   longer label ("Issue #123") or a comment is not a color;
// - a `.d2` source imports another file (`...@x`, `x: @y`), which would escape
//   the source hash and the color guard;
// - a source's `.light.svg` or `.dark.svg` is missing, an SVG under
//   public/diagrams/ has no source (an orphan), any other file sits there
//   (only manifest.json and `<case>/<name>.light.svg`/`.dark.svg` may), an
//   entry has no `svgs` hashes,
//   or an SVG's bytes no longer match its recorded hash (edited by hand);
// - a manifest entry's recorded width is above 960 px (MAX_WIDTH);
// - the manifest has no `$tokens`, or the `--color-*` tokens the diagrams use
//   differ from src/index.css (a palette change without a re-render), or those
//   tokens put diagram text below WCAG AA (4.5:1) on any fill it can sit on;
// - an SVG uses anything outside a small element and attribute allowlist
//   derived from what d2 v0.9 emits (no <script>, <foreignObject>, <a>,
//   <image>, <iframe>, animation elements, event handlers; no backslash, quote
//   or character reference in an attribute value, no href that isn't a
//   #fragment and no function but url(#fragment); `style` attributes only set
//   a few numeric or keyword properties; in <style>, no at-rule, string or
//   function outside d2's @font-face with an embedded data: font). See
//   svgProblems in scripts/diagram-manifest.mjs. The site shows diagrams
//   through `<img>`, which wouldn't run script anyway, but the "open full size"
//   link opens the SVG as a document, where it would;
// - a case study references `/diagrams/<case>/<name>.svg` in a markdown image
//   (inline or reference-style, found by parsing with the site's own markdown
//   stack, so code doesn't count) and either themed file is missing.
//
// The manifest format is documented in scripts/diagram-manifest.mjs, which
// this shares with render-diagrams.mjs. Set CHECK_DIAGRAMS_ROOT to check
// another directory (the planted-violation tests in check-diagrams*.test.mjs do).
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  contrastProblems,
  d2SourceProblem,
  diagramTokens,
  sourceHash,
  sourcePathProblem,
  svgProblems,
  TOKENS_KEY,
} from './diagram-manifest.mjs';
import { diagramName, diagramReferences } from '../src/lib/markdown.mjs';
import { listFiles, ROOT as REPO_ROOT } from './lib.mjs';

const ROOT = process.env.CHECK_DIAGRAMS_ROOT ?? REPO_ROOT;
const SOURCES = join(ROOT, 'src', 'system-design', 'diagrams');
const RENDERED = join(ROOT, 'public', 'diagrams');
const MANIFEST = join(RENDERED, 'manifest.json');
const CASE_STUDIES = join(ROOT, 'src', 'system-design', 'case-studies');
const CSS = join(ROOT, 'src', 'index.css');
const THEMES = ['light', 'dark'];
const RERENDER = 'run `npm run diagrams`';
// The widest a diagram may render: the column is ~720 px and a diagram is
// never scaled below 0.75 (add-case-study checklist item 4).
const MAX_WIDTH = 960;

/** Every file under `dir` (recursively) whose name ends with `suffix`, as a
 * forward-slash path relative to `dir`. */
function list(dir, suffix) {
  return listFiles({ root: ROOT, under: relative(ROOT, dir), ext: suffix }).map((path) =>
    relative(dir, path).split('\\').join('/'),
  );
}

const violations = [];
const sources = list(SOURCES, '.d2');

let manifest = {};
if (existsSync(MANIFEST)) {
  try {
    manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  } catch (error) {
    violations.push(`public/diagrams/manifest.json: not valid JSON (${error.message})`);
  }
} else if (sources.length > 0) {
  violations.push(`public/diagrams/manifest.json: missing; ${RERENDER}`);
}

// --- tokens: what the SVGs were rendered with vs src/index.css now ------------

if (sources.length > 0) {
  const css = existsSync(CSS) ? readFileSync(CSS, 'utf8') : '';
  let tokens = { light: {}, dark: {} };
  try {
    const read = diagramTokens(css);
    tokens = read.tokens;
    violations.push(...read.problems);
    violations.push(...contrastProblems(tokens));
  } catch (error) {
    violations.push(`src/index.css: ${error.message}`);
  }
  const recorded = manifest[TOKENS_KEY];
  if (!recorded || typeof recorded !== 'object') {
    violations.push(
      `public/diagrams/manifest.json: no ${TOKENS_KEY} (the color tokens the SVGs were rendered with); ${RERENDER}`,
    );
  } else {
    for (const theme of THEMES) {
      const names = new Set([
        ...Object.keys(tokens[theme]),
        ...Object.keys(recorded[theme] ?? {}),
      ]);
      for (const name of names) {
        const now = tokens[theme][name];
        const then = recorded[theme]?.[name];
        if (now !== then) {
          violations.push(
            `src/index.css: --color-${name} (${theme}) is ${now ?? 'missing'}, but the diagrams were rendered with ${then ?? 'no value'}; ${RERENDER}`,
          );
        }
      }
    }
  }
}

// --- sources and their SVGs -----------------------------------------------------

for (const source of sources) {
  const name = source.replace(/\.d2$/, '');
  const entry = manifest[source];
  const text = readFileSync(join(SOURCES, source), 'utf8');
  const pathProblem = sourcePathProblem(source);
  if (pathProblem) {
    violations.push(`src/system-design/diagrams/${source}: ${pathProblem}`);
  }
  const problem = d2SourceProblem(text);
  if (problem) {
    violations.push(`src/system-design/diagrams/${source}: ${problem}.`);
  }
  if (!entry) {
    violations.push(`${source}: no manifest entry; ${RERENDER}`);
  } else {
    if (entry.sha256 !== sourceHash(text)) {
      violations.push(`${source}: changed since it was last rendered; ${RERENDER}`);
    }
    if (typeof entry.width === 'number' && entry.width > MAX_WIDTH) {
      violations.push(
        `${source}: ${entry.width} px wide, above the ${MAX_WIDTH} px limit (it would scale below 0.75 in the ~720 px column; aim for ~950); re-lay it out and ${RERENDER}`,
      );
    }
    if (!entry.svgs || typeof entry.svgs !== 'object') {
      violations.push(
        `public/diagrams/manifest.json: ${source} has no svgs hashes; ${RERENDER}`,
      );
    }
  }
  for (const theme of THEMES) {
    const file = `public/diagrams/${name}.${theme}.svg`;
    const path = join(RENDERED, `${name}.${theme}.svg`);
    if (!existsSync(path)) {
      violations.push(`${file}: missing`);
    } else if (
      entry?.svgs &&
      entry.svgs[theme] !== sourceHash(readFileSync(path, 'utf8'))
    ) {
      violations.push(
        `${file}: doesn't match the hash recorded when it was rendered (edited by hand?); ${RERENDER}`,
      );
    }
  }
}
for (const source of Object.keys(manifest)) {
  if (source !== TOKENS_KEY && !sources.includes(source)) {
    violations.push(
      `public/diagrams/manifest.json: lists ${source}, which has no source file`,
    );
  }
}

// Everything under public/diagrams/ is either the root manifest.json or a
// `<case>/<name>.light.svg` / `.dark.svg` named like a valid source. Any other
// file (a stray note, an .html page, an uppercase .SVG, an SVG nested deeper)
// would be published with the site, so it fails too.
for (const file of list(RENDERED, '')) {
  if (file === 'manifest.json') continue;
  const match = /^(.+)\.(light|dark)\.svg$/.exec(file);
  const source = match && `${match[1]}.d2`;
  if (!source || sourcePathProblem(source)) {
    violations.push(
      `public/diagrams/${file}: unexpected file; public/diagrams/ holds only manifest.json and <case>/<name>.light.svg / .dark.svg`,
    );
    continue;
  }
  if (!sources.includes(source)) {
    violations.push(
      `public/diagrams/${file}: no matching source in src/system-design/diagrams/ (orphan)`,
    );
  }
  for (const problem of svgProblems(readFileSync(join(RENDERED, file), 'utf8'))) {
    violations.push(`public/diagrams/${file}: ${problem}`);
  }
}

// --- references from the case studies --------------------------------------------

// Parsed with the site's own markdown stack (src/lib/markdown.mjs, shared
// with MarkdownRenderer), so a reference counts exactly when it would render as
// a diagram: an image, or a reference-style image with a matching definition,
// whose URL is a /diagrams/ path. An example inside code doesn't count.
for (const file of list(CASE_STUDIES, '.md')) {
  const markdown = readFileSync(join(CASE_STUDIES, file), 'utf8');
  for (const src of new Set(diagramReferences(markdown))) {
    const name = diagramName(src);
    for (const theme of THEMES) {
      if (!existsSync(join(RENDERED, `${name}.${theme}.svg`))) {
        violations.push(
          `src/system-design/case-studies/${file}: references ${src}, but public/diagrams/${name}.${theme}.svg doesn't exist`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Diagrams are stale, missing or unsafe:\n');
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    '\nEdit sources under src/system-design/diagrams/ (or the tokens in src/index.css), then run `npm run diagrams` (needs d2 v0.9.x) and commit the sources, the SVGs and public/diagrams/manifest.json together.',
  );
  process.exit(1);
}
console.log(
  `All ${sources.length} diagrams are rendered, current and safe, their tokens match src/index.css with readable text, and every case-study reference resolves.`,
);
