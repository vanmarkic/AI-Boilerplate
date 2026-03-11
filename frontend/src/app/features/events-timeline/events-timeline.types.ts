export interface TimelineEvent {
  id: number;
  title: string;
  description: string;
  eventDate: Date;
  eventType: 'conference' | 'webinar' | 'meetup' | 'workshop' | 'other';
  location?: string;
  url?: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface EventsTimeline {
  id: number;
  title: string;
  description: string;
  eventDate: Date;
  eventType: string;
  location?: string;
  url?: string;
  status: string;
  createdAt: Date;
}
