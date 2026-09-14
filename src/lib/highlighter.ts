import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/**
 * A small, fixed set of languages covering the code seen in topic bodies so
 * far, imported individually — shiki's "fine-grained bundle" approach.
 * `createHighlighter`'s convenience API pulls in every language shiki
 * supports regardless of which ones are actually referenced (confirmed by
 * inspecting the production build output), so this is the version that
 * actually keeps the bundle to just what's used. Add a language here when a
 * topic needs it.
 */
const LANGUAGE_IMPORTS = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
} as const;

type SupportedLanguage = keyof typeof LANGUAGE_IMPORTS;

/** Common shorthand fence tags (```sh, ```js, ```ts, ```py) mapped to their canonical id. */
const ALIASES: Record<string, SupportedLanguage> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  py: 'python',
  md: 'markdown',
};

const LIGHT_THEME = 'vitesse-light';
const DARK_THEME = 'vitesse-dark';

let highlighterPromise: Promise<HighlighterCore> | null = null;

/**
 * Loaded lazily, so pages that never render a code block (the home page,
 * section listings) never pay for shiki at all — only a topic page does,
 * and only once per session (the JS regex engine avoids a WASM asset too).
 */
function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import('shiki/themes/vitesse-light.mjs'),
        import('shiki/themes/vitesse-dark.mjs'),
      ],
      langs: Object.values(LANGUAGE_IMPORTS).map((load) => load()),
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

/** Resolves a fence tag (canonical id or common shorthand alias) to a registered language, or 'text'. */
function resolveLanguage(lang: string | undefined): SupportedLanguage | 'text' {
  if (!lang) return 'text';
  if (lang in LANGUAGE_IMPORTS) return lang as SupportedLanguage;
  return ALIASES[lang] ?? 'text';
}

/** Highlights `code` as `lang` (falling back to plain text for an unsupported language). */
export async function highlightCode(
  code: string,
  lang: string | undefined,
  theme: 'light' | 'dark',
): Promise<string> {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: resolveLanguage(lang),
    theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
  });
}
