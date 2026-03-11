import { computed, patchState, signalStore, withMethods } from '@ngrx/signals';
import { withResource } from '../../shared/data/with-resource';
import { Event, EventHistogramBar, EventHistogramLabel } from './event.types';

export const EventStore = signalStore(
  { providedIn: 'root' },
  withResource<Event>(),
  withMethods((store) => ({
    async loadById(id: number): Promise<void> {
      const result = await store.run('load event', async () => {
        // TODO: Replace with generated API client function after running make generate
        // Example: const { data } = await getEvent({ path: { event_id: id } });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { item: result });
      }
    },
    async loadForTimeRange(startTime: Date, endTime: Date): Promise<void> {
      const result = await store.run('load events', async () => {
        // TODO: Replace with generated API client function after running make generate
        // Example: const { data } = await listEvents({ query: { start_time, end_time } });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { items: result });
      }
    },
  })),
);

export function createEventHistogramData(
  events: Event[],
  bucketSizeSeconds: number,
): { bars: EventHistogramBar[]; labels: EventHistogramLabel[] } {
  if (events.length === 0) {
    return { bars: [], labels: [] };
  }

  const timestamps = events.map(e => new Date(e.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  const buckets = new Map<number, number>();
  for (const ts of timestamps) {
    const bucket = Math.floor((ts - minTime) / (bucketSizeSeconds * 1000));
    buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
  }

  const maxBucket = Math.ceil((maxTime - minTime) / (bucketSizeSeconds * 1000));
  const bars: EventHistogramBar[] = [];
  for (let i = 0; i <= maxBucket; i++) {
    bars.push({ value: buckets.get(i) ?? 0 });
  }

  const labels: EventHistogramLabel[] = [];
  if (bars.length > 0) {
    labels.push({ index: 0, text: new Date(minTime).toLocaleTimeString() });
    if (bars.length > 1) {
      labels.push({
        index: Math.floor(bars.length / 2),
        text: new Date(minTime + (maxTime - minTime) / 2).toLocaleTimeString(),
      });
      labels.push({
        index: bars.length - 1,
        text: new Date(maxTime).toLocaleTimeString(),
      });
    }
  }

  return { bars, labels };
}
