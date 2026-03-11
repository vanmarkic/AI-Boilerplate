import { computed } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { TimelineEvent } from './events-timeline.types';

interface EventsTimelineState {
  events: TimelineEvent[];
  loading: boolean;
  error: string | null;
}

const initialState: EventsTimelineState = {
  events: [],
  loading: false,
  error: null,
};

export const EventsTimelineStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        // TODO: Replace with generated API client function after running make generate
        // Example: const { data } = await listEventsTimelines();
        // For now, using mock data for development
        const mockEvents: TimelineEvent[] = [
          {
            id: 1,
            title: 'Angular 21 Release',
            description: 'Angular 21 is released with new features and improvements',
            eventDate: new Date('2025-06-01'),
            eventType: 'conference',
            location: 'Virtual',
            status: 'upcoming',
            createdAt: new Date(),
          },
          {
            id: 2,
            title: 'Web Performance Webinar',
            description: 'Learn optimization techniques for modern web apps',
            eventDate: new Date('2025-04-15'),
            eventType: 'webinar',
            url: 'https://example.com/webinar',
            status: 'upcoming',
            createdAt: new Date(),
          },
          {
            id: 3,
            title: 'TypeScript Deep Dive',
            description: 'Advanced TypeScript patterns and best practices',
            eventDate: new Date('2025-03-20'),
            eventType: 'workshop',
            location: 'New York',
            status: 'completed',
            createdAt: new Date(),
          },
        ];
        patchState(store, { events: mockEvents, loading: false });
      } catch (error) {
        patchState(store, {
          error: error instanceof Error ? error.message : 'Failed to load events',
          loading: false,
        });
      }
    },
  })),
);

export const selectEventsByStatus = (status: 'upcoming' | 'completed' | 'cancelled') =>
  computed(() => {
    const store = EventsTimelineStore;
    return store.events().filter((e) => e.status === status);
  });
