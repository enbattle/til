import { configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Testing Library's own findBy/waitFor timeout (1000ms) is independent of
// Vitest's per-test timeout, and too short for the first test in a file to
// touch the lazy-loaded TopicPage route — that cold import (react-markdown,
// remark-gfm, shiki/core, the JS regex engine) can take longer than that to
// transform and evaluate the first time, which is a test-environment cost,
// not a real slowdown users hit (that chunk is prebuilt and cached in prod).
// 10s rather than 5s: a cold, first-in-file render of the lazy route was
// measured at ~11s for a whole file on 2026-09-24 and still timed out a
// findBy at 5s. Vitest's own testTimeout (vite.config.ts) is 15s, above this.
configure({ asyncUtilTimeout: 10000 });

// jsdom doesn't implement scrollTo — App.tsx calls it on every route change.
window.scrollTo = () => {};

// jsdom doesn't implement matchMedia — ThemeContext calls it to read the
// system color-scheme preference, so any test rendering ThemeProvider needs
// this polyfilled or it throws.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom does no real layout, so `offsetParent` is always null — code that
// uses it as an "is this actually visible" check (useFocusTrap's focusable-
// elements filter) would otherwise see every element as hidden. Not a
// faithful polyfill of real offsetParent semantics, just enough for an
// attached element to read as non-null.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  get() {
    return this.parentElement;
  },
  configurable: true,
});
