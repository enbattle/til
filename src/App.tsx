import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Header } from '@/components/Header';
import { SearchDialog } from '@/components/SearchDialog';
import { HomePage } from '@/pages/HomePage';
import { SectionPage } from '@/pages/SectionPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// The only page that renders markdown bodies — pulling in react-markdown,
// remark-gfm, and shiki's highlighting engine. Lazy-loaded so that cost is
// only ever paid when a topic page is actually visited, not on the home or
// section pages (confirmed via the production build: this alone took the
// main chunk from ~630 kB to well under half that).
const TopicPage = lazy(() =>
  import('@/pages/TopicPage').then((m) => ({ default: m.TopicPage })),
);

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Defense in depth: a search result click already closes the dialog
  // itself before navigating, but this also covers a route change from
  // anything else (browser back/forward) while it happens to be open, so a
  // stale dialog is never left mounted over a different page. Focus
  // restoration on close is handled inside SearchDialog (useFocusTrap).
  useEffect(() => {
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isSearchShortcut) {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header onOpenSearch={() => setSearchOpen(true)} />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/not-found" element={<NotFoundPage />} />
          <Route path="/:section" element={<SectionPage />} />
          <Route
            path="/:section/:slug"
            element={
              <Suspense fallback={null}>
                <TopicPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </main>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
