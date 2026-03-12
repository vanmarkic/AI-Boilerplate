import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import type { GeoJSON } from 'geojson';
import type { MapLayerMouseEvent } from 'maplibre-gl';
import { MapViewComponent } from './map-view.component';
import type {
  MapLayerType,
  MapPaint,
  MapLayout,
  MapFeatureEvent,
} from './map-view.types';

@Component({
  selector: 'ui-map-layer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'map-layer' },
  template: '',
})
export class MapLayerComponent {
  readonly id = input.required<string>();
  readonly type = input.required<MapLayerType>();
  readonly source = input.required<GeoJSON>();
  readonly paint = input<MapPaint>({});
  readonly layout = input<MapLayout>({});
  readonly minZoom = input<number | undefined>(undefined);
  readonly maxZoom = input<number | undefined>(undefined);

  readonly cursor = input<string>('pointer');

  readonly featureClick = output<MapFeatureEvent>();
  readonly featureHover = output<MapFeatureEvent>();

  private readonly parent = inject(MapViewComponent);
  private readonly destroyRef = inject(DestroyRef);
  private registered = false;
  private clickHandler: ((e: MapLayerMouseEvent) => void) | null = null;
  private hoverHandler: ((e: MapLayerMouseEvent) => void) | null = null;
  private enterHandler: (() => void) | null = null;
  private leaveHandler: (() => void) | null = null;

  constructor() {
    effect(() => {
      const map = this.parent.mapInstance();
      if (!map || this.registered) return;
      this.registered = true;
      this.parent.registerLayer(
        this.id(),
        this.source(),
        this.type(),
        this.paint(),
        this.layout(),
        this.minZoom(),
        this.maxZoom(),
      );
      this.wireEvents();
    });

    effect(() => {
      if (!this.registered) return;
      this.parent.updateSource(this.id(), this.source());
    });

    effect(() => {
      const map = this.parent.mapInstance();
      if (!map || !this.registered) return;
      const p = this.paint();
      for (const [key, value] of Object.entries(p)) {
        map.setPaintProperty(this.id(), key, value);
      }
    });

    effect(() => {
      const map = this.parent.mapInstance();
      if (!map || !this.registered) return;
      const l = this.layout();
      for (const [key, value] of Object.entries(l)) {
        map.setLayoutProperty(this.id(), key, value);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.removeEvents();
      if (this.registered) {
        this.parent.unregisterLayer(this.id());
      }
    });
  }

  private wireEvents(): void {
    const map = this.parent.mapInstance();
    if (!map) return;
    const layerId = this.id();

    this.clickHandler = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      this.featureClick.emit(this.toFeatureEvent(e, feat));
    };

    this.hoverHandler = (e: MapLayerMouseEvent) => {
      const feat = e.features?.[0];
      if (!feat) return;
      this.featureHover.emit(this.toFeatureEvent(e, feat));
    };

    map.on('click', layerId, this.clickHandler);
    map.on('mousemove', layerId, this.hoverHandler);

    const canvas = map.getCanvas();
    const cursorStyle = this.cursor();
    this.enterHandler = () => { canvas.style.cursor = cursorStyle; };
    this.leaveHandler = () => { canvas.style.cursor = ''; };
    map.on('mouseenter', layerId, this.enterHandler);
    map.on('mouseleave', layerId, this.leaveHandler);
  }

  private removeEvents(): void {
    const map = this.parent.mapInstance();
    if (!map) return;
    const layerId = this.id();
    if (this.clickHandler) map.off('click', layerId, this.clickHandler);
    if (this.hoverHandler) map.off('mousemove', layerId, this.hoverHandler);
    if (this.enterHandler) map.off('mouseenter', layerId, this.enterHandler);
    if (this.leaveHandler) map.off('mouseleave', layerId, this.leaveHandler);
  }

  private toFeatureEvent(
    e: MapLayerMouseEvent,
    feat: { properties?: Record<string, unknown> | null; geometry: GeoJSON.Geometry },
  ): MapFeatureEvent {
    return {
      lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat },
      feature: {
        properties: feat.properties ?? {},
        geometry: feat.geometry,
      },
    };
  }
}
