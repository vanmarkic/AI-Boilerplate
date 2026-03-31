import { createContext, useContext } from 'react';
import type { Map as MlMap } from 'maplibre-gl';

export interface MapViewContextValue {
  map: MlMap | null;
}

export const MapViewContext = createContext<MapViewContextValue>({ map: null });

export function useMapView(): MapViewContextValue {
  return useContext(MapViewContext);
}
