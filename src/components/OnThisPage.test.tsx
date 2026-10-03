import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OnThisPage } from './OnThisPage';

// docs/specs/on-this-page-nav.md. The disclosure and the right nav with
// sections are covered through the real App (App.on-this-page.test.tsx),
// since the right nav renders into the shell's slot.

describe('OnThisPage with no headings (criterion 6)', () => {
  it('renders neither the disclosure nor the right nav', () => {
    const { container } = render(<OnThisPage headings={[]} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('details')).toBeNull();
    expect(
      screen.queryByRole('navigation', { name: 'On this page' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('On this page')).not.toBeInTheDocument();
  });
});

describe('Contents is replaced (criterion 3)', () => {
  it('has removed src/components/Contents.tsx', () => {
    const contents = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      'Contents.tsx',
    );
    expect(existsSync(contents)).toBe(false);
  });
});
