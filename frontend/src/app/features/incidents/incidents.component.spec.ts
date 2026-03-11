import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncidentsComponent } from './incidents.component';
import { IncidentsStore } from './incidents.store';
import { signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

describe('IncidentsComponent', () => {
  let fixture: ComponentFixture<IncidentsComponent>;
  let component: IncidentsComponent;

  const mockStore = {
    incidents: signal([]),
    histogramData: signal([]),
    filters: signal({}),
    item: signal(null),
    loading: signal(false),
    error: signal(null),
    loadIncident: vi.fn(),
    loadIncidents: vi.fn(),
    loadHistogramData: vi.fn(),
    updateFilters: vi.fn(),
    run: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentsComponent, CommonModule, ReactiveFormsModule],
      providers: [
        { provide: IncidentsStore, useValue: mockStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load incidents on init', () => {
    fixture.detectChanges();
    expect(mockStore.loadIncidents).toHaveBeenCalled();
    expect(mockStore.loadHistogramData).toHaveBeenCalledWith('day');
  });

  it('should apply filters on button click', () => {
    component.filterForm.patchValue({ severity: 'critical' });
    component.applyFilters();
    expect(mockStore.updateFilters).toHaveBeenCalled();
    expect(mockStore.loadIncidents).toHaveBeenCalled();
  });

  it('should calculate bar height correctly', () => {
    const height = component.getBarHeight(5);
    expect(height).toBeGreaterThan(0);
  });

  it('should format date correctly', () => {
    const formatted = component.formatDate('2026-03-11');
    expect(formatted).toContain('Mar');
    expect(formatted).toContain('11');
  });

  it('should show loading state when incidents are loading', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading incidents');
  });

  it('should display incident list when data is available', () => {
    const incidents = [
      {
        id: 1,
        title: 'Database Outage',
        severity: 'critical',
        status: 'resolved',
        started_at: '2026-03-10T12:00:00Z',
        ended_at: '2026-03-10T13:00:00Z',
        description: 'Test',
        created_at: '2026-03-10T12:00:00Z',
        updated_at: '2026-03-10T12:00:00Z',
      },
    ];
    mockStore.incidents.set(incidents);
    mockStore.loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Database Outage');
  });
});
