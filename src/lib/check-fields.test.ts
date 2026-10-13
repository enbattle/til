import { describe, expect, it } from 'vitest';
import { checkFields } from './frontmatter';

// docs/specs/content-dedupe.md, design item 1 and criterion 1:
// `checkFields(name, data, { required, allowed })` is the one required- and
// allowed-field check the two loaders share. It throws for the first missing
// or empty required field, in `required` order, and for any key not in
// `allowed`; otherwise it returns without a value.

const NAME = 'demo/some-file.md';
const FIELDS = {
  required: ['title', 'summary', 'date'],
  allowed: ['title', 'summary', 'date', 'note'],
};
const VALID = { title: 'A title', summary: 'A summary.', date: '2026-10-12' };

describe('checkFields (content-dedupe criterion 1)', () => {
  it('accepts data with every required field and only allowed keys', () => {
    expect(checkFields(NAME, VALID, FIELDS)).toBeUndefined();
  });

  it('accepts an allowed key that is not required, present or not', () => {
    expect(() => checkFields(NAME, { ...VALID, note: 'x' }, FIELDS)).not.toThrow();
    expect(() => checkFields(NAME, VALID, FIELDS)).not.toThrow();
  });

  it.each(['title', 'summary', 'date'])(
    'throws the loaders’ message for a missing %s',
    (field) => {
      const data: Record<string, string> = { ...VALID };
      delete data[field];
      expect(() => checkFields(NAME, data, FIELDS)).toThrow(
        new Error(`${NAME} is missing required frontmatter field "${field}"`),
      );
    },
  );

  it.each(['title', 'summary', 'date'])(
    'throws the same message for an empty %s',
    (field) => {
      expect(() => checkFields(NAME, { ...VALID, [field]: '' }, FIELDS)).toThrow(
        new Error(`${NAME} is missing required frontmatter field "${field}"`),
      );
    },
  );

  it('reports the first missing field in required order, not the data’s order', () => {
    // `date` is the data's first key; the report follows `required`.
    expect(() => checkFields(NAME, { date: '2026-10-12' }, FIELDS)).toThrow(
      new Error(`${NAME} is missing required frontmatter field "title"`),
    );
    expect(() => checkFields(NAME, { date: '2026-10-12', title: 'T' }, FIELDS)).toThrow(
      new Error(`${NAME} is missing required frontmatter field "summary"`),
    );
  });

  it('treats an empty field and a missing one alike, reporting whichever is listed first', () => {
    // Empty `title` before missing `summary`: title is reported.
    expect(() => checkFields(NAME, { title: '', date: '2026-10-12' }, FIELDS)).toThrow(
      new Error(`${NAME} is missing required frontmatter field "title"`),
    );
    // Missing `summary` before empty `date`: summary is reported.
    expect(() => checkFields(NAME, { title: 'T', date: '' }, FIELDS)).toThrow(
      new Error(`${NAME} is missing required frontmatter field "summary"`),
    );
  });

  it.each(['template', 'tags', 'Title', 'order'])(
    'throws for an unknown key %s, naming the file and the key',
    (key) => {
      expect(() => checkFields(NAME, { ...VALID, [key]: '2' }, FIELDS)).toThrow(
        new Error(`${NAME} has an unknown frontmatter field "${key}"`),
      );
    },
  );

  it('throws for an unknown key even when its value is empty', () => {
    expect(() => checkFields(NAME, { ...VALID, template: '' }, FIELDS)).toThrow(
      new Error(`${NAME} has an unknown frontmatter field "template"`),
    );
  });

  it('uses the lists it is given, not a fixed set', () => {
    const fields = { required: ['kind'], allowed: ['kind'] };
    expect(() => checkFields(NAME, { kind: 'pattern' }, fields)).not.toThrow();
    expect(() => checkFields(NAME, {}, fields)).toThrow(
      new Error(`${NAME} is missing required frontmatter field "kind"`),
    );
    expect(() => checkFields(NAME, { kind: 'pattern', title: 'T' }, fields)).toThrow(
      new Error(`${NAME} has an unknown frontmatter field "title"`),
    );
  });
});
