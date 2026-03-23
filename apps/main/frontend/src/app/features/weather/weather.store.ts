import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { Weather, Forecast } from './weather.types';

interface WeatherState {
  weather: Weather | null;
  forecast: Forecast | null;
  loading: boolean;
  error: string | null;
}

const initialState: WeatherState = {
  weather: null,
  forecast: null,
  loading: false,
  error: null,
};

export const WeatherStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    async loadWeather(city: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        // TODO: Replace with generated API client after running `make generate`
        // import { getCurrentWeather } from '../../shared/api/generated';
        // const { data } = await getCurrentWeather({ path: { city } });
        const response = await fetch(`/api/weather/${encodeURIComponent(city)}`);
        if (!response.ok) {
          throw new Error(`Weather API error: ${response.statusText}`);
        }
        const data = (await response.json()) as Weather;
        patchState(store, { weather: data, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load weather';
        patchState(store, { error: message, loading: false });
      }
    },

    async loadForecast(city: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await fetch(`/api/weather/${encodeURIComponent(city)}/forecast`);
        if (!response.ok) {
          throw new Error(`Forecast API error: ${response.statusText}`);
        }
        const data = (await response.json()) as Forecast;
        patchState(store, { forecast: data, loading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load forecast';
        patchState(store, { error: message, loading: false });
      }
    },
  })),
);
