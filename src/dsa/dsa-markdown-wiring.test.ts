import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RAW_CASE_STUDIES, RAW_DSA_ENTRIES, RAW_TOPICS } from '@/test/content';
import { parseFrontmatter } from '@/lib/frontmatter';
import { dsaPrerequisites, proseWordCount } from '@/lib/markdown.mjs';

// docs/specs/dsa-code-regions.md, criterion 4. vite.config.ts's markdownMeta
// plugin resolves a DSA entry's region fences (` ```python region=<name> `)
// from its code files before serving the entry `?raw` or any of its views;
// Vitest reuses the plugin, so these imports see what the app sees. Other
// markdown is served as it is on disk. This file doesn't import
// src/lib/code-regions.mjs, so each test fails for its own reason.

const ROOT = process.cwd();

/** The file at a glob key (`/src/...`) as it is on disk. */
function onDisk(key: string): string {
  return readFileSync(path.join(ROOT, key), 'utf8');
}

const DSA_WORDS = import.meta.glob<number>('/src/dsa/entries/*.md', {
  query: '?words',
  import: 'default',
  eager: true,
});

const DSA_PREREQS = import.meta.glob<string[]>('/src/dsa/entries/*.md', {
  query: '?dsaPrereqs',
  import: 'default',
  eager: true,
});

const DSA_META = import.meta.glob<Record<string, string>>('/src/dsa/entries/*.md', {
  query: '?meta',
  import: 'default',
  eager: true,
});

const ENTRY_KEYS = Object.keys(RAW_DSA_ENTRIES);

function codeFiles(key: string): string[] {
  const slug = key.replace(/^.*\/([^/]+)\.md$/, '$1');
  return [
    `/src/dsa/code/${slug}/${slug.replaceAll('-', '_')}.py`,
    `/src/dsa/code/${slug}/${slug}.ts`,
  ];
}

/** The longest non-blank, non-marker line of a code file: a line its entry must show. */
function telltaleLine(code: string): string {
  return code
    .split('\n')
    .filter((line) => line.trim() !== '' && !/^\s*(#|\/\/ #)\s?(end)?region\b/.test(line))
    .reduce((a, b) => (b.trim().length > a.trim().length ? b : a), '');
}

describe('a DSA entry imported ?raw is resolved (regions criterion 4)', () => {
  it('finds every entry', () => {
    expect(ENTRY_KEYS.length).toBeGreaterThanOrEqual(28);
  });

  it.each(ENTRY_KEYS)('%s has region fences on disk and none once imported', (key) => {
    expect(onDisk(key)).toMatch(/^```(python|typescript) region=[a-z0-9-]+$/m);
    expect(RAW_DSA_ENTRIES[key]).not.toMatch(/region=/);
  });

  it.each(ENTRY_KEYS)('%s shows code from both of its code files', (key) => {
    for (const file of codeFiles(key)) {
      const line = telltaleLine(onDisk(file));
      expect(line, `${file} has no code`).not.toBe('');
      expect(RAW_DSA_ENTRIES[key], `${key} lacks ${JSON.stringify(line)}`).toContain(
        line,
      );
    }
  });

  it.each(ENTRY_KEYS)('%s keeps its frontmatter and prose', (key) => {
    const disk = parseFrontmatter(onDisk(key));
    const served = parseFrontmatter(RAW_DSA_ENTRIES[key]);
    expect(served.data).toEqual(disk.data);
    expect(proseWordCount(served.content)).toBe(proseWordCount(disk.content));
  });
});

describe('the views of a DSA entry read the resolved body (regions criterion 4)', () => {
  it.each(ENTRY_KEYS)('%s ?words counts the resolved body, and code adds none', (key) => {
    const resolved = proseWordCount(parseFrontmatter(RAW_DSA_ENTRIES[key]).content);
    expect(DSA_WORDS[key]).toBe(resolved);
    expect(DSA_WORDS[key]).toBe(proseWordCount(parseFrontmatter(onDisk(key)).content));
  });

  it.each(ENTRY_KEYS)('%s ?dsaPrereqs and ?meta match the resolved file', (key) => {
    const { data, content } = parseFrontmatter(RAW_DSA_ENTRIES[key]);
    expect(DSA_PREREQS[key]).toEqual(dsaPrerequisites(content));
    expect(DSA_META[key]).toEqual(data);
  });
});

describe('non-DSA markdown is served as it is on disk (regions criterion 4)', () => {
  it.each([
    ['topic', RAW_TOPICS],
    ['case study', RAW_CASE_STUDIES],
  ])('every %s imported ?raw equals its file', (_, raws) => {
    const keys = Object.keys(raws);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(raws[key], key).toBe(onDisk(key));
  });
});
