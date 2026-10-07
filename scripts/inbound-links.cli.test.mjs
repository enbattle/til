// @vitest-environment node
// scripts/inbound-links.mjs run as a command
// (docs/specs/drift-and-rewrite-guards.md, criteria 6 and 7). Kept apart from
// inbound-links.test.mjs, which imports the module, so these cases spawn the
// script and fail for their own reasons.
//
// Interface assumed: `node scripts/inbound-links.mjs <section>/<slug>` reads
// the repository, or the directory in the INBOUND_LINKS_ROOT environment
// variable: every markdown body under src/content/**,
// src/system-design/case-studies/*.md and src/dsa/entries/*.md, and the
// redirects in src/content/redirects.ts. A topic is `<section>/<slug>` with a
// src/content/<section>/<slug>.md file. It prints one line per link,
// `<file>:<line>  <#anchor or —>  "<sentence>"`, with <file> relative to the
// root; or "no inbound links" and exit 0 when there are none; and a usage
// message and exit 2 when the argument is missing or names no topic.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanTemps, gitInit, run, tempDir } from '../src/test/guard-helpers.mjs';

afterEach(cleanTemps);

function write(root, path, content) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

const FRONTMATTER = '---\ntitle: A page\nsummary: A page.\ndate: 2026-10-07\n---\n\n';
// Body lines start on line 7.
const page = (...lines) => `${FRONTMATTER}${lines.join('\n')}\n`;

/** A throwaway repository: one topic with inbound links from a topic, a case
 * study and a DSA entry, and one topic nothing links to. */
function fixture() {
  const root = tempDir();
  gitInit(root);
  mkdirSync(join(root, 'src/content'), { recursive: true });
  copyFileSync(
    resolve('src/content/redirects.ts'),
    join(root, 'src/content/redirects.ts'),
  );
  write(root, 'src/content/s/caching.md', page('The topic itself.'));
  write(root, 'src/content/s/lonely.md', page('Nothing links here.'));
  write(root, 'src/content/s/other.md', page('Reads go through a [cache](/s/caching).'));
  write(
    root,
    'src/system-design/case-studies/feed.md',
    page('Intro.', '', 'The feed reads through a [cache](/s/caching#hit-rate) first.'),
  );
  write(
    root,
    'src/dsa/entries/lru.md',
    page('An LRU list backs a [cache](/s/caching?x=1).'),
  );
  return root;
}

const links = (args, root) =>
  run('inbound-links.mjs', args, root ? { INBOUND_LINKS_ROOT: root } : {});
const output = ({ stdout, stderr }) => `${stdout}${stderr}`.split('\\').join('/');

describe('inbound-links, run as a command', () => {
  it('prints one line per link, with file, line, anchor and sentence (criterion 6)', () => {
    const result = links(['s/caching'], fixture());
    expect(result.status, result.stderr).toBe(0);
    const lines = result.stdout
      .split('\\')
      .join('/')
      .split(/\r?\n/)
      .filter((line) => line.trim());
    expect(lines).toHaveLength(3);
    const lineFor = (file) => lines.find((line) => line.includes(file));
    expect(lineFor('src/content/s/other.md:7')).toMatch(
      /—\s+"Reads go through a cache\."/,
    );
    expect(lineFor('src/system-design/case-studies/feed.md:9')).toMatch(
      /#hit-rate\s+"The feed reads through a cache first\."/,
    );
    expect(lineFor('src/dsa/entries/lru.md:7')).toMatch(
      /—\s+"An LRU list backs a cache\."/,
    );
  });

  it('prints "no inbound links" and exits 0 when nothing links to the topic (criterion 7)', () => {
    const result = links(['s/lonely'], fixture());
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/no inbound links/i);
  });

  it.each([
    ['no argument', []],
    ['a topic that does not exist', ['s/nothing']],
    ['an argument that is not section/slug', ['caching']],
    // Review decisions, round 1 (finding 2b): a topic matches with exact case,
    // even on a case-insensitive file system.
    ['a topic named only in the wrong case', ['S/Caching']],
  ])('exits 2 with a usage message on %s, in a fixture (criterion 7)', (_label, args) => {
    const result = links(args, fixture());
    expect(result.status).toBe(2);
    expect(output(result)).toMatch(/usage/i);
  });
});

describe('inbound-links on the real repository', () => {
  it('lists the ecommerce-checkout link to forward-vs-reverse-proxy', () => {
    const result = links(['systems-and-infrastructure/forward-vs-reverse-proxy']);
    expect(result.status, result.stderr).toBe(0);
    expect(output(result)).toMatch(
      /src\/system-design\/case-studies\/ecommerce-checkout\.md:\d+/,
    );
  });

  it.each([
    ['no argument', []],
    ['a topic that does not exist', ['nope/nothing']],
  ])('exits 2 with a usage message on %s (criterion 7)', (_label, args) => {
    const result = links(args);
    expect(result.status).toBe(2);
    expect(output(result)).toMatch(/usage/i);
  });
});
