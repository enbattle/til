import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfigFromFile } from 'vite';
import { describe, expect, it } from 'vitest';

// package.json's description is the one copy of the site's one-line
// description; vite.config.ts's siteDescription plugin fills index.html's
// meta tags from it. (Vitest runs from the repository root.)
const ROOT = process.cwd();
const { description } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
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
});
