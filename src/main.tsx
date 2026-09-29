import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// Start the web-font faces that only the lazily loaded markdown bodies use
// (inline and block code, `font-medium` text, bold serif) now, in parallel
// with the body's chunk, instead of when the body first renders. Otherwise
// they swap in just after a `#section` link has scrolled to its heading and
// reflow the text above it. The faces the shell itself uses load anyway.
// Each face here must be one the Google Fonts stylesheet in index.html
// requests (family and weight); keep the two in step when either changes.
// (The list isn't derived from that URL because it is a subset of it.)
for (const face of [
  '400 1em "IBM Plex Mono"',
  '600 1em "IBM Plex Mono"',
  '500 1em "IBM Plex Sans"',
  '700 1em "Lora"',
]) {
  document.fonts?.load(face).catch(() => {});
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root not found');

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
