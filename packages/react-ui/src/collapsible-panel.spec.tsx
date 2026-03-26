import { render, screen } from '@testing-library/react';
import { CollapsiblePanel } from './collapsible-panel';

describe('CollapsiblePanel', () => {
  it('renders collapsed by default', () => {
    const { container } = render(
      <CollapsiblePanel header="Section">Content</CollapsiblePanel>,
    );
    expect(container.querySelector('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Section')).toBeInTheDocument();
  });

  it('renders open when open=true', () => {
    const { container } = render(
      <CollapsiblePanel header="Section" open>
        Content
      </CollapsiblePanel>,
    );
    expect(container.querySelector('details')).toHaveAttribute('open');
  });

  it('applies variant and size', () => {
    const { container } = render(
      <CollapsiblePanel header="X" variant="outline" size="sm">
        Y
      </CollapsiblePanel>,
    );
    const details = container.querySelector('details');
    expect(details).toHaveAttribute('data-variant', 'outline');
    expect(details).toHaveAttribute('data-size', 'sm');
  });
});
