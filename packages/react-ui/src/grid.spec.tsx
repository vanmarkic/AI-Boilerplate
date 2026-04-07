import { render, screen } from '@testing-library/react';
import { Cell, Grid } from './grid';

describe('Grid', () => {
  it('renders with layout-grid class', () => {
    render(<Grid data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el).toHaveClass('layout-grid');
    expect(el.tagName).toBe('DIV');
  });

  it('sets --grid-cols CSS variable for numeric columns', () => {
    render(
      <Grid columns={4} data-testid="g">
        content
      </Grid>,
    );
    expect(screen.getByTestId('g').style.getPropertyValue('--grid-cols')).toBe('4');
  });

  it('sets gridTemplateColumns for string columns', () => {
    render(
      <Grid columns="2fr 1fr" data-testid="g">
        content
      </Grid>,
    );
    expect(screen.getByTestId('g').style.gridTemplateColumns).toBe('2fr 1fr');
  });

  it('does not set column styles when columns is undefined', () => {
    render(<Grid data-testid="g">content</Grid>);
    const el = screen.getByTestId('g');
    expect(el.style.getPropertyValue('--grid-cols')).toBe('');
    expect(el.style.gridTemplateColumns).toBe('');
  });

  it('emits data-gap with default md', () => {
    render(<Grid data-testid="g">content</Grid>);
    expect(screen.getByTestId('g')).toHaveAttribute('data-gap', 'md');
  });

  it('maps gap prop to data-gap', () => {
    render(
      <Grid gap="sm" data-testid="g">
        content
      </Grid>,
    );
    expect(screen.getByTestId('g')).toHaveAttribute('data-gap', 'sm');
  });

  it('applies fill inline styles when fill is true', () => {
    render(
      <Grid fill data-testid="g">
        content
      </Grid>,
    );
    const el = screen.getByTestId('g');
    // jsdom normalizes flex:1 to '1 1 0%' and minHeight:0 to '0px'
    expect(el.style.flex).toBe('1 1 0%');
    expect(el.style.minHeight).toBe('0px');
  });

  it('does not apply fill styles when fill is false', () => {
    render(<Grid data-testid="g">content</Grid>);
    expect(screen.getByTestId('g').style.flex).toBe('');
  });

  it('merges columns, fill, and caller style', () => {
    render(
      <Grid columns={3} fill style={{ color: 'red' }} data-testid="g">
        content
      </Grid>,
    );
    const el = screen.getByTestId('g');
    expect(el.style.getPropertyValue('--grid-cols')).toBe('3');
    expect(el.style.flex).toBe('1 1 0%');
    expect(el.style.color).toBe('red');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Grid as="nav" data-testid="g">
        content
      </Grid>,
    );
    expect(screen.getByTestId('g').tagName).toBe('NAV');
  });

  it('merges additional className', () => {
    render(
      <Grid className="p-md" data-testid="g">
        content
      </Grid>,
    );
    const el = screen.getByTestId('g');
    expect(el).toHaveClass('layout-grid');
    expect(el).toHaveClass('p-md');
  });

  it('spreads HTML attributes', () => {
    render(
      <Grid id="grid1" aria-label="stats" data-testid="g">
        content
      </Grid>,
    );
    const el = screen.getByTestId('g');
    expect(el).toHaveAttribute('id', 'grid1');
    expect(el).toHaveAttribute('aria-label', 'stats');
  });

  it('renders children', () => {
    render(
      <Grid>
        <span>child</span>
      </Grid>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});

describe('Cell', () => {
  it('renders as a plain div by default', () => {
    render(<Cell data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el.tagName).toBe('DIV');
  });

  it('applies no inline styles when no placement props given', () => {
    render(<Cell data-testid="c">content</Cell>);
    const el = screen.getByTestId('c');
    expect(el.style.gridColumn).toBe('');
    expect(el.style.gridColumnStart).toBe('');
    expect(el.style.gridRow).toBe('');
  });

  it('sets gridColumn for numeric span', () => {
    render(
      <Cell span={2} data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c').style.gridColumn).toBe('span 2');
  });

  it('sets gridColumn to 1 / -1 for span="full"', () => {
    render(
      <Cell span="full" data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c').style.gridColumn).toBe('1 / -1');
  });

  it('sets gridColumnStart for start prop', () => {
    render(
      <Cell start={2} data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c').style.gridColumnStart).toBe('2');
  });

  it('sets gridRow for rowSpan prop', () => {
    render(
      <Cell rowSpan={3} data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c').style.gridRow).toBe('span 3');
  });

  it('combines span and start', () => {
    render(
      <Cell start={2} span={2} data-testid="c">
        content
      </Cell>,
    );
    const el = screen.getByTestId('c');
    expect(el.style.gridColumn).toBe('span 2');
    expect(el.style.gridColumnStart).toBe('2');
  });

  it('renders as a different element via as prop', () => {
    render(
      <Cell as="li" data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c').tagName).toBe('LI');
  });

  it('merges className', () => {
    render(
      <Cell className="card" data-testid="c">
        content
      </Cell>,
    );
    expect(screen.getByTestId('c')).toHaveClass('card');
  });

  it('spreads HTML attributes', () => {
    render(
      <Cell id="c1" aria-label="wide" data-testid="c">
        content
      </Cell>,
    );
    const el = screen.getByTestId('c');
    expect(el).toHaveAttribute('id', 'c1');
    expect(el).toHaveAttribute('aria-label', 'wide');
  });

  it('renders children', () => {
    render(
      <Cell>
        <span>child</span>
      </Cell>,
    );
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});
