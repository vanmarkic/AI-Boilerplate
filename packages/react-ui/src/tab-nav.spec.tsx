import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabNav, TabLink } from './tab-nav';

describe('TabNav / TabLink', () => {
  it('renders nav element wrapping tablist', () => {
    render(
      <TabNav value="tab1">
        <TabLink value="tab1">Tab 1</TabLink>
        <TabLink value="tab2">Tab 2</TabLink>
      </TabNav>,
    );
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('active tab has aria-selected=true', () => {
    render(
      <TabNav value="tab1">
        <TabLink value="tab1">Tab 1</TabLink>
        <TabLink value="tab2">Tab 2</TabLink>
      </TabNav>,
    );
    expect(screen.getByRole('tab', { name: 'Tab 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tab 2' })).toHaveAttribute('aria-selected', 'false');
  });

  it('fires onValueChange on click', async () => {
    const onChange = vi.fn();
    render(
      <TabNav value="tab1" onValueChange={onChange}>
        <TabLink value="tab1">Tab 1</TabLink>
        <TabLink value="tab2">Tab 2</TabLink>
      </TabNav>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Tab 2' }));
    expect(onChange).toHaveBeenCalledWith('tab2');
  });

  it('TabLink has role=tab and class tab-link', () => {
    render(
      <TabNav value="tab1">
        <TabLink value="tab1">Tab 1</TabLink>
      </TabNav>,
    );
    const tab = screen.getByRole('tab', { name: 'Tab 1' });
    expect(tab).toHaveClass('tab-link');
  });
});
