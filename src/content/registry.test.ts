import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SECTIONS } from './registry';

const CONTENT_DIR = path.dirname(fileURLToPath(import.meta.url));

describe('section registry', () => {
  it('has exactly one entry per folder under src/content', () => {
    const folders = readdirSync(CONTENT_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const registered = SECTIONS.map((section) => section.slug).sort();

    expect(registered).toEqual(folders);
  });

  it('has a non-empty label and description for every section', () => {
    for (const section of SECTIONS) {
      expect(section.label.length).toBeGreaterThan(0);
      expect(section.description.length).toBeGreaterThan(0);
    }
  });
});
