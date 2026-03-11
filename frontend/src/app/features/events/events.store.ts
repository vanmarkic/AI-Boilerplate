import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { type Event } from './events.types';

// Mock data provider - replace with actual API call
async function fetchEvents(): Promise<Event[]> {
  return [
    {
      id: '1',
      title: 'Team standup',
      description: 'Daily sync with engineering team',
      time: 'Today at 10:00 AM',
      status: 'upcoming',
      type: 'meeting',
      badge: 'outline',
    },
    {
      id: '2',
      title: 'Release v2.5.0',
      description: 'Production deployment scheduled',
      time: 'Today at 2:00 PM',
      status: 'upcoming',
      type: 'milestone',
      badge: 'default',
    },
    {
      id: '3',
      title: 'Database maintenance',
      description: 'Scheduled backup and optimization',
      time: 'Today at 6:00 PM',
      status: 'upcoming',
      type: 'deadline',
      badge: 'secondary',
    },
    {
      id: '4',
      title: 'Code review complete',
      description: 'PR #1247 approved and merged',
      time: '2 hours ago',
      status: 'completed',
      type: 'notification',
      badge: 'default',
    },
    {
      id: '5',
      title: 'Performance optimization',
      description: 'API response time reduced by 25%',
      time: '1 day ago',
      status: 'completed',
      type: 'milestone',
      badge: 'default',
    },
  ];
}

export const EventsStore = signalStore(
  withState({
    items: [] as Event[],
    loading: false,
    error: null as string | null,
  }),
  withMethods((store) => ({
    async loadEvents(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const items = await fetchEvents();
        patchState(store, { items });
      } catch {
        patchState(store, { error: 'Failed to load events' });
      } finally {
        patchState(store, { loading: false });
      }
    },
  })),
);
