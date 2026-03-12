import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Map as MlMap, Marker } from 'maplibre-gl';
import { MapViewComponent } from './map-view.component';
import type { MapCenter } from './map-view.types';

type PositionAnchor =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

@Component({
  selector: 'ui-map-marker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'map-marker' },
  template: `<ng-content />`,
})
export class MapMarkerComponent {
  readonly lngLat = input.required<MapCenter>();
  readonly draggable = input<boolean>(false);
  readonly anchor = input<string>('center');

  readonly markerClick = output();
  readonly dragEnd = output<MapCenter>();

  private readonly parent = inject(MapViewComponent);
  private readonly el: HTMLElement = inject(ElementRef).nativeElement as HTMLElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly markerInstance = signal<Marker | null>(null);

  constructor() {
    effect(() => {
      const map = this.parent.mapInstance();
      if (!map || this.markerInstance()) return;
      this.initMarker(map);
    });

    effect(() => {
      const marker = this.markerInstance();
      if (!marker) return;
      const pos = this.lngLat();
      marker.setLngLat([pos.lng, pos.lat]);
    });

    this.destroyRef.onDestroy(() => {
      this.markerInstance()?.remove();
    });
  }

  private initMarker(map: MlMap): void {
    const pos = this.lngLat();
    const marker = new Marker({
      element: this.el,
      draggable: this.draggable(),
      anchor: this.anchor() as PositionAnchor,
    })
      .setLngLat([pos.lng, pos.lat])
      .addTo(map);

    this.el.addEventListener('click', () => {
      this.markerClick.emit();
    });

    if (this.draggable()) {
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        this.dragEnd.emit({ lng: p.lng, lat: p.lat });
      });
    }

    this.markerInstance.set(marker);
  }
}
