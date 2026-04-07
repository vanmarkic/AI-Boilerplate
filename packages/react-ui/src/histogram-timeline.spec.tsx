import { render, screen } from '@testing-library/react';
import { HistogramTimeline } from './histogram-timeline';

describe('HistogramTimeline', () => {
  const bars = [{ value: 10 }, { value: 20 }, { value: 5 }];

  it('renders correct number of bars', () => {
    const { container } = render(<HistogramTimeline bars={bars} ariaLabel="Activity" />);
    expect(container.querySelectorAll('.histogram-bar')).toHaveLength(3);
  });

  it('normalizes bar values as CSS variable', () => {
    const { container } = render(<HistogramTimeline bars={bars} ariaLabel="Activity" />);
    const barEls = container.querySelectorAll<HTMLElement>('.histogram-bar');
    // Max is 20: 10/20=0.5, 20/20=1, 5/20=0.25
    expect(barEls[0].style.getPropertyValue('--bar-value')).toBe('0.5');
    expect(barEls[1].style.getPropertyValue('--bar-value')).toBe('1');
    expect(barEls[2].style.getPropertyValue('--bar-value')).toBe('0.25');
  });

  it('applies variant', () => {
    const { container } = render(<HistogramTimeline bars={bars} ariaLabel="X" variant="success" />);
    expect(container.querySelector('.histogram-timeline')).toHaveAttribute(
      'data-variant',
      'success',
    );
  });

  it('renders labels', () => {
    render(
      <HistogramTimeline
        bars={bars}
        ariaLabel="X"
        labels={[
          { index: 0, text: 'Start' },
          { index: 2, text: 'End' },
        ]}
      />,
    );
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('End')).toBeInTheDocument();
  });

  it('has accessible role and label', () => {
    render(<HistogramTimeline bars={bars} ariaLabel="Weekly activity" />);
    expect(screen.getByRole('img', { name: 'Weekly activity' })).toBeInTheDocument();
  });
});
