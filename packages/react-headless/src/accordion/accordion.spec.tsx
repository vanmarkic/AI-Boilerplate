import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from './accordion';

describe('Accordion (single mode)', () => {
  it('opens item on click', async () => {
    render(
      <Accordion.Root type="single">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(screen.getByText('Content A')).toBeInTheDocument();
  });

  it('opening B closes A (single mode)', async () => {
    render(
      <Accordion.Root type="single">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header><Accordion.Trigger>Item B</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content B</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(screen.getByText('Content A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Item B' }));
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });

  it('single non-collapsible: clicking open item does nothing', async () => {
    render(
      <Accordion.Root type="single" defaultValue="a">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    expect(screen.getByText('Content A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(screen.getByText('Content A')).toBeInTheDocument(); // still open
  });

  it('single collapsible: clicking open item closes it', async () => {
    render(
      <Accordion.Root type="single" defaultValue="a" collapsible>
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
  });

  it('fires onValueChange with string', async () => {
    const onChange = vi.fn();
    render(
      <Accordion.Root type="single" onValueChange={onChange}>
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('disabled item cannot toggle', async () => {
    render(
      <Accordion.Root type="single">
        <Accordion.Item value="a" disabled>
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(screen.queryByText('Content A')).not.toBeInTheDocument();
  });
});

describe('Accordion (multiple mode)', () => {
  it('multiple items can be open simultaneously', async () => {
    render(
      <Accordion.Root type="multiple">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="b">
          <Accordion.Header><Accordion.Trigger>Item B</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content B</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    await userEvent.click(screen.getByRole('button', { name: 'Item B' }));
    expect(screen.getByText('Content A')).toBeInTheDocument();
    expect(screen.getByText('Content B')).toBeInTheDocument();
  });

  it('fires onValueChange with string[]', async () => {
    const onChange = vi.fn();
    render(
      <Accordion.Root type="multiple" onValueChange={onChange}>
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Item A' }));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });
});

describe('Accordion (ARIA)', () => {
  it('Trigger has aria-expanded, aria-controls', () => {
    render(
      <Accordion.Root type="single" defaultValue="a">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Item A' });
    const content = screen.getByRole('region');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
  });

  it('Content has role=region, aria-labelledby', () => {
    render(
      <Accordion.Root type="single" defaultValue="a">
        <Accordion.Item value="a">
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Item A' });
    const content = screen.getByRole('region');
    expect(content).toHaveAttribute('aria-labelledby', trigger.id);
  });

  it('disabled item has data-disabled and aria-disabled', () => {
    render(
      <Accordion.Root type="single">
        <Accordion.Item value="a" disabled>
          <Accordion.Header><Accordion.Trigger>Item A</Accordion.Trigger></Accordion.Header>
          <Accordion.Content>Content A</Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Item A' });
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('data-disabled');
  });
});
