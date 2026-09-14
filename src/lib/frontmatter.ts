const DELIMITER = '---';

export type FrontmatterData = Record<string, string>;

export interface ParsedMarkdown {
  data: FrontmatterData;
  content: string;
}

/**
 * Splits a leading `---`-delimited block of flat `key: value` lines off a
 * markdown string. Deliberately not a real YAML parser — topic frontmatter
 * only ever needs flat string fields (title, summary, date), so a ~20-line
 * parser replaces a dependency for something this simple. A line's value is
 * everything after the *first* colon, so a value containing its own colon
 * (e.g. a summary like "Note: do X") still parses correctly. A value can
 * optionally be wrapped in matching single or double quotes (handy when it
 * ends with punctuation that could be misread), which are stripped.
 */
export function parseFrontmatter(raw: string): ParsedMarkdown {
  const lines = raw.replace(/^﻿/, '').split('\n');

  if (lines[0]?.trim() !== DELIMITER) {
    return { data: {}, content: raw };
  }

  const data: FrontmatterData = {};
  let closingIndex = -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === DELIMITER) {
      closingIndex = i;
      break;
    }
    const separator = lines[i].indexOf(':');
    if (separator === -1) continue;
    const key = lines[i].slice(0, separator).trim();
    const value = unquote(lines[i].slice(separator + 1).trim());
    if (key) data[key] = value;
  }

  if (closingIndex === -1) {
    return { data: {}, content: raw };
  }

  const content = lines
    .slice(closingIndex + 1)
    .join('\n')
    .replace(/^\n+/, '');

  return { data, content };
}

function unquote(value: string): string {
  const isQuoted =
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")));
  return isQuoted ? value.slice(1, -1) : value;
}
