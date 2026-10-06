import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigFromFile } from 'vite';
import { describe, expect, it } from 'vitest';

// package.json's description is the source of the site's one-line
// description; vite.config.ts's siteDescription plugin fills index.html's
// meta tags from it, and README.md's intro paragraph is a copy this file checks.
// (Vitest runs from the repository root.)
const ROOT = process.cwd();
const { description } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

/** README's intro: the first paragraph after its `# ` title, with its line
 * breaks folded to spaces. */
function introParagraph(markdown) {
  const blocks = markdown
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const title = blocks.findIndex((block) => /^# /.test(block));
  return (blocks[title + 1] ?? '').replace(/\s+/g, ' ');
}

/** What's wrong with README's copy of the description, or null. */
function readmeProblem(markdown, expected) {
  const intro = introParagraph(markdown);
  return intro === expected
    ? null
    : `README.md's intro paragraph differs from package.json's description:\n  README.md:    ${intro}\n  package.json: ${expected}`;
}
// Loaded the way Vite loads it, so the config's own paths resolve.
const { config } = await loadConfigFromFile(
  { command: 'build', mode: 'production' },
  join(ROOT, 'vite.config.ts'),
);
const plugin = config.plugins.flat().find((p) => p?.name === 'site-description');

describe('site description', () => {
  it('index.html holds the placeholder, not its own copy', () => {
    expect(html).not.toContain(description);
    expect(html.match(/content="%SITE_DESCRIPTION%"/g)).toHaveLength(3);
  });

  it('fills every placeholder with the escaped package.json description', () => {
    const filled = plugin.transformIndexHtml.handler(html);
    const escaped = description.replaceAll('&', '&amp;');
    expect(filled).not.toContain('%SITE_DESCRIPTION%');
    expect(filled.split(`content="${escaped}"`)).toHaveLength(4);
  });

  // docs/specs/harness-follow-ups.md, criterion 8.
  it("README.md's intro paragraph is package.json's description", () => {
    expect(readmeProblem(readme, description)).toBeNull();
  });

  it('reads the intro across wrapped lines, up to the blank line', () => {
    const wrapped = description.replace(/ (?=\S{6,})/, '\n');
    expect(
      readmeProblem(`# til\n\n${wrapped}\n\n**[link](x)**\n`, description),
    ).toBeNull();
  });

  it('fails, naming README, when a copy of README says something else', () => {
    const changed = readme.replace(
      /^# .*\n+/m,
      (title) => `${title}A different intro.\n\n`,
    );
    expect(readmeProblem(changed, description)).toContain('README');
    // A reworded description fails the same copy.
    expect(readmeProblem(readme, `${description} Now with more.`)).toContain('README');
  });
});
