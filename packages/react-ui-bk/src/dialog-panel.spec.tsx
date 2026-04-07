import { render, screen } from '@testing-library/react';
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
    render(
      <DialogPanel variant="destructive">X</DialogPanel>,
    );
    expect(document.querySelector('[role="dialog"]')).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('fires onClose on backdrop click', async () => {
    const onClose = vi.fn();
    render(
      <DialogPanel onClose={onClose}>X</DialogPanel>,
    );
    await userEvent.click(document.querySelector('.dialog-backdrop')!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on Escape key', async () => {
    const onClose = vi.fn();
    render(<DialogPanel onClose={onClose}>X</DialogPanel>);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has role=dialog and aria-modal=true', () => {
    render(<DialogPanel>Content</DialogPanel>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('aria-labelledby links to title when provided', () => {
    render(<DialogPanel title="My Title">Content</DialogPanel>);
    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('My Title');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });
});
