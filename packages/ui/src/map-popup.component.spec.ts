import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import { MapPopupComponent } from './map-popup.component';
import type { MapCenter, MapPopupVariant } from './map-view.types';

@Component({
  imports: [MapViewComponent, MapPopupComponent],
  template: `
    <ui-map-view [styleUrl]="'http://localhost/tiles.json'">
      <ui-map-popup
        [lngLat]="position()"
        [variant]="variant()"
        (closed)="closedCount = closedCount + 1"
      >
        <span class="popup-body">Hello {{ name() }}</span>
      </ui-map-popup>
    </ui-map-view>
  `,
})
class TestHost {
  position = signal<MapCenter>({ lng: -73.98, lat: 40.75 });
  variant = signal<MapPopupVariant>('default');
  name = signal('World');
  closedCount = 0;
}

describe('MapPopupComponent', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
  });

  it('should render host with map-popup class', () => {
    const el = fixture.nativeElement.querySelector('ui-map-popup');
    expect(el.classList.contains('map-popup')).toBe(true);
  });

  it('should set data-variant on host', () => {
    const el = fixture.nativeElement.querySelector('ui-map-popup');
    expect(el.getAttribute('data-variant')).toBe('default');
  });

  it('should project custom content', () => {
    const body = fixture.nativeElement.querySelector('.popup-body');
    expect(body).toBeTruthy();
    expect(body.textContent).toBe('Hello World');
  });

  it('should update projected content reactively', () => {
    fixture.componentInstance.name.set('Angular');
    fixture.detectChanges();
    const body = fixture.nativeElement.querySelector('.popup-body');
    expect(body.textContent).toBe('Hello Angular');
  });

  it('should render close button for default variant', () => {
    const btn = fixture.nativeElement.querySelector('.map-popup-close');
    expect(btn).toBeTruthy();
  });

  it('should hide close button for tooltip variant', () => {
    fixture.componentInstance.variant.set('tooltip');
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.map-popup-close');
    expect(btn).toBeNull();
  });

  it('should emit closed when close button is clicked', () => {
    const btn: HTMLButtonElement =
      fixture.nativeElement.querySelector('.map-popup-close');
    btn.click();
    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('should update data-variant when changed', () => {
    fixture.componentInstance.variant.set('tooltip');
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('ui-map-popup');
    expect(el.getAttribute('data-variant')).toBe('tooltip');
  });
});
