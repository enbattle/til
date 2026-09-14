import { createHighlighterCore, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

/**
 * A small, fixed set of languages covering the code seen in topic bodies so
 * far, each importable individually — shiki's "fine-grained bundle"
 * approach. `createHighlighter`'s convenience API pulls in every language
 * shiki supports regardless of which ones are actually referenced
 * (confirmed by inspecting the production build output). Registered with
 * the highlighter lazily, one at a time, as each is actually needed — see
 * `ensureLanguageLoaded` below. Add a language here when a topic needs it.
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
 * Registered with *no* languages up front — see `ensureLanguageLoaded`.
 */
function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import('shiki/themes/vitesse-light.mjs'),
        import('shiki/themes/vitesse-dark.mjs'),
      ],
      langs: [],
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

/**
 * Loads one language's grammar into the highlighter the first time it's
 * actually needed, instead of loading all ten up front. A typical topic
 * page uses one or two languages — fetching the other eight every time
 * only wastes bandwidth, it also means a single flaky chunk fetch (a real
 * failure seen in production) breaks every code block on the page, not
 * just the one that needed it.
 */
async function ensureLanguageLoaded(
  highlighter: HighlighterCore,
  language: SupportedLanguage,
): Promise<void> {
  if (highlighter.getLoadedLanguages().includes(language)) return;
  await highlighter.loadLanguage(LANGUAGE_IMPORTS[language]());
}

/** Highlights `code` as `lang` (falling back to plain text for an unsupported language). */
export async function highlightCode(
  code: string,
  lang: string | undefined,
  theme: 'light' | 'dark',
): Promise<string> {
  const highlighter = await getHighlighter();
  const resolved = resolveLanguage(lang);
  if (resolved !== 'text') {
    await ensureLanguageLoaded(highlighter, resolved);
  }
  return highlighter.codeToHtml(code, {
    lang: resolved,
    theme: theme === 'dark' ? DARK_THEME : LIGHT_THEME,
  });
}
