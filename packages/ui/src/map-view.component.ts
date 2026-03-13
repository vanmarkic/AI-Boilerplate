import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Map as MlMap, type AddLayerObject, type StyleSpecification } from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type {
  MapCenter,
  MapVariant,
  MapStyleColors,
  MapMoveEvent,
  MapLayerType,
  MapPaint,
  MapLayout,
} from './map-view.types';
import { resolveColors, applyColorsToMap } from './map-view.colors';
import { registerPmtilesProtocol } from './map-view.pmtiles';

@Component({
  selector: 'ui-map-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'map-view',
    '[attr.data-variant]': 'variant()',
    '[attr.aria-label]': 'ariaLabel()',
    'role': 'application',
  },
  template: `<div class="map-view-canvas" #mapContainer></div><ng-content />`,
})
export class MapViewComponent {
  readonly center = input<MapCenter>({ lng: 0, lat: 0 });
  readonly zoom = input<number>(2);
  readonly styleUrl = input.required<string | StyleSpecification>();
  readonly variant = input<MapVariant>('default');
  readonly ariaLabel = input<string>('Interactive map');
  readonly colors = input<Partial<MapStyleColors>>({});
  readonly interactive = input<boolean>(true);

  readonly mapMove = output<MapMoveEvent>();
  readonly mapLoad = output();

  readonly mapInstance = signal<MlMap | null>(null);

  private readonly container =
    viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly destroyRef = inject(DestroyRef);
  private readonly doc = inject(DOCUMENT);

  constructor() {
    afterNextRender(() => { this.initMap(); });

    effect(() => {
      const map = this.mapInstance();
      if (!map) return;
      const c = this.center();
      map.easeTo({ center: [c.lng, c.lat], duration: 300 });
    });

    effect(() => {
      const map = this.mapInstance();
      if (!map) return;
      map.easeTo({ zoom: this.zoom(), duration: 300 });
    });
  }

  registerLayer(
    id: string,
    source: GeoJSON,
    type: MapLayerType,
    paint: MapPaint,
    layout: MapLayout,
    minZoom?: number,
    maxZoom?: number,
  ): void {
    const map = this.mapInstance();
    if (!map) return;
    map.addSource(id, { type: 'geojson', data: source });
    const layerDef = {
      id,
      type,
      source: id,
      paint,
      layout,
      ...(minZoom != null ? { minzoom: minZoom } : {}),
      ...(maxZoom != null ? { maxzoom: maxZoom } : {}),
    } as unknown as AddLayerObject;
    map.addLayer(layerDef);
  }

  unregisterLayer(id: string): void {
    const map = this.mapInstance();
    if (!map) return;
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }

  updateSource(id: string, data: GeoJSON): void {
    const map = this.mapInstance();
    if (!map) return;
    const src = map.getSource(id);
    if (src && 'setData' in src) {
      (src as { setData: (d: GeoJSON) => void }).setData(data);
    }
  }

  private initMap(): void {
    registerPmtilesProtocol();
    const style = this.styleUrl();
    const isUrl = typeof style === 'string';

    const map = new MlMap({
      container: this.container().nativeElement,
      style,
      center: [this.center().lng, this.center().lat],
      zoom: this.zoom(),
      interactive: this.interactive(),
      attributionControl: false,
    });

    let destroyed = false;

    map.on('moveend', () => {
      if (destroyed) return;
      const c = map.getCenter();
      const b = map.getBounds();
      this.mapMove.emit({
        center: { lng: c.lng, lat: c.lat },
        zoom: map.getZoom(),
        bounds: {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest(),
        },
      });
    });

    map.on('load', () => {
      if (destroyed) return;
      if (isUrl) {
        const colors = resolveColors(this.colors(), this.doc);
        applyColorsToMap(map, colors);
      }
      this.mapInstance.set(map);
      this.mapLoad.emit();
    });

    this.destroyRef.onDestroy(() => { destroyed = true; map.remove(); });
  }
}
