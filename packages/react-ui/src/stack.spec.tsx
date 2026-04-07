import { render, screen } from '@testing-library/react';
import { Stack } from './stack';

describe('Stack', () => {
  it('renders with stack class', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('stack');
    expect(el.tagName).toBe('DIV');
  });

  it('emits data-gap with default md', () => {
    render(<Stack data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).toHaveAttribute('data-gap', 'md');
  });

  it('maps gap prop to data-gap', () => {
    render(
      <Stack gap="lg" data-testid="s">
        content
      </Stack>,
    );
    expect(screen.getByTestId('s')).toHaveAttribute('data-gap', 'lg');
  });

  it('emits data-direction only for horizontal', () => {
    const { rerender } = render(<Stack data-testid="s">content</Stack>);
    expect(screen.getByTestId('s')).not.toHaveAttribute('data-direction');

    rerender(
      <Stack direction="horizontal" data-testid="s">
        content
      </Stack>,
    );
    expect(screen.getByTestId('s')).toHaveAttribute('data-direction', 'horizontal');
  });

  it('maps align and justify to data attributes', () => {
    render(
      <Stack align="center" justify="between" data-testid="s">
        content
      </Stack>,
    );
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('data-align', 'center');
    expect(el).toHaveAttribute('data-justify', 'between');
  });

  it('omits data-align and data-justify when undefined', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el).not.toHaveAttribute('data-align');
    expect(el).not.toHaveAttribute('data-justify');
  });

  it('applies fill inline styles when fill is true', () => {
    render(
      <Stack fill data-testid="s">
        content
      </Stack>,
    );
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('1 1 0%');
    expect(el.style.minHeight).toBe('0px');
  });

  it('does not apply fill styles when fill is false', () => {
    render(<Stack data-testid="s">content</Stack>);
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('');
  });

  it('merges caller style with fill styles', () => {
    render(
      <Stack fill style={{ color: 'red' }} data-testid="s">
        content
      </Stack>,
    );
    const el = screen.getByTestId('s');
    expect(el.style.flex).toBe('1 1 0%');
    expect(el.style.minHeight).toBe('0px');
    expect(el.style.color).toBe('red');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Stack as="section" data-testid="s">
        content
      </Stack>,
    );
    expect(screen.getByTestId('s').tagName).toBe('SECTION');
  });

  it('merges additional className', () => {
    render(
      <Stack className="card mb-sm" data-testid="s">
        content
      </Stack>,
    );
    const el = screen.getByTestId('s');
    expect(el).toHaveClass('stack');
    expect(el).toHaveClass('card');
    expect(el).toHaveClass('mb-sm');
  });

  it('spreads HTML attributes', () => {
    render(
      <Stack id="main" aria-label="test" data-testid="s">
        content
      </Stack>,
    );
    const el = screen.getByTestId('s');
    expect(el).toHaveAttribute('id', 'main');
    expect(el).toHaveAttribute('aria-label', 'test');
  });

  it('renders children', () => {
    render(
      <Stack>
        <span>child</span>
      </Stack>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
