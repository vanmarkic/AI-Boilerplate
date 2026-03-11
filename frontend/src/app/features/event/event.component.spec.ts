import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { EventComponent } from './event.component';
import { EventStore } from './event.store';
import { Event } from './event.types';

describe('EventComponent', () => {
  let fixture: ComponentFixture<EventComponent>;

  const mockEvent: Event = {
    id: 1,
    timestamp: '2026-03-11T12:00:00Z',
    event_type: 'deployment',
    severity: 'info',
    description: 'Test deployment',
    created_by: 'user-123',
    metadata: {},
    created_at: '2026-03-11T12:00:00Z',
  };

  const mockStore = {
    item: signal<Event | null>(null),
    items: signal<Event[]>([]),
    loading: signal(false),
    error: signal<string | null>(null),
    run: vi.fn(),
    loadById: vi.fn(),
    loadForTimeRange: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventComponent],
      providers: [
        { provide: EventStore, useValue: mockStore },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EventComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading events...');
  });

  it('should show error state', () => {
    mockStore.error.set('Failed to load events');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load events');
  });

  it('should render histogram timeline when events exist', () => {
    mockStore.items.set([mockEvent]);
    fixture.detectChanges();
    const histogram = fixture.nativeElement.querySelector('app-histogram-timeline');
    expect(histogram).toBeTruthy();
  });

  it('should show event list with items', () => {
    mockStore.items.set([mockEvent]);
    fixture.detectChanges();
    const eventItems = fixture.nativeElement.querySelectorAll('.event-item');
    expect(eventItems.length).toBe(1);
    expect(eventItems[0].textContent).toContain('deployment');
  });

  it('should show no events message when empty', () => {
    mockStore.items.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No events found');
  });
});
