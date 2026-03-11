import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { type Event } from './events.types';

interface ListEventsResponse {
  items: Array<{
    id: number;
    title: string;
    description: string;
    event_time: string;
    status: string;
    event_type: string;
    badge_variant: string;
  }>;
  total: number;
}

export const EventsStore = signalStore(
  withState({
    items: [] as Event[],
    loading: false,
    error: null as string | null,
  }),
  withMethods((store) => {
    const http = inject(HttpClient);
    return {
      async loadEvents(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const response = await firstValueFrom(
            http.get<ListEventsResponse>('/api/events')
          );
          const mappedItems: Event[] = response.items.map(item => ({
            id: String(item.id),
            title: item.title,
            description: item.description,
            time: item.event_time,
            status: item.status as 'upcoming' | 'in-progress' | 'completed',
            type: item.event_type as 'meeting' | 'deadline' | 'milestone' | 'notification',
            badge: item.badge_variant as 'default' | 'secondary' | 'destructive' | 'outline',
          }));
          patchState(store, { items: mappedItems });
        } catch {
          patchState(store, { error: 'Failed to load events' });
        } finally {
          patchState(store, { loading: false });
        }
      },
    };
  }),
);
