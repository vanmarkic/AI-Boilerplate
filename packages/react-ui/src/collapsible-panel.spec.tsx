import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsiblePanel } from './collapsible-panel';

describe('CollapsiblePanel', () => {
  it('renders closed by default', () => {
    render(<CollapsiblePanel header="Header">Content</CollapsiblePanel>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders open with defaultOpen', () => {
    render(
      <CollapsiblePanel header="Header" defaultOpen>
        Content
      </CollapsiblePanel>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('variant and size applied via data attributes', () => {
    const { container } = render(
      <CollapsiblePanel header="H" variant="ghost" size="sm">
        C
      </CollapsiblePanel>,
    );
    const root = container.firstElementChild;
    expect(root).toHaveAttribute('data-variant', 'ghost');
    expect(root).toHaveAttribute('data-size', 'sm');
  });

  it('toggles via click', async () => {
    render(<CollapsiblePanel header="Header">Content</CollapsiblePanel>);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Content')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('fires onOpenChange', async () => {
    const onOpenChange = vi.fn();
    render(
      <CollapsiblePanel header="H" onOpenChange={onOpenChange}>
        C
      </CollapsiblePanel>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('disabled prevents toggle', async () => {
    render(
      <CollapsiblePanel header="H" disabled>
        Content
      </CollapsiblePanel>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
