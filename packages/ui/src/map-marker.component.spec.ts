import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { MapMarkerComponent } from './map-marker.component';
import type { MapCenter } from './map-view.types';

@Component({
  imports: [MapViewComponent, MapMarkerComponent],
  template: `
    <ui-map-view [styleUrl]="'http://localhost/tiles.json'">
      <ui-map-marker [lngLat]="position()" (markerClick)="clicked = true">
        <span class="test-content">Pin</span>
      </ui-map-marker>
    </ui-map-view>
  `,
})
class TestHost {
  position = signal<MapCenter>({ lng: -73.98, lat: 40.75 });
  clicked = false;
}

describe('MapMarkerComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should render host with map-marker class', () => {
    const el = fixture.nativeElement.querySelector('ui-map-marker');
    expect(el.classList.contains('map-marker')).toBe(true);
  });

  it('should project content', () => {
    const content = fixture.nativeElement.querySelector('.test-content');
    expect(content).toBeTruthy();
    expect(content.textContent).toBe('Pin');
  });

  it('should be rendered inside the map-view', () => {
    const mapView = fixture.nativeElement.querySelector('ui-map-view');
    const marker = mapView.querySelector('ui-map-marker');
    expect(marker).toBeTruthy();
  });
});
