import { render, screen } from '@testing-library/react';
import { Portal } from './portal';

describe('Portal', () => {
  it('renders children at document.body', () => {
    const { container } = render(
      <div data-testid="parent">
        <Portal>
          <span data-testid="child">Hello</span>
        </Portal>
      </div>,
    );
    // Child should NOT be inside parent container
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
    // But should exist in body
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders into custom container', () => {
    const custom = document.createElement('div');
    document.body.appendChild(custom);
    render(
      <Portal container={custom}>
        <span data-testid="custom-child">Custom</span>
      </Portal>,
    );
    expect(custom.querySelector('[data-testid="custom-child"]')).not.toBeNull();
    document.body.removeChild(custom);
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(
      <Portal>
        <span data-testid="ephemeral">Gone</span>
      </Portal>,
    );
    expect(screen.getByTestId('ephemeral')).toBeInTheDocument();
    unmount();
    expect(screen.queryByTestId('ephemeral')).not.toBeInTheDocument();
  });
});
