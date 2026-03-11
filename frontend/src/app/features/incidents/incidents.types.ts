export interface Incident {
  id: number;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'ongoing' | 'resolved';
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HistogramData {
  period: string;
  count: number;
}

export interface IncidentFilters {
  severity?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}
