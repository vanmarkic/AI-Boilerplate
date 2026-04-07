import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './dialog';

describe('Dialog', () => {
  it('is closed by default', () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Dialog</Dialog.Title>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens when trigger is clicked', async () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes when Close button is clicked', async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Dialog</Dialog.Title>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape key', async () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Content has role=dialog and aria-modal=true (modal mode)', () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Dialog</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('aria-labelledby links to Dialog.Title', () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>My Title</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('My Title');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('aria-labelledby not set when Title omitted', () => {
    // suppress dev warning
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>No title</Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
    warn.mockRestore();
  });

  it('aria-describedby links to Dialog.Description', () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>T</Dialog.Title>
            <Dialog.Description>My Desc</Dialog.Description>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog');
    const desc = screen.getByText('My Desc');
    expect(dialog.getAttribute('aria-describedby')).toBe(desc.id);
  });

  it('Trigger has aria-haspopup and aria-expanded', async () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>T</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('controlled mode works', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open={false} onOpenChange={onOpenChange}>
        <Dialog.Trigger>Open</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>T</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    // dialog should NOT open (controlled)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('forceMount keeps Content in DOM when closed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <Dialog.Root>
        <Dialog.Portal>
          <Dialog.Content forceMount>No title</Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('data-state', 'closed');
    warn.mockRestore();
  });

  it('Overlay is aria-hidden', () => {
    render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content>
            <Dialog.Title>T</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    // Overlay should be aria-hidden
    const overlay = document.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
  });

  it('asChild works on Trigger', async () => {
    render(
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <a href="#">Open link</a>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Content>
            <Dialog.Title>T</Dialog.Title>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>,
    );
    // Renders as <a>, not <button>
    expect(screen.getByRole('link', { name: 'Open link' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Open link' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
