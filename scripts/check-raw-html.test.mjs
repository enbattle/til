// @vitest-environment node
// Tests for scripts/check-raw-html.mjs (NON_NEGOTIABLES #6), in its simple
// form (docs/specs/in-process-checks.md, criteria 1, 2 and 7).
//
// Interface assumed: the script exports `rawHtmlProblems(root)` (default: the
// repository), which returns its problems as strings, `[]` when clean.
// Importing it runs nothing. It flags:
//
// - `rehype-raw`, `rehype-dom-raw`, `markdown-to-jsx`, `html-react-parser` or
//   `hast-util-raw` in package.json's `dependencies` or `devDependencies`,
//   naming the package;
// - in every non-test `.js/.jsx/.mjs/.cjs/.ts/.tsx/.mts/.cts` file under src/
//   (except src/dsa/code/ and src/test/, never shipped to the browser), any
//   sink name below (and `parseFromString`) as a case-insensitive substring,
//   or the whole word `write`/`writeln` (case-sensitive), in code, a comment
//   or a string alike (it fails closed), naming the file.
//   `dangerouslySetInnerHTML` is allowed only in src/components/CodeBlock.tsx.
//
// The JSX prop is also an error from oxlint's `react/no-danger` rule, which
// .oxlintrc.json turns on (CodeBlock.tsx disables it on its one line).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanTemps,
  repoWith,
  slashes,
  tempDir,
  write,
} from '../src/test/guard-helpers.mjs';
import { rawHtmlProblems } from './check-raw-html.mjs';

afterEach(cleanTemps);

const BAD = 'src/components/Bad.tsx';
const CODEBLOCK = 'src/components/CodeBlock.tsx';
const CODEBLOCK_SOURCE =
  'export const C = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;\n';

/** The problems for a throwaway repository holding `files` and a package.json
 * (`pkg`, default: no dependencies). */
function problems(files = {}, pkg = { dependencies: {}, devDependencies: {} }) {
  return slashes(
    rawHtmlProblems(repoWith({ 'package.json': JSON.stringify(pkg), ...files })),
  );
}

const SINKS = [
  'dangerouslySetInnerHTML',
  'innerHTML',
  'outerHTML',
  'srcdoc',
  'insertAdjacentHTML',
  'setHTMLUnsafe',
  'parseHTMLUnsafe',
  'createContextualFragment',
  'document.write',
];
const CASES = (name) => [name, name.toLowerCase(), name.toUpperCase()];

describe('check-raw-html', () => {
  it('passes clean code and the allowed CodeBlock usage', () => {
    expect(
      problems({
        [CODEBLOCK]: CODEBLOCK_SOURCE,
        'src/components/Ok.tsx': 'export const ok = (el) => el.textContent;\n',
      }),
    ).toEqual([]);
  });

  describe('each sink name, in any letter case, in a non-test app file', () => {
    it.each(
      SINKS.flatMap((sink) => [...new Set(CASES(sink))].map((name) => [name, sink])),
    )('fails on %s, naming the file', (name) => {
      const found = problems({ [BAD]: `export const f = (el, s) => el.${name}(s);\n` });
      expect(found).not.toEqual([]);
      expect(found.join('\n')).toContain(BAD);
    });
  });

  it.each([
    ['a comment', '// never set innerHTML here\nexport const a = 1;\n'],
    ['a string', "export const name = 'outerHTML';\n"],
    ['a JSX srcDoc prop', 'export const F = ({ s }) => <iframe srcDoc={s} />;\n'],
    ['an assignment', 'export const f = (el, s) => {\n  el.innerHTML = s;\n};\n'],
  ])('fails on a sink name in %s (fails closed)', (_label, source) => {
    expect(problems({ [BAD]: source }).join('\n')).toContain(BAD);
  });

  it.each(['.js', '.jsx', '.mjs', '.ts', '.tsx'])('scans %s files under src/', (ext) => {
    const path = `src/lib/x${ext}`;
    expect(problems({ [path]: 'el.innerHTML = s;\n' }).join('\n')).toContain(path);
  });

  it('allows dangerouslySetInnerHTML in CodeBlock.tsx only', () => {
    expect(problems({ [CODEBLOCK]: CODEBLOCK_SOURCE })).toEqual([]);
    expect(
      problems({ 'src/components/Other.tsx': CODEBLOCK_SOURCE }).join('\n'),
    ).toContain('src/components/Other.tsx');
  });

  it('fails on innerHTML in CodeBlock.tsx', () => {
    const found = problems({
      [CODEBLOCK]: `${CODEBLOCK_SOURCE}export const f = (el, s) => {\n  el.innerHTML = s;\n};\n`,
    });
    expect(found.join('\n')).toContain(CODEBLOCK);
  });

  it.each(['src/components/Bad.test.tsx', 'src/lib/x.test.ts', 'src/lib/x.spec.mjs'])(
    'ignores a test file (%s)',
    (path) => {
      expect(problems({ [path]: 'el.innerHTML = s; document.write(s);\n' })).toEqual([]);
    },
  );

  it('ignores files outside src/', () => {
    expect(problems({ 'scripts/x.mjs': 'el.innerHTML = s;\n' })).toEqual([]);
  });

  it.each([
    ['rehype-raw', 'dependencies'],
    ['rehype-raw', 'devDependencies'],
    ['rehype-dom-raw', 'dependencies'],
    ['rehype-dom-raw', 'devDependencies'],
  ])('fails on %s in %s, naming it', (name, field) => {
    const found = problems(
      {},
      { dependencies: {}, devDependencies: {}, [field]: { [name]: '^7' } },
    );
    expect(found.some((problem) => problem.includes(name))).toBe(true);
  });

  // Review finding 1: `write`/`writeln` as a whole word, case-sensitive, fails
  // closed, since `document.write` can be reached without spelling
  // `document.write` (optional chaining, destructuring, an alias).
  it.each([
    'iframe.contentDocument?.write(html)',
    'iframe.contentDocument!.write(html)',
    'el.ownerDocument?.write(html)',
    'const { write } = document; write.call(document, h)',
    'const doc = iframe.contentDocument; doc?.write(h)',
    'document?.write(h)',
    '(document as Document).write(h)',
    'document . writeln(h)',
  ])('fails on the word write/writeln: %s', (code) => {
    expect(problems({ [BAD]: `${code};\n` }).join('\n')).toContain(BAD);
  });

  // Review finding L1 (fix round 2): a sink name spelled with JavaScript
  // escape sequences (\uXXXX, \u{...}, \xXX) is the same name to the engine,
  // so it fails too. The fixtures hold the literal backslash sequences.
  it.each([
    'el.inner\\u0048TML = s',
    "el['inner\\x48TML'] = s",
    'document.wr\\u0069te(s)',
    'el.inner\\u{48}TML = s',
  ])('fails on a sink name spelled with escape sequences: %s', (code) => {
    expect(
      problems({ [BAD]: `export const f = (el, s) => ${code};\n` }).join('\n'),
    ).toContain(BAD);
  });

  it.each([
    ['writeText', 'export const copy = (s) => navigator.clipboard.writeText(s);\n'],
    ['a capitalized Write in a comment', '// Write the header\nexport const a = 1;\n'],
  ])('passes %s (whole word, case-sensitive)', (_label, source) => {
    expect(problems({ [BAD]: source })).toEqual([]);
  });

  it.each(['parseFromString', 'parsefromstring', 'PARSEFROMSTRING'])(
    'fails on %s (DOMParser), in any letter case',
    (name) => {
      const source = `export const f = (h) => new DOMParser().${name}(h, 'text/html');\n`;
      expect(problems({ [BAD]: source }).join('\n')).toContain(BAD);
    },
  );

  it.each(['.mts', '.cts', '.cjs'])('scans %s files under src/', (ext) => {
    const path = `src/lib/x${ext}`;
    expect(problems({ [path]: 'el.innerHTML = s;\n' }).join('\n')).toContain(path);
  });

  describe('code never shipped to the browser', () => {
    it.each([
      ['src/dsa/code/heap/heap.ts', 'el.innerHTML = s;\n'],
      ['src/dsa/code/heap/heap.ts', 'out.write(s);\n'],
      ['src/test/helpers.mjs', 'el.innerHTML = s;\n'],
      ['src/test/helpers.ts', 'stream.write(s);\n'],
    ])('ignores %s', (path, source) => {
      expect(problems({ [path]: source })).toEqual([]);
    });

    it.each(['el.innerHTML = s;\n', 'out.write(s);\n'])(
      'still fails the same code in src/lib/ (%s)',
      (source) => {
        expect(problems({ 'src/lib/x.ts': source }).join('\n')).toContain('src/lib/x.ts');
      },
    );
  });

  it.each([
    ['markdown-to-jsx', 'dependencies'],
    ['markdown-to-jsx', 'devDependencies'],
    ['html-react-parser', 'dependencies'],
    ['html-react-parser', 'devDependencies'],
    ['hast-util-raw', 'dependencies'],
    ['hast-util-raw', 'devDependencies'],
  ])('fails on %s in %s, naming it', (name, field) => {
    const found = problems(
      {},
      { dependencies: {}, devDependencies: {}, [field]: { [name]: '^1' } },
    );
    expect(found.some((problem) => problem.includes(name))).toBe(true);
  });

  // Unchanged rules, so a fix to one can't quietly break another.
  it('passes a package.json with unrelated dependencies', () => {
    expect(
      problems(
        {},
        {
          dependencies: { 'react-markdown': '^9', 'rehype-slug': '^6' },
          devDependencies: { vitest: '^3' },
        },
      ),
    ).toEqual([]);
  });

  it('ignores a test file in src/dsa/code/ and src/lib/ alike', () => {
    expect(
      problems({
        'src/dsa/code/heap/heap.test.ts': 'out.write(s); el.innerHTML = s;\n',
        'src/lib/x.test.mts': 'out.write(s); el.innerHTML = s;\n',
      }),
    ).toEqual([]);
  });

  it('ignores non-code files under src/', () => {
    expect(
      problems({
        'src/content/x.md': 'Set innerHTML, then write the file.\n',
        'src/index.css': '/* innerHTML write */\n',
      }),
    ).toEqual([]);
  });

  it('returns no problems for the real repository', () => {
    expect(slashes(rawHtmlProblems(resolve('.')))).toEqual([]);
    expect(slashes(rawHtmlProblems())).toEqual([]);
  });

  // Criterion 2: the one run as a script.
  it('exits 0 with its success message on the real repository, run as a script', () => {
    const result = spawnSync(process.execPath, [resolve('scripts/check-raw-html.mjs')], {
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/No raw HTML/);
  });
});

describe('the react/no-danger lint rule (criterion 7)', () => {
  it('errors on a JSX dangerouslySetInnerHTML outside CodeBlock.tsx', () => {
    const dir = tempDir();
    write(dir, 'Bad.tsx', CODEBLOCK_SOURCE.replace('C =', 'Bad ='));
    const result = spawnSync(
      process.execPath,
      [
        resolve('node_modules/oxlint/bin/oxlint'),
        '-c',
        resolve('.oxlintrc.json'),
        join(dir, 'Bad.tsx'),
      ],
      { encoding: 'utf8' },
    );
    expect(result.status, `${result.stdout}${result.stderr}`).not.toBe(0);
    expect(`${result.stdout}${result.stderr}`).toMatch(/no-danger/);
  });

  it('is turned on as an error in .oxlintrc.json', () => {
    const { rules } = JSON.parse(readFileSync(resolve('.oxlintrc.json'), 'utf8'));
    expect([rules['react/no-danger']].flat()[0]).toBe('error');
  });

  it('is the only lint disable for it, in CodeBlock.tsx', () => {
    const source = readFileSync(resolve(CODEBLOCK), 'utf8');
    expect(source.match(/oxlint-disable-next-line react\/no-danger/g)).toHaveLength(1);
  });
});

it('oxc-parser is not a dependency', () => {
  const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
  expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain(
    'oxc-parser',
  );
});
