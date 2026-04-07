import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from './data-table';

interface User {
  name: string;
  email: string;
  role: string;
}

const users: User[] = [
  { name: 'Bob', email: 'bob@test.com', role: 'user' },
  { name: 'Alice', email: 'alice@test.com', role: 'admin' },
];

const columns: DataTableColumn<User>[] = [
  { accessor: 'name', header: 'Name', sortable: true },
  { accessor: 'email', header: 'Email' },
  {
    accessor: 'role',
    header: 'Role',
    cell: (row) => <strong>{row.role}</strong>,
  },
];

describe('DataTable', () => {
  it('renders header cells and data rows', () => {
    render(<DataTable data={users} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
  });

  it('renders custom cell content', () => {
    render(<DataTable data={users} columns={columns} />);
    const adminCell = screen.getByText('admin');
    expect(adminCell.tagName).toBe('STRONG');
  });

  it('sorts ascending then descending on sortable column click', async () => {
    render(<DataTable data={users} columns={columns} />);
    const nameHeader = screen.getByText('Name');

    // Ascending: Alice before Bob
    await userEvent.click(nameHeader);
    let rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alice');
    expect(rows[2]).toHaveTextContent('Bob');

    // Descending: Bob before Alice
    await userEvent.click(nameHeader);
    rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Bob');
    expect(rows[2]).toHaveTextContent('Alice');
  });

  it('fires onRowClick for clickable rows', async () => {
    const onRowClick = vi.fn();
    render(<DataTable data={users} columns={columns} clickableRows onRowClick={onRowClick} />);
    await userEvent.click(screen.getByText('Bob'));
    expect(onRowClick).toHaveBeenCalledWith(users[0]);
  });

  it('supports keyboard Enter on clickable rows', async () => {
    const onRowClick = vi.fn();
    render(<DataTable data={users} columns={columns} clickableRows onRowClick={onRowClick} />);
    const firstRow = screen.getAllByRole('row')[1];
    firstRow.focus();
    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(users[0]);
  });
});
