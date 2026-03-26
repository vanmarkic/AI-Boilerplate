import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DialogPanel } from './dialog-panel';

describe('DialogPanel', () => {
  it('renders title, body, and footer', () => {
    render(
      <DialogPanel title={<span>Title</span>} footer={<button>OK</button>}>
        Body text
      </DialogPanel>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Body text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('applies variant', () => {
    const { container } = render(
      <DialogPanel variant="destructive">X</DialogPanel>,
    );
    expect(container.querySelector('[role="dialog"]')).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('fires onClose on backdrop click', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <DialogPanel onClose={onClose}>X</DialogPanel>,
    );
    await userEvent.click(container.querySelector('.dialog-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on Escape key', () => {
    const onClose = vi.fn();
    render(<DialogPanel onClose={onClose}>X</DialogPanel>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
