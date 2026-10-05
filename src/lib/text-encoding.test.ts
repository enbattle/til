import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Fails on UTF-8 text that was decoded as Windows-1252 and written back as
 * UTF-8 ("mojibake"), so `÷` shows as A-tilde plus a middle dot, `≈` as
 * a-circumflex plus a per-mille sign and a caret, and `—` as a-circumflex plus
 * a euro sign and a closing quote.
 * Windows PowerShell 5.1's `Get-Content` reads a BOM-less UTF-8 file this way,
 * and a round trip through `Set-Content` shipped it once
 * (docs/pipeline-log.md, the ride-sharing row). The markers are written as
 * escapes so this file doesn't match itself.
 */
// A UTF-8 continuation byte (0x80-0xBF) as Windows-1252 shows it: Latin-1 for
// most, and these letters and marks for 0x80-0x9F.
const CONTINUATION =
  '[\u0080-\u00BF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC' +
  '\u2013\u2014\u2018-\u201E\u2020-\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]';
// The lead byte of a multi-byte character as Windows-1252 shows it: Â, Ã
// (Latin-1 symbols), Ä, Å (Latin Extended), Î, Ï (Greek, e.g. μ), Ð, Ñ
// (Cyrillic), â (punctuation, arrows, math) and ð (emoji), each followed by a
// continuation byte. U+FFFD is what invalid UTF-8 (a file saved in the ANSI code
// page) decodes to.
const MOJIBAKE = new RegExp(
  `[\u00C2-\u00C5\u00CE\u00CF\u00D0\u00D1\u00E2\u00F0]${CONTINUATION}|\uFFFD`,
);

const ROOT = process.cwd();
const TEXT = /\.(md|mdx|ts|tsx|mts|mjs|js|json|d2|css|html|ya?ml|py|txt|toml|ini)$/;

/** Every git-tracked text file, plus untracked ones git doesn't ignore, so a
 * new file is checked before its first commit. `public/` is skipped: its SVGs
 * are generated, and `check:diagrams` hash-checks them against their `.d2`. */
function textFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard'],
    {
      cwd: ROOT,
      encoding: 'utf8',
    },
  );
  return out
    .split(/\r?\n/)
    .filter((p) => TEXT.test(p) && !p.startsWith('public/'))
    .map((p) => join(ROOT, p));
}

/** Line numbers (1-based) in `text` that contain double-encoded UTF-8. */
export function mojibakeLines(text: string): number[] {
  return text.split('\n').flatMap((line, i) => (MOJIBAKE.test(line) ? [i + 1] : []));
}

describe('text encoding', () => {
  it('detects double-encoded symbols and passes clean text', () => {
    expect(mojibakeLines('10 \u00C3\u2014 20 \u00C3\u00B7 2')).toEqual([1]); // \u00D7 \u00F7
    expect(mojibakeLines('ok\n\u00E2\u2030\u02C6 5')).toEqual([2]); // \u2248
    expect(mojibakeLines('a \u00E2\u20AC\u201D b')).toEqual([1]); // \u2014
    expect(mojibakeLines('\u00C2\u00A3 5')).toEqual([1]); // \u00A3
    expect(mojibakeLines('5 \u00CE\u00BCs')).toEqual([1]); // μs
    expect(mojibakeLines('saved as ANSI \uFFFD')).toEqual([1]);
    expect(
      mojibakeLines(
        '10 × 20 ÷ 2 ≈ 100 — £5 → 60° km² café naïve μs λ Zürich São Paulo 🙂',
      ),
    ).toEqual([]);
  });

  it('no tracked text file contains double-encoded UTF-8', () => {
    const files = textFiles().filter((p) => existsSync(p));
    expect(files.length).toBeGreaterThan(50);
    const bad = files.flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      const lines = mojibakeLines(text);
      return lines.length ? [`${relative(ROOT, path)}: lines ${lines.join(', ')}`] : [];
    });
    expect(bad).toEqual([]);
  });
});
