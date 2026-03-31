import type { GeoJSON } from 'geojson';

export interface MapCenter {
  lng: number;
  lat: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type MapVariant = 'default' | 'satellite' | 'muted';

export type MapLayerType = 'fill' | 'line' | 'circle' | 'symbol' | 'heatmap';

export type MapPaint = Record<
  string,
  string | number | boolean | readonly (string | number | boolean)[]
>;

export type MapLayout = Record<
  string,
  string | number | boolean | readonly (string | number | boolean)[]
>;

export interface MapMoveEvent {
  center: MapCenter;
  zoom: number;
  bounds: MapBounds;
}

export interface MapFeatureEvent {
  lngLat: MapCenter;
  feature: {
    properties: Record<string, unknown>;
    geometry: GeoJSON.Geometry;
  };
}

export interface MapStyleColors {
  water: string;
  land: string;
  roads: string;
  buildings: string;
  labels: string;
  background: string;
}

export type MapPopupAnchor =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export type MapPopupVariant = 'default' | 'tooltip';

export interface MapLayerRegistration {
  id: string;
  type: MapLayerType;
  source: GeoJSON;
  paint: MapPaint;
  layout: MapLayout;
  minZoom?: number;
  maxZoom?: number;
}
