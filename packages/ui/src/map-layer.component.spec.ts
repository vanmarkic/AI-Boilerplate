import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { GeoJSON } from 'geojson';
import { MapViewComponent } from './map-view.component';
import { MapLayerComponent } from './map-layer.component';
import type { MapLayerType, MapPaint } from './map-view.types';

const SAMPLE_GEOJSON: GeoJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [0, 0] },
      properties: { name: 'test' },
    },
  ],
};

@Component({
  imports: [MapViewComponent, MapLayerComponent],
  template: `
    <ui-map-view [styleUrl]="'http://localhost/tiles.json'">
      <ui-map-layer
        [id]="layerId()"
        [type]="layerType()"
        [source]="source()"
        [paint]="paint()"
      />
    </ui-map-view>
  `,
})
class TestHost {
  layerId = signal('test-layer');
  layerType = signal<MapLayerType>('circle');
  source = signal<GeoJSON>(SAMPLE_GEOJSON);
  paint = signal<MapPaint>({ 'circle-radius': 6 });
}

describe('MapLayerComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should render a hidden host element with map-layer class', () => {
    const el = fixture.nativeElement.querySelector('ui-map-layer');
    expect(el.classList.contains('map-layer')).toBe(true);
  });

  it('should be rendered inside the map-view', () => {
    const mapView = fixture.nativeElement.querySelector('ui-map-view');
    const layer = mapView.querySelector('ui-map-layer');
    expect(layer).toBeTruthy();
  });

  it('should have empty template (no visible DOM)', () => {
    const el: HTMLElement = fixture.nativeElement.querySelector('ui-map-layer');
    expect(el.children.length).toBe(0);
  });
});
