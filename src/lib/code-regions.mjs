// A DSA entry's code lives once, in the tested files beside it
// (src/dsa/code/<slug>/), which mark named regions; the entry names a region
// with an empty ` ```python region=<name> ` fence and the build fills it in
// (docs/dsa.md, "Code pairs and the code files"). vite.config.ts's
// markdownMeta plugin calls `resolveCodeRegions` for every import of an entry,
// so the app and the tests only ever see resolved markdown. Build and test
// time only: JavaScript with its types in code-regions.d.mts, like markdown.mjs.
import { markdownParser, sectionNodes } from './markdown.mjs';

// Every form VS Code folds: `#region`, `# region`, `//#region`, `// region`
// and so on. The marker word must start the comment and end at a word
// boundary, so `x = 1  # region` and `# regional` stay code.
const MARKERS = {
  python: { open: /^\s*#\s*region\b(.*)$/, close: /^\s*#\s*endregion\b.*$/ },
  typescript: {
    open: /^\s*\/\/\s*#?region\b(.*)$/,
    close: /^\s*\/\/\s*#?endregion\b.*$/,
  },
};

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const REGION_META = /^region=(\S*)$/;
const CHUNK_SECTIONS = ['Implementation', 'Walkthrough'];

function splitLines(source) {
  return source.replace(/\r\n?/g, '\n').split('\n');
}

function isBlank(line) {
  return line.trim() === '';
}

/**
 * The file's regions in file order, each with its name, its text (the lines
 * between its markers, outer blank lines dropped) and the 1-based line of its
 * opening marker, plus the 1-based numbers of non-blank lines outside every
 * region. Throws, naming the line, on a nested, unclosed or empty region, an
 * endregion with no open region, a duplicate name, or a missing or
 * non-kebab-case name.
 */
function scan(source, language) {
  const markers = MARKERS[language];
  if (!markers) throw new Error(`unknown code language "${language}"`);
  const regions = [];
  const uncovered = [];
  const seen = new Map();
  let current = null;
  splitLines(source).forEach((line, index) => {
    const at = index + 1;
    const opened = markers.open.exec(line);
    if (opened) {
      const name = opened[1].trim();
      if (current) {
        throw new Error(
          `line ${at}: region "${name}" is nested inside region "${current.name}" (line ${current.line}); regions can't nest`,
        );
      }
      if (!NAME.test(name)) {
        throw new Error(
          `line ${at}: region name ${JSON.stringify(name)} must be lowercase kebab-case, like "lower-bound"`,
        );
      }
      if (seen.has(name)) {
        throw new Error(
          `line ${at}: duplicate region "${name}" (first opened on line ${seen.get(name)})`,
        );
      }
      seen.set(name, at);
      current = { name, line: at, lines: [] };
    } else if (markers.close.test(line)) {
      if (!current) throw new Error(`line ${at}: endregion with no open region`);
      const body = current.lines;
      while (body.length && isBlank(body[0])) body.shift();
      while (body.length && isBlank(body[body.length - 1])) body.pop();
      if (!body.length) {
        throw new Error(
          `line ${current.line}: region "${current.name}" is empty; put the code it shows between its markers`,
        );
      }
      regions.push({ name: current.name, text: body.join('\n'), line: current.line });
      current = null;
    } else if (current) {
      current.lines.push(line);
    } else if (!isBlank(line)) {
      uncovered.push(at);
    }
  });
  if (current) {
    throw new Error(
      `line ${current.line}: region "${current.name}" is never closed (no endregion after it)`,
    );
  }
  return { regions, uncovered };
}

/** The file's regions (`{ name, text, line }`) in file order; see `scan`. */
export function parseRegions(source, language) {
  return scan(source, language).regions;
}

/** Every python/typescript fence in the tree, with whether it sits under a
 * `## Implementation` or `## Walkthrough` heading. */
function codeFences(markdown) {
  const root = markdownParser().parse(markdown);
  const chunkNodes = new Set(CHUNK_SECTIONS.flatMap((h) => sectionNodes(root, h)));
  const found = [];
  const collect = (node, inChunkSection) => {
    if (node.type === 'code' && (node.lang === 'python' || node.lang === 'typescript')) {
      found.push({ node, inChunkSection });
    }
    node.children?.forEach((child) => collect(child, inChunkSection));
  };
  for (const node of root.children) collect(node, chunkNodes.has(node));
  return found;
}

/**
 * `markdown` with each ` ```python region=<name> ` (or typescript) fence
 * replaced by a plain fence holding that region's text, read from
 * `files.python` / `files.typescript`; everything else is unchanged, byte for
 * byte. `files.label` names the entry in errors. Throws on an unknown, reused,
 * unused or out-of-order region, a non-blank code line outside every region, a
 * region fence with a body or with no code file, a malformed code file, and a
 * literal python/typescript fence under Implementation or Walkthrough.
 */
export function resolveCodeRegions(markdown, files) {
  const { label } = files;
  const fail = (message) => {
    throw new Error(`DSA entry ${label}: ${message}`);
  };

  const parsed = {};
  for (const language of ['python', 'typescript']) {
    if (files[language] === undefined) continue;
    try {
      parsed[language] = scan(files[language], language);
    } catch (error) {
      fail(`${language} code file, ${error.message}`);
    }
  }

  const uses = { python: [], typescript: [] };
  const edits = [];
  for (const { node, inChunkSection } of codeFences(markdown)) {
    const language = node.lang;
    const meta = (node.meta ?? '').trim();
    const match = REGION_META.exec(meta);
    if (!match) {
      if (inChunkSection) {
        const first = node.value.split('\n')[0];
        fail(
          `a literal ${language} fence (starting ${JSON.stringify(first)}) under Implementation or Walkthrough; name a region of the code file instead (\`\`\`${language} region=<name>)`,
        );
      }
      continue;
    }
    const name = match[1];
    if (node.value !== '') {
      fail(
        `the ${language} fence for region "${name}" has a body; a region fence must be empty, the build fills it in`,
      );
    }
    const file = parsed[language];
    if (!file)
      fail(
        `${language} region "${name}" is named, but the entry has no ${language} code file`,
      );
    const region = file.regions.find((r) => r.name === name);
    if (!region) {
      fail(
        `${language} region "${name}" isn't in the code file (its regions: ${file.regions.map((r) => r.name).join(', ') || 'none'})`,
      );
    }
    if (uses[language].includes(name)) fail(`${language} region "${name}" is used twice`);
    const previous = uses[language].at(-1);
    if (previous !== undefined) {
      const order = file.regions.map((r) => r.name);
      if (order.indexOf(name) < order.indexOf(previous)) {
        fail(
          `${language} region "${name}" comes after region "${previous}", but the code file has it before; regions must be used in file order`,
        );
      }
    }
    uses[language].push(name);
    edits.push({ node, language, text: region.text });
  }

  for (const [language, file] of Object.entries(parsed)) {
    if (file.uncovered.length) {
      fail(
        `${language} code file, line ${file.uncovered[0]} is outside every region; every non-blank line must be in one`,
      );
    }
    const unused = file.regions.filter((r) => !uses[language].includes(r.name));
    if (unused.length) {
      fail(
        `${language} region "${unused[0].name}" (line ${unused[0].line}) is never used; each region must be named by exactly one fence`,
      );
    }
  }

  let out = markdown;
  for (const { node, language, text } of edits.reverse()) {
    const start = node.position.start.offset;
    const end = node.position.end.offset;
    const lineStart = markdown.lastIndexOf('\n', start - 1) + 1;
    const indent = markdown.slice(lineStart, start);
    if (!/^[ \t]*$/.test(indent)) {
      fail(`the ${language} fence for a region must start its own line`);
    }
    const body =
      text === '' ? [] : text.split('\n').map((l) => (l === '' ? l : indent + l));
    // One more backtick than the longest run starting a line of the code (at
    // least three), so a ``` inside it, in a docstring or a template literal,
    // can't close the fence early.
    const longest = Math.max(
      2,
      ...text.split('\n').map((l) => /^\s*(`*)/.exec(l)[1].length),
    );
    const ticks = '`'.repeat(longest + 1);
    const fence = [ticks + language, ...body, indent + ticks].join('\n');
    out = out.slice(0, start) + fence + out.slice(end);
  }
  return out;
}
