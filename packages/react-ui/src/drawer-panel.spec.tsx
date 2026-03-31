import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DrawerPanel } from './drawer-panel';

describe('DrawerPanel', () => {
  it('renders title and body', () => {
    render(
      <DrawerPanel open title={<span>Drawer Title</span>}>
        Drawer body
      </DrawerPanel>,
    );
    expect(screen.getByText('Drawer Title')).toBeInTheDocument();
    expect(screen.getByText('Drawer body')).toBeInTheDocument();
  });

  it('renders a close button', () => {
    render(<DrawerPanel open>Content</DrawerPanel>);
    expect(
      screen.getByRole('button', { name: 'Close drawer' }),
    ).toBeInTheDocument();
  });

  it('defaults to data-side="right"', () => {
    render(<DrawerPanel open>Content</DrawerPanel>);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'right');
  });

  it('applies data-side="left" when side prop is left', () => {
    render(
      <DrawerPanel open side="left">
        Content
      </DrawerPanel>,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'left');
  });

  it('has data-state="open" when open', () => {
    render(<DrawerPanel open>Content</DrawerPanel>);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'open');
  });

  it('has data-state="closed" when not open', () => {
    render(<DrawerPanel>Content</DrawerPanel>);
    expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed');
  });

  it('renders backdrop only when open', () => {
    const { container, rerender } = render(
      <DrawerPanel>Content</DrawerPanel>,
    );
    expect(container.querySelector('.drawer-backdrop')).toBeNull();

    rerender(<DrawerPanel open>Content</DrawerPanel>);
    expect(container.querySelector('.drawer-backdrop')).not.toBeNull();
  });

  it('fires onClose on backdrop click', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <DrawerPanel open onClose={onClose}>
        Content
      </DrawerPanel>,
    );
    await userEvent.click(container.querySelector('.drawer-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on close button click', async () => {
    const onClose = vi.fn();
    render(
      <DrawerPanel open onClose={onClose}>
        Content
      </DrawerPanel>,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Close drawer' }),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on Escape key when open', () => {
    const onClose = vi.fn();
    render(
      <DrawerPanel open onClose={onClose}>
        Content
      </DrawerPanel>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not fire onClose on Escape key when closed', () => {
    const onClose = vi.fn();
    render(
      <DrawerPanel onClose={onClose}>
        Content
      </DrawerPanel>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
