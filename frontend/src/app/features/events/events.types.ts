export interface TechnicalEvent {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  category: 'deployment' | 'incident' | 'release' | 'maintenance' | 'alert';
  severity: 'info' | 'warning' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface EventsTimelineData {
  events: TechnicalEvent[];
  totalEvents: number;
}
