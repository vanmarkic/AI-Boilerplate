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
import { Popup } from 'maplibre-gl';
import { MapViewComponent } from './map-view.component';
import type { MapCenter, MapPopupAnchor, MapPopupVariant } from './map-view.types';

@Component({
  selector: 'ui-map-popup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'map-popup',
    '[attr.data-variant]': 'variant()',
  },
  template: `
    <div class="map-popup-content">
      <ng-content />
    </div>
    @if (variant() !== 'tooltip') {
      <button
        class="map-popup-close"
        type="button"
        aria-label="Close popup"
        (click)="closed.emit()"
      >&times;</button>
    }
  `,
})
export class MapPopupComponent {
  readonly lngLat = input.required<MapCenter>();
  readonly anchor = input<MapPopupAnchor>('bottom');
  readonly variant = input<MapPopupVariant>('default');
  readonly offset = input<number>(12);
  readonly closeOnMapClick = input<boolean>(true);

  readonly closed = output();

  private readonly parent = inject(MapViewComponent);
  private readonly el: HTMLElement = inject(ElementRef).nativeElement as HTMLElement;
  private readonly destroyRef = inject(DestroyRef);
  private readonly popupInstance = signal<Popup | null>(null);

  constructor() {
    effect(() => {
      const map = this.parent.mapInstance();
      if (!map || this.popupInstance()) return;
      this.initPopup(map);
    });

    effect(() => {
      const popup = this.popupInstance();
      if (!popup) return;
      const pos = this.lngLat();
      popup.setLngLat([pos.lng, pos.lat]);
    });

    this.destroyRef.onDestroy(() => {
      this.popupInstance()?.remove();
    });
  }

  private initPopup(map: Parameters<Popup['addTo']>[0]): void {
    const pos = this.lngLat();
    const popup = new Popup({
      closeButton: false,
      closeOnClick: this.closeOnMapClick(),
      anchor: this.anchor(),
      offset: this.offset(),
      className: 'map-popup-container',
    })
      .setDOMContent(this.el)
      .setLngLat([pos.lng, pos.lat])
      .addTo(map);

    popup.on('close', () => {
      this.closed.emit();
    });

    this.popupInstance.set(popup);
  }
}
