import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches render/lifecycle errors anywhere below it — most concretely, a
 * failed dynamic import for the lazy-loaded `TopicPage` chunk (see the
 * comment in `App.tsx`: a stale asset reference after a new deploy, or a
 * one-off network blip, is a real failure mode here, not hypothetical).
 * Without this, that error propagates past the router and blanks the page.
 * A full reload is the actual fix for a stale-chunk error (it re-fetches
 * the current asset manifest), so that's what the fallback offers rather
 * than an in-place "try again" that would just hit the same stale chunk.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error in render tree:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="space-y-4 py-12 text-center">
          <h1 className="font-serif text-3xl font-semibold text-text-primary">
            Something went wrong
          </h1>
          <p className="text-text-secondary">
            This page hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-block text-accent hover:text-accent-hover"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
