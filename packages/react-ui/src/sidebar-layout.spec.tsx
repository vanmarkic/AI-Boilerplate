import { render, screen } from '@testing-library/react';
import { SidebarLayout } from './sidebar-layout';

describe('SidebarLayout', () => {
  it('renders sidebar and main content', () => {
    render(
      <SidebarLayout sidebar={<nav>Sidebar nav</nav>}>
        Main content
      </SidebarLayout>,
    );
    expect(screen.getByText('Sidebar nav')).toBeInTheDocument();
    expect(screen.getByText('Main content')).toBeInTheDocument();
  });

  it('defaults to data-side="left"', () => {
    const { container } = render(
      <SidebarLayout sidebar={<div>Side</div>}>Main</SidebarLayout>,
    );
    expect(container.querySelector('.sidebar-layout')).toHaveAttribute(
      'data-side',
      'left',
    );
  });

  it('applies data-side="right" when side prop is right', () => {
    const { container } = render(
      <SidebarLayout side="right" sidebar={<div>Side</div>}>
        Main
      </SidebarLayout>,
    );
    expect(container.querySelector('.sidebar-layout')).toHaveAttribute(
      'data-side',
      'right',
    );
  });

  it('merges custom className', () => {
    const { container } = render(
      <SidebarLayout className="custom-class" sidebar={<div>Side</div>}>
        Main
      </SidebarLayout>,
    );
    const layout = container.querySelector('.sidebar-layout');
    expect(layout).toHaveClass('sidebar-layout');
    expect(layout).toHaveClass('custom-class');
  });

  it('passes through extra HTML attributes', () => {
    const { container } = render(
      <SidebarLayout data-testid="my-layout" sidebar={<div>Side</div>}>
        Main
      </SidebarLayout>,
    );
    expect(container.querySelector('.sidebar-layout')).toHaveAttribute(
      'data-testid',
      'my-layout',
    );
  });

  it('renders sidebar in aside element', () => {
    const { container } = render(
      <SidebarLayout sidebar={<div>Side</div>}>Main</SidebarLayout>,
    );
    expect(
      container.querySelector('aside.sidebar-layout-sidebar'),
    ).not.toBeNull();
  });

  it('renders main content in sidebar-layout-main div', () => {
    const { container } = render(
      <SidebarLayout sidebar={<div>Side</div>}>Main</SidebarLayout>,
    );
    expect(
      container.querySelector('.sidebar-layout-main'),
    ).not.toBeNull();
    expect(
      container.querySelector('.sidebar-layout-main')!.textContent,
    ).toBe('Main');
  });
});
