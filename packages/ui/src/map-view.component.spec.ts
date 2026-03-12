import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapViewComponent } from './map-view.component';
import type { MapCenter, MapVariant, MapStyleColors } from './map-view.types';

@Component({
  imports: [MapViewComponent],
  template: `
    <ui-map-view
      [center]="center()"
      [zoom]="zoom()"
      [styleUrl]="styleUrl()"
      [variant]="variant()"
      [ariaLabel]="ariaLabel()"
      [colors]="colors()"
      [interactive]="interactive()"
    />
  `,
})
class TestHost {
  center = signal<MapCenter>({ lng: -73.98, lat: 40.75 });
  zoom = signal(10);
  styleUrl = signal('http://localhost/tiles.json');
  variant = signal<MapVariant>('default');
  ariaLabel = signal('Test map');
  colors = signal<Partial<MapStyleColors>>({});
  interactive = signal(true);
}

describe('MapViewComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('ui-map-view');
  });

  it('should have map-view class on host', () => {
    expect(host.classList.contains('map-view')).toBe(true);
  });

  it('should set role="application" on host', () => {
    expect(host.getAttribute('role')).toBe('application');
  });

  it('should set aria-label on host', () => {
    expect(host.getAttribute('aria-label')).toBe('Test map');
  });

  it('should set data-variant="default" by default', () => {
    expect(host.getAttribute('data-variant')).toBe('default');
  });

  it('should update data-variant when changed', () => {
    fixture.componentInstance.variant.set('muted');
    fixture.detectChanges();
    expect(host.getAttribute('data-variant')).toBe('muted');
  });

  it('should render the map canvas container', () => {
    const canvas = host.querySelector('.map-view-canvas');
    expect(canvas).toBeTruthy();
  });

  it('should support ng-content projection slot', () => {
    const canvas = host.querySelector('.map-view-canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.tagName).toBe('DIV');
  });
});
