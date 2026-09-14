import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

function TrapHarness({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(active, containerRef);
  return (
    <div>
      <button>outside before</button>
      <div ref={containerRef}>
        <button>first</button>
        <button>last</button>
      </div>
      <button>outside after</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('wraps Tab from the last element back to the first while active', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active />);
    screen.getByText('last').focus();

    await user.tab();

    expect(screen.getByText('first')).toHaveFocus();
  });

  it('wraps Shift+Tab from the first element back to the last while active', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active />);
    screen.getByText('first').focus();

    await user.tab({ shift: true });

    expect(screen.getByText('last')).toHaveFocus();
  });

  it('does not trap focus when inactive', async () => {
    const user = userEvent.setup();
    render(<TrapHarness active={false} />);
    screen.getByText('last').focus();

    await user.tab();

    expect(screen.getByText('outside after')).toHaveFocus();
  });

  it('restores focus to the previously-focused element on unmount', () => {
    function Wrapper({ active }: { active: boolean }) {
      return (
        <div>
          <button>trigger</button>
          {active && <TrapHarness active />}
        </div>
      );
    }
    const { rerender } = render(<Wrapper active={false} />);
    screen.getByText('trigger').focus();

    rerender(<Wrapper active />);
    rerender(<Wrapper active={false} />);

    expect(screen.getByText('trigger')).toHaveFocus();
  });
});
