import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Slot } from './slot';

describe('Slot', () => {
  it('renders child element with merged props', () => {
    render(
      <Slot data-testid="slot" className="from-slot">
        <button className="from-child">Click</button>
      </Slot>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('from-slot', 'from-child');
    expect(btn).toHaveAttribute('data-testid', 'slot');
  });

  it('merges event handlers — both fire', async () => {
    const slotClick = vi.fn();
    const childClick = vi.fn();
    render(
      <Slot onClick={slotClick}>
        <button onClick={childClick}>Click</button>
      </Slot>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(slotClick).toHaveBeenCalledOnce();
    expect(childClick).toHaveBeenCalledOnce();
  });

  it('composes refs', () => {
    const slotRef = createRef<HTMLButtonElement>();
    const childRef = createRef<HTMLButtonElement>();
    render(
      <Slot ref={slotRef}>
        <button ref={childRef}>Click</button>
      </Slot>,
    );
    expect(slotRef.current).toBe(childRef.current);
    expect(slotRef.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('child props win on conflict', () => {
    render(
      <Slot id="slot-id" data-value="slot">
        <button id="child-id" data-value="child">
          Click
        </button>
      </Slot>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('id', 'child-id');
    expect(btn).toHaveAttribute('data-value', 'child');
  });

  it('merges styles with child winning', () => {
    render(
      <Slot style={{ color: 'red', fontSize: '12px' }}>
        <div style={{ color: 'blue' }} data-testid="styled">
          Content
        </div>
      </Slot>,
    );
    const el = screen.getByTestId('styled');
    expect(el.style.color).toBe('blue');
    expect(el.style.fontSize).toBe('12px');
  });
});
