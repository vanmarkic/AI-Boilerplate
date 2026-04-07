import { render, screen } from '@testing-library/react';
import { PageLayout } from './page-layout';

describe('PageLayout', () => {
  it('renders header, main, and footer sections', () => {
    render(
      <PageLayout header={<div>Header</div>} footer={<div>Footer</div>}>
        Main content
      </PageLayout>,
    );
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('omits header and footer when not provided', () => {
    const { container } = render(<PageLayout>Just main</PageLayout>);
    expect(container.querySelector('.page-layout-header')).toBeNull();
    expect(container.querySelector('.page-layout-footer')).toBeNull();
  });
});
