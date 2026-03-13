import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { MapLayerComponent } from './map-layer.component';
import { MapPopupComponent } from './map-popup.component';
import type { GeoJSON } from 'geojson';
import type {
  MapCenter,
  MapFeatureEvent,
  MapLayerType,
  MapPaint,
} from './map-view.types';

const SAMPLE_GEOJSON: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.98, 40.75] },
      properties: { name: 'Times Square', category: 'landmark' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-73.97, 40.76] },
      properties: { name: 'Central Park', category: 'park' },
    },
  ],
};

@Component({
  imports: [MapViewComponent, MapLayerComponent, MapPopupComponent],
  template: `
    <ui-map-view [styleUrl]="'http://localhost/tiles.json'">
      <ui-map-layer
        [id]="'points'"
        [type]="layerType()"
        [source]="source()"
        [paint]="paint()"
        (featureHover)="onFeatureHover($event)"
      />
      @if (hoveredFeature()) {
        <ui-map-popup
          [lngLat]="hoveredFeature()!.lngLat"
          variant="tooltip"
          anchor="bottom"
          [offset]="8"
        >
          <span class="tooltip-name">{{ hoveredFeature()!.feature.properties['name'] }}</span>
          <span class="tooltip-category">{{ hoveredFeature()!.feature.properties['category'] }}</span>
        </ui-map-popup>
      }
    </ui-map-view>
  `,
})
class TooltipHoverHost {
  layerType = signal<MapLayerType>('circle');
  source = signal<GeoJSON>(SAMPLE_GEOJSON);
  paint = signal<MapPaint>({ 'circle-radius': 6, 'circle-color': '#3498db' });
  hoveredFeature = signal<MapFeatureEvent | null>(null);
  hoverCount = 0;

  onFeatureHover(event: MapFeatureEvent): void {
    this.hoverCount++;
    this.hoveredFeature.set(event);
  }

  clearHover(): void {
    this.hoveredFeature.set(null);
  }
}

describe('Map tooltip on hover', () => {
  let fixture: ComponentFixture<TooltipHoverHost>;
  let host: TooltipHoverHost;

  const fakeHoverEvent: MapFeatureEvent = {
    lngLat: { lng: -73.98, lat: 40.75 },
    feature: {
      properties: { name: 'Times Square', category: 'landmark' },
      geometry: { type: 'Point', coordinates: [-73.98, 40.75] },
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TooltipHoverHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TooltipHoverHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should not render tooltip when no feature is hovered', () => {
    const popup = fixture.nativeElement.querySelector('ui-map-popup');
    expect(popup).toBeNull();
  });

  it('should render tooltip when a feature is hovered', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('ui-map-popup');
    expect(popup).toBeTruthy();
  });

  it('should use tooltip variant (no close button)', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();

    const popup = fixture.nativeElement.querySelector('ui-map-popup');
    expect(popup.getAttribute('data-variant')).toBe('tooltip');
    const closeBtn = popup.querySelector('.map-popup-close');
    expect(closeBtn).toBeNull();
  });

  it('should display feature name in tooltip content', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();

    const name = fixture.nativeElement.querySelector('.tooltip-name');
    expect(name).toBeTruthy();
    expect(name.textContent).toBe('Times Square');
  });

  it('should display feature category in tooltip content', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();

    const category = fixture.nativeElement.querySelector('.tooltip-category');
    expect(category).toBeTruthy();
    expect(category.textContent).toBe('landmark');
  });

  it('should remove tooltip when hover is cleared', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-map-popup')).toBeTruthy();

    host.clearHover();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ui-map-popup')).toBeNull();
  });

  it('should update tooltip content when hovering a different feature', () => {
    host.hoveredFeature.set(fakeHoverEvent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.tooltip-name').textContent)
      .toBe('Times Square');

    const secondFeature: MapFeatureEvent = {
      lngLat: { lng: -73.97, lat: 40.76 },
      feature: {
        properties: { name: 'Central Park', category: 'park' },
        geometry: { type: 'Point', coordinates: [-73.97, 40.76] },
      },
    };
    host.hoveredFeature.set(secondFeature);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tooltip-name').textContent)
      .toBe('Central Park');
    expect(fixture.nativeElement.querySelector('.tooltip-category').textContent)
      .toBe('park');
  });

  it('should track hover count via featureHover handler', () => {
    expect(host.hoverCount).toBe(0);
    host.onFeatureHover(fakeHoverEvent);
    expect(host.hoverCount).toBe(1);
    host.onFeatureHover(fakeHoverEvent);
    expect(host.hoverCount).toBe(2);
  });

  it('should render the map layer inside the map view', () => {
    const mapView = fixture.nativeElement.querySelector('ui-map-view');
    const layer = mapView.querySelector('ui-map-layer');
    expect(layer).toBeTruthy();
    expect(layer.classList.contains('map-layer')).toBe(true);
  });
});
