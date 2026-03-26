import { render, screen } from '@testing-library/react';
import { TabNav, TabLink } from './tab-nav';

describe('TabNav + TabLink', () => {
  it('renders tab links inside nav', () => {
    render(
      <TabNav>
        <TabLink href="/a">Tab A</TabLink>
        <TabLink href="/b" active>Tab B</TabLink>
      </TabNav>,
    );
    expect(screen.getByText('Tab A')).toHaveClass('tab-link');
    expect(screen.getByText('Tab A')).not.toHaveClass('active');
    expect(screen.getByText('Tab B')).toHaveClass('tab-link', 'active');
  });
});
