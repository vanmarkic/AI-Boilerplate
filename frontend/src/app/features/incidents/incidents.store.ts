import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withResource } from '../../shared/data/with-resource';
import { Incident, HistogramData, IncidentFilters } from './incidents.types';

export interface IncidentsState {
  incidents: Incident[];
  histogramData: HistogramData[];
  filters: IncidentFilters;
}

const initialState: IncidentsState = {
  incidents: [],
  histogramData: [],
  filters: {},
};

export const IncidentsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withResource<Incident>(),
  withMethods((store) => ({
    async loadIncident(id: number): Promise<void> {
      const result = await store.run('load incident', async () => {
        // TODO: Replace with generated API client after running make generate
        // Example: const { data } = await getIncident({ path: { incident_id: id } });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { item: result });
      }
    },

    async loadIncidents(filters: IncidentFilters): Promise<void> {
      const result = await store.run('load incidents', async () => {
        // TODO: Replace with generated API client after running make generate
        // Example: const { data } = await listIncidents({ query: filters });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { incidents: result });
      }
    },

    async loadHistogramData(period: string, severity?: string): Promise<void> {
      const result = await store.run('load histogram', async () => {
        // TODO: Replace with generated API client after running make generate
        // Example: const { data } = await getHistogram({ query: { period, severity } });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { histogramData: result });
      }
    },

    updateFilters(filters: IncidentFilters): void {
      patchState(store, { filters });
    },
  })),
);
