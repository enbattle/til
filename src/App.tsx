import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CodeLanguageProvider } from '@/contexts/CodeLanguageContext';
import { PageAsideContext } from '@/contexts/usePageAside';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Header } from '@/components/Header';
import { SearchDialog } from '@/components/SearchDialog';
import { SectionNav } from '@/components/SectionNav';
import { MobileNav } from '@/components/MobileNav';
import { CaseStudyNav } from '@/components/CaseStudyNav';
import { DsaNav } from '@/components/DsaNav';
import { tabForPath } from '@/lib/tabs';
import { HomePage } from '@/pages/HomePage';
import { SectionPage } from '@/pages/SectionPage';
import { SystemDesignPage } from '@/pages/SystemDesignPage';
import { DsaPage } from '@/pages/DsaPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

// The pages that render markdown bodies — pulling in react-markdown,
// remark-gfm, and shiki's highlighting engine. Lazy-loaded so that cost is
// only ever paid when a topic, case study or DSA entry page is actually
// visited, not on the home, section, System Design or DSA landing pages
// (confirmed via the production build: this alone took the main chunk from
// ~630 kB to well under half that).
const TopicPage = lazy(() =>
  import('@/pages/TopicPage').then((m) => ({ default: m.TopicPage })),
);
const CaseStudyPage = lazy(() =>
  import('@/pages/CaseStudyPage').then((m) => ({ default: m.CaseStudyPage })),
);
const DsaEntryPage = lazy(() =>
  import('@/pages/DsaEntryPage').then((m) => ({ default: m.DsaEntryPage })),
);

/** The two sticky side columns' shared classes. `px-1` keeps the 4px a focus
 * ring takes (2px outline, 2px offset; `src/index.css`) inside the column,
 * where `overflow-x-hidden` would otherwise clip it on the links' left and
 * right edges. */
const SIDE_COLUMN =
  'scrollbar-thin sticky top-[68px] hidden max-h-[calc(100vh-68px)] w-56 shrink-0 self-start overflow-y-auto overflow-x-hidden px-1 py-10';

/** The persistent sidebar: the case-study list on System Design routes, the
 * DSA list on DSA routes, the section tree everywhere else. (`MobileNav`
 * makes the same choice.) All three stay mounted so a section group the user
 * opened survives a round trip between the tabs; the inactive ones are
 * `hidden` (out of the accessibility tree at every width) inside a
 * `display: contents` wrapper, so the active nav's own sticky/`lg:block`
 * classes still apply as before. */
function SideNav({ className }: { className: string }) {
  const tab = tabForPath(useLocation().pathname);
  return (
    <>
      <div hidden={tab !== 'catalog'} className="contents">
        <SectionNav className={className} />
      </div>
      <div hidden={tab !== 'system-design'} className="contents">
        <CaseStudyNav className={className} />
      </div>
      <div hidden={tab !== 'dsa'} className="contents">
        <DsaNav className={className} />
      </div>
    </>
  );
}

function AppShell() {
  // At most one overlay is open: search or the mobile nav.
  const [overlay, setOverlay] = useState<'search' | 'nav' | null>(null);
  const { pathname } = useLocation();
  // Defense in depth: a search result click (and a nav link click) already
  // closes its own overlay before navigating, but any other route change
  // (browser back/forward) closes it too, so a stale overlay is never left
  // mounted over a different page. Reset during render when the path changes
  // (React's pattern for adjusting state on a prop change), not in an effect.
  // Focus restoration on close is handled inside SearchDialog/MobileNav
  // (useFocusTrap).
  const [overlayPath, setOverlayPath] = useState(pathname);
  if (overlayPath !== pathname) {
    setOverlayPath(pathname);
    setOverlay(null);
  }
  const close = () => setOverlay(null);
  // The right column's element, held in state (via a callback ref) so pages
  // rerender with it once it has mounted and can portal into it.
  const [pageAside, setPageAside] = useState<HTMLElement | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isSearchShortcut) {
        event.preventDefault();
        setOverlay('search');
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        onOpenSearch={() => setOverlay('search')}
        onOpenNav={() => setOverlay('nav')}
      />
      {/* From `xl`, the space past the 800px reading column and the two side
          columns goes into the gaps (`justify-between`), not the column. */}
      <div className="mx-auto flex max-w-[90rem] gap-8 px-4 xl:justify-between">
        <SideNav className={`${SIDE_COLUMN} lg:block`} />
        <PageAsideContext.Provider value={pageAside}>
          <main className="min-w-0 max-w-[50rem] flex-1 py-10">
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
                      <CaseStudyPage />
                    </Suspense>
                  }
                />
                <Route path="/dsa" element={<DsaPage />} />
                <Route
                  path="/dsa/:slug"
                  element={
                    <Suspense fallback={null}>
                      <DsaEntryPage />
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
        </PageAsideContext.Provider>
        {/* The right column: a page's "On this page" nav (OnThisPage portals
            it in), sticky like the left nav. On every route, empty on pages
            without sections, so the reading column never shifts between
            pages. A plain div, so an empty one adds no landmark. */}
        <div ref={setPageAside} className={`${SIDE_COLUMN} xl:block`} />
      </div>
      {overlay === 'search' && <SearchDialog onClose={close} />}
      {overlay === 'nav' && <MobileNav onClose={close} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <CodeLanguageProvider>
        <AppShell />
      </CodeLanguageProvider>
    </ThemeProvider>
  );
}
