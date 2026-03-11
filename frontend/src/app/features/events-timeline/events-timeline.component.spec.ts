import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventsTimelineComponent } from './events-timeline.component';
import { EventsTimelineStore } from './events-timeline.store';
import { signal } from '@angular/core';
import { TimelineEvent } from './events-timeline.types';

describe('EventsTimelineComponent', () => {
  let fixture: ComponentFixture<EventsTimelineComponent>;

  const mockEvents: TimelineEvent[] = [
    {
      id: 1,
      title: 'Test Event',
      description: 'A test event',
      eventDate: new Date('2025-04-01'),
      eventType: 'conference',
      status: 'upcoming',
      createdAt: new Date(),
    },
  ];

  const mockStore = {
    events: signal(mockEvents),
    loading: signal(false),
    error: signal(null),
    loadAll: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsTimelineComponent],
      providers: [{ provide: EventsTimelineStore, useValue: mockStore }],
    }).compileComponents();
    fixture = TestBed.createComponent(EventsTimelineComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state', () => {
    mockStore.loading.set(true);
    mockStore.events.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading events');
  });

  it('should display events when loaded', () => {
    mockStore.loading.set(false);
    mockStore.events.set(mockEvents);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Test Event');
  });

  it('should call loadAll on init', () => {
    expect(mockStore.loadAll).toHaveBeenCalled();
  });
});
