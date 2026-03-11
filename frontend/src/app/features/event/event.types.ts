export interface Event {
  id: number;
  timestamp: string;
  event_type: 'deployment' | 'error' | 'metric' | 'alert';
  severity: 'info' | 'warning' | 'error' | 'critical';
  description: string;
  created_by: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EventHistogramBar {
  value: number;
}

export interface EventHistogramLabel {
  index: number;
  text: string;
}
