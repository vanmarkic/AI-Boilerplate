import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders title and subtitle', () => {
    render(<PageHeader title="Admin" subtitle="Manage users" />);
    expect(screen.getByRole('heading', { name: 'Admin' })).toBeInTheDocument();
    expect(screen.getByText('Manage users')).toBeInTheDocument();
  });

  it('renders actions slot', () => {
    render(<PageHeader title="T" actions={<button>Add</button>} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('omits subtitle and actions when not provided', () => {
    const { container } = render(<PageHeader title="Title" />);
    expect(container.querySelector('.page-header-subtitle')).toBeNull();
    expect(container.querySelector('.page-header-actions')).toBeNull();
  });
});
