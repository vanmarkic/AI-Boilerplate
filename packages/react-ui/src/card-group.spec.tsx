import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardGroup } from './card-group';

describe('CardGroup', () => {
  it('renders title and count', () => {
    render(<CardGroup title="Alerts" count={5} />);
    expect(screen.getByText('Alerts')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('defaults to aggregated mode', () => {
    const { container } = render(<CardGroup title="G">Content</CardGroup>);
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'aggregated');
  });

  it('shows summary in aggregated mode', () => {
    render(
      <CardGroup title="G" summary={<span>Summary text</span>}>
        Items
      </CardGroup>,
    );
    expect(screen.getByText('Summary text')).toBeInTheDocument();
    expect(screen.queryByText('Items')).toBeNull();
  });

  it('shows children in disaggregated mode', () => {
    render(
      <CardGroup title="G" mode="disaggregated" summary={<span>Summary</span>}>
        Items here
      </CardGroup>,
    );
    expect(screen.getByText('Items here')).toBeInTheDocument();
    expect(screen.queryByText('Summary')).toBeNull();
  });

  it('toggles mode on click', async () => {
    const { container } = render(
      <CardGroup title="G" summary={<span>Sum</span>}>
        Detail
      </CardGroup>,
    );
    const toggle = screen.getByRole('button');
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'aggregated');

    await userEvent.click(toggle);
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'disaggregated');

    await userEvent.click(toggle);
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'aggregated');
  });

  it('calls onModeChange when toggled', async () => {
    const onModeChange = vi.fn();
    render(<CardGroup title="G" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onModeChange).toHaveBeenCalledWith('disaggregated');
  });

  it('respects controlled mode', () => {
    const { container } = render(
      <CardGroup title="G" mode="disaggregated">
        Child
      </CardGroup>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-mode', 'disaggregated');
  });

  it('sets aria-expanded based on mode', async () => {
    render(<CardGroup title="G" />);
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  it('merges custom className', () => {
    const { container } = render(<CardGroup title="G" className="extra" />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('card-group');
    expect(el).toHaveClass('extra');
  });

  it('defaults count to 0', () => {
    render(<CardGroup title="G" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
