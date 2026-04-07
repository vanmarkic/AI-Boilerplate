import { type CSSProperties, useMemo } from 'react';

export interface HistogramBar {
  value: number;
}

export interface HistogramLabel {
  index: number;
  text: string;
}

export type HistogramVariant = 'default' | 'success' | 'destructive' | 'muted';

export interface HistogramTimelineProps {
  bars: HistogramBar[];
  labels?: HistogramLabel[];
  ariaLabel: string;
  variant?: HistogramVariant;
}

export function HistogramTimeline({
  bars,
  labels = [],
  ariaLabel,
  variant = 'default',
}: HistogramTimelineProps) {
  const maxValue = useMemo(
    () => Math.max(...bars.map((b) => b.value), 1),
    [bars],
  );

  return (
    <div
      className="histogram-timeline"
      data-variant={variant}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="histogram-bars">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="histogram-bar"
            style={
              { '--bar-value': bar.value / maxValue } as CSSProperties
            }
          />
        ))}
      </div>
      {labels.length > 0 && (
        <div
          className="histogram-labels"
          style={{ '--bar-count': bars.length } as CSSProperties}
        >
          {labels.map((label) => (
            <span
              key={label.index}
              className="histogram-label"
              style={
                { '--label-position': label.index } as CSSProperties
              }
            >
              {label.text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
