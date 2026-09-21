import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { SearchDialog } from '@/components/SearchDialog';
import { SectionNav } from '@/components/SectionNav';
import { MobileNav } from '@/components/MobileNav';
import { QuestionNav } from '@/components/QuestionNav';
import { isSystemDesignPath } from '@/lib/system-design';
import { HomePage } from '@/pages/HomePage';
import { SectionPage } from '@/pages/SectionPage';
import { SystemDesignPage } from '@/pages/SystemDesignPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// The pages that render markdown bodies — pulling in react-markdown,
// remark-gfm, and shiki's highlighting engine. Lazy-loaded so that cost is
// only ever paid when a topic or question page is actually visited, not on
// the home, section, or System Design landing pages (confirmed via the
// production build: this alone took the main chunk from ~630 kB to well
// under half that).
const TopicPage = lazy(() =>
  import('@/pages/TopicPage').then((m) => ({ default: m.TopicPage })),
);
const QuestionPage = lazy(() =>
  import('@/pages/QuestionPage').then((m) => ({ default: m.QuestionPage })),
);

/** The persistent sidebar: the question tree on System Design routes, the
 * section tree everywhere else. (`MobileNav` makes the same choice.) Both
 * trees stay mounted so a group the user opened survives a round trip between
 * the Catalog and System Design tabs; the inactive one is `hidden` (out of the
 * accessibility tree at every width) inside a `display: contents` wrapper, so
 * the active nav's own sticky/`lg:block` classes still apply as before. */
function SideNav({ className }: { className: string }) {
  const { pathname } = useLocation();
  const onSystemDesign = isSystemDesignPath(pathname);
  return (
    <>
      <div hidden={onSystemDesign} className="contents">
        <SectionNav className={className} />
      </div>
      <div hidden={!onSystemDesign} className="contents">
        <QuestionNav className={className} />
      </div>
    </>
  );
}

function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Defense in depth: a search result click (and a nav link click) already
  // closes its own overlay before navigating, but this also covers a route
  // change from anything else (browser back/forward) while one happens to be
  // open, so a stale overlay is never left mounted over a different page.
  // Focus restoration on close is handled inside SearchDialog/MobileNav
  // (useFocusTrap).
  useEffect(() => {
    setSearchOpen(false);
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isSearchShortcut) {
        event.preventDefault();
        setNavOpen(false);
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNav={() => {
          setSearchOpen(false);
          setNavOpen(true);
        }}
      />
      <div className="mx-auto flex max-w-5xl gap-8 px-4">
        <SideNav className="scrollbar-thin sticky top-[68px] hidden max-h-[calc(100vh-68px)] w-56 shrink-0 self-start overflow-y-auto overflow-x-hidden py-10 lg:block" />
        <main className="min-w-0 max-w-3xl flex-1 py-10">
          {/* Keyed on pathname so navigating away from a page that errored
              remounts a fresh boundary instead of staying stuck on the
              fallback for the rest of the session. */}
          <ErrorBoundary key={pathname}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/not-found" element={<NotFoundPage />} />
              <Route path="/system-design" element={<SystemDesignPage />} />
              <Route
                path="/system-design/:slug"
                element={
                  <Suspense fallback={null}>
                    <QuestionPage />
                  </Suspense>
                }
              />
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
          </ErrorBoundary>
        </main>
      </div>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      {navOpen && <MobileNav onClose={() => setNavOpen(false)} />}
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
