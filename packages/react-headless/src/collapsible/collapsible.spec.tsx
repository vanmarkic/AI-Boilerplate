import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Collapsible } from './collapsible';

describe('Collapsible', () => {
  it('renders closed by default', () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders open with defaultOpen', () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('toggles on trigger click', async () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Content')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('fires onOpenChange', async () => {
    const onOpenChange = vi.fn();
    render(
      <Collapsible.Root onOpenChange={onOpenChange}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('sets data-state on all sub-components', () => {
    const { container } = render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('button')).toHaveAttribute('data-state', 'open');
    expect(screen.getByRole('region')).toHaveAttribute('data-state', 'open');
  });

  it('disabled prevents toggle', async () => {
    render(
      <Collapsible.Root disabled>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('forceMount keeps content in DOM when closed', () => {
    render(
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content forceMount>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(screen.getByText('Content').parentElement).toHaveAttribute(
      'data-state',
      'closed',
    );
  });

  it('links trigger and content via aria-controls', () => {
    render(
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Content>Content</Collapsible.Content>
      </Collapsible.Root>,
    );
    const trigger = screen.getByRole('button');
    const content = screen.getByRole('region');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
  });

  it('passes className and HTML attributes to Root', () => {
    const { container } = render(
      <Collapsible.Root className="my-class" data-custom="test">
        <Collapsible.Trigger>T</Collapsible.Trigger>
        <Collapsible.Content>C</Collapsible.Content>
      </Collapsible.Root>,
    );
    expect(container.firstElementChild).toHaveClass('my-class');
    expect(container.firstElementChild).toHaveAttribute('data-custom', 'test');
  });
});
