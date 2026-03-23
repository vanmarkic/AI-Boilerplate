import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WeatherComponent } from './weather.component';
import { WeatherStore } from './weather.store';
import { signal } from '@angular/core';
import { vi } from 'vitest';

describe('WeatherComponent', () => {
  let fixture: ComponentFixture<WeatherComponent>;

  const mockStore = {
    weather: signal(null),
    forecast: signal(null),
    loading: signal(false),
    error: signal(null),
    loadWeather: vi.fn(),
    loadForecast: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherComponent],
      providers: [{ provide: WeatherStore, useValue: mockStore }],
    }).compileComponents();
    fixture = TestBed.createComponent(WeatherComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });
});
