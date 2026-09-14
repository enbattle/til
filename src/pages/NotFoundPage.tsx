import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="space-y-4 py-12 text-center">
      <h1 className="font-serif text-3xl font-semibold text-text-primary">
        Page not found
      </h1>
      <p className="text-text-secondary">There's no topic at this address.</p>
      <Link to="/" className="inline-block text-accent hover:text-accent-hover">
        ← Back to til
      </Link>
    </div>
  );
}
