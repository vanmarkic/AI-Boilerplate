import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTableTreeFilter } from './data-table-tree-filter';
import type { TreeFilterNode } from './data-table-tree-filter.types';

const options: TreeFilterNode[] = [
  {
    value: 'fruit',
    label: 'Fruits',
    children: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
    ],
  },
  { value: 'veg', label: 'Vegetables' },
];

describe('DataTableTreeFilter', () => {
  it('renders root-level nodes', () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} />);
    expect(screen.getByText('Fruits')).toBeInTheDocument();
    expect(screen.getByText('Vegetables')).toBeInTheDocument();
  });

  it('sets data-filter-id and data-position attributes', () => {
    const { container } = render(
      <DataTableTreeFilter filterId="cat" column="category" options={options} position="top" />,
    );
    const div = container.firstElementChild!;
    expect(div).toHaveAttribute('data-filter-id', 'cat');
    expect(div).toHaveAttribute('data-position', 'top');
  });

  it('defaults position to left', () => {
    const { container } = render(
      <DataTableTreeFilter filterId="cat" column="category" options={options} />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-position', 'left');
  });

  it('does not show children until parent is expanded', () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} />);
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });

  it('expands a parent node to reveal children', async () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} />);
    const toggle = screen.getByRole('button');
    await userEvent.click(toggle);

    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('collapses an expanded parent on second click', async () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} />);
    const toggle = screen.getByRole('button');

    await userEvent.click(toggle); // expand
    expect(screen.getByText('Apple')).toBeInTheDocument();

    await userEvent.click(toggle); // collapse
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
  });

  it('renders radio inputs in single mode (default)', () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} />);
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(2); // only root-level visible
  });

  it('renders checkbox inputs in multi mode', () => {
    render(<DataTableTreeFilter filterId="cat" column="category" options={options} multi />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2); // only root-level visible
  });

  it('selects a node and fires onSelectionChange', async () => {
    const onChange = vi.fn();
    render(
      <DataTableTreeFilter
        filterId="cat"
        column="category"
        options={options}
        onSelectionChange={onChange}
      />,
    );
    const radio = screen.getAllByRole('radio')[1]; // Vegetables
    await userEvent.click(radio);

    expect(onChange).toHaveBeenCalledWith({
      filterId: 'cat',
      selectedPaths: [['veg']],
    });
  });

  it('in single mode, selecting another node replaces previous selection', async () => {
    const onChange = vi.fn();
    render(
      <DataTableTreeFilter
        filterId="cat"
        column="category"
        options={options}
        onSelectionChange={onChange}
      />,
    );
    const radios = screen.getAllByRole('radio');
    await userEvent.click(radios[1]); // Vegetables
    await userEvent.click(radios[0]); // Fruits

    expect(onChange).toHaveBeenLastCalledWith({
      filterId: 'cat',
      selectedPaths: expect.arrayContaining([['fruit'], ['fruit', 'apple'], ['fruit', 'banana']]),
    });
    // Vegetables should no longer be selected (single mode clears previous)
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    const hasVeg = lastCall.selectedPaths.some((p: string[]) => p.length === 1 && p[0] === 'veg');
    expect(hasVeg).toBe(false);
  });

  it('multi mode deselects a node on second click', async () => {
    const onChange = vi.fn();
    render(
      <DataTableTreeFilter
        filterId="cat"
        column="category"
        options={options}
        multi
        onSelectionChange={onChange}
      />,
    );
    const checkbox = screen.getAllByRole('checkbox')[1]; // Vegetables
    await userEvent.click(checkbox); // select
    await userEvent.click(checkbox); // deselect

    expect(onChange).toHaveBeenLastCalledWith({
      filterId: 'cat',
      selectedPaths: [],
    });
  });

  it('multi mode allows selecting multiple nodes', async () => {
    const onChange = vi.fn();
    render(
      <DataTableTreeFilter
        filterId="cat"
        column="category"
        options={options}
        multi
        onSelectionChange={onChange}
      />,
    );

    // Expand fruits to see children
    await userEvent.click(screen.getByRole('button'));

    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes: Fruits, Apple, Banana, Vegetables
    await userEvent.click(checkboxes[3]); // Vegetables
    await userEvent.click(checkboxes[1]); // Apple

    expect(onChange).toHaveBeenLastCalledWith({
      filterId: 'cat',
      selectedPaths: expect.arrayContaining([['veg'], ['fruit', 'apple']]),
    });
  });

  it('selecting a parent selects all its descendants', async () => {
    const onChange = vi.fn();
    render(
      <DataTableTreeFilter
        filterId="cat"
        column="category"
        options={options}
        multi
        onSelectionChange={onChange}
      />,
    );

    // Expand fruits first
    await userEvent.click(screen.getByRole('button'));

    const checkboxes = screen.getAllByRole('checkbox');
    await userEvent.click(checkboxes[0]); // Fruits parent

    expect(onChange).toHaveBeenLastCalledWith({
      filterId: 'cat',
      selectedPaths: expect.arrayContaining([['fruit'], ['fruit', 'apple'], ['fruit', 'banana']]),
    });
  });

  it('applies custom className alongside base classes', () => {
    const { container } = render(
      <DataTableTreeFilter filterId="cat" column="category" options={options} className="custom" />,
    );
    expect(container.firstElementChild!.className).toBe('data-table-filter tree-filter custom');
  });
});
