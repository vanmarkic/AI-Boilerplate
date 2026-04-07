import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './tabs';

describe('Tabs', () => {
  it('renders first tab content by default (uncontrolled with defaultValue)', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">Content 1</Tabs.Content>
        <Tabs.Content value="tab2">Content 2</Tabs.Content>
      </Tabs.Root>,
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
  });

  it('switches content on trigger click', async () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">Content 1</Tabs.Content>
        <Tabs.Content value="tab2">Content 2</Tabs.Content>
      </Tabs.Root>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument();
    expect(screen.getByText('Content 2')).toBeInTheDocument();
  });

  it('fires onValueChange', async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs.Root defaultValue="tab1" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">Content 1</Tabs.Content>
        <Tabs.Content value="tab2">Content 2</Tabs.Content>
      </Tabs.Root>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(onValueChange).toHaveBeenCalledWith('tab2');
  });

  it('Trigger has role=tab, aria-selected', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
        <Tabs.Content value="tab2">C2</Tabs.Content>
      </Tabs.Root>,
    );
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'false');
  });

  it('List has role=tablist', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
      </Tabs.Root>,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('Content has role=tabpanel and aria-labelledby', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
      </Tabs.Root>,
    );
    const panel = screen.getByRole('tabpanel');
    const trigger = screen.getByRole('tab');
    expect(panel).toHaveAttribute('aria-labelledby', trigger.id);
  });

  it('aria-controls on Trigger links to Content', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
      </Tabs.Root>,
    );
    const trigger = screen.getByRole('tab');
    const panel = screen.getByRole('tabpanel');
    expect(trigger.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('disabled trigger has aria-disabled', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2" disabled>
            Tab 2
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
        <Tabs.Content value="tab2">C2</Tabs.Content>
      </Tabs.Root>,
    );
    const disabledTrigger = screen.getByRole('tab', { name: 'Tab 2' });
    expect(disabledTrigger).toHaveAttribute('aria-disabled', 'true');
  });

  it('forceMount keeps inactive content in DOM', () => {
    render(
      <Tabs.Root defaultValue="tab1">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">Content 1</Tabs.Content>
        <Tabs.Content value="tab2" forceMount>
          Content 2
        </Tabs.Content>
      </Tabs.Root>,
    );
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.getByText('Content 2')).toBeInTheDocument();
    const panel2 = screen.getByText('Content 2').closest('[role="tabpanel"]');
    expect(panel2).toHaveAttribute('data-state', 'inactive');
  });

  it('controlled mode works', async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs.Root value="tab1" onValueChange={onValueChange}>
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
        <Tabs.Content value="tab2">C2</Tabs.Content>
      </Tabs.Root>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(onValueChange).toHaveBeenCalledWith('tab2');
    // tab2 should NOT become active (controlled)
    expect(screen.queryByText('C2')).not.toBeInTheDocument();
  });

  it('Root passes className and HTML attributes', () => {
    const { container } = render(
      <Tabs.Root defaultValue="tab1" className="my-tabs" data-custom="test">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">C1</Tabs.Content>
      </Tabs.Root>,
    );
    expect(container.firstElementChild).toHaveClass('my-tabs');
    expect(container.firstElementChild).toHaveAttribute('data-custom', 'test');
  });

  it('activationMode manual: click does not activate', async () => {
    render(
      <Tabs.Root defaultValue="tab1" activationMode="manual">
        <Tabs.List>
          <Tabs.Trigger value="tab1">Tab 1</Tabs.Trigger>
          <Tabs.Trigger value="tab2">Tab 2</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="tab1">Content 1</Tabs.Content>
        <Tabs.Content value="tab2">Content 2</Tabs.Content>
      </Tabs.Root>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    // In manual mode, click does NOT change active tab
    expect(screen.getByText('Content 1')).toBeInTheDocument();
    expect(screen.queryByText('Content 2')).not.toBeInTheDocument();
  });
});
