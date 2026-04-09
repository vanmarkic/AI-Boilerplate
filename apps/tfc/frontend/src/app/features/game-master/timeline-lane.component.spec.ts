import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineLaneComponent } from './timeline-lane.component';
import type { TimelineItem, TimeScale } from './timeline-utils';

describe('TimelineLaneComponent', () => {
  let fixture: ComponentFixture<TimelineLaneComponent>;

  const scale: TimeScale = { totalMs: 120_000, pxPerMs: 0.01 };

  const items: TimelineItem[] = [
    { id: 'e1', label: 'Event A', startMs: 0, endMs: 30_000, lifecycle: 'running', kind: 'event', lane: 0 },
    { id: 'e2', label: 'Event B', startMs: 10_000, endMs: 50_000, lifecycle: 'scheduled', kind: 'event', lane: 1 },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineLaneComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineLaneComponent);
    fixture.componentRef.setInput('scale', scale);
  });

  it('renders one bar per item', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const bars = fixture.nativeElement.querySelectorAll('.timeline-bar');
    expect(bars.length).toBe(2);
  });

  it('sets data-lifecycle attribute on bars', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const bars = fixture.nativeElement.querySelectorAll('.timeline-bar');
    expect(bars[0].getAttribute('data-lifecycle')).toBe('running');
    expect(bars[1].getAttribute('data-lifecycle')).toBe('scheduled');
  });

  it('positions bars based on startMs and pxPerMs', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.timeline-bar') as HTMLElement;
    expect(bar.style.left).toBe('0px');
  });

  it('sets bar width from duration and scale', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.timeline-bar') as HTMLElement;
    // (30000 - 0) * 0.01 = 300px
    expect(bar.style.width).toBe('300px');
  });

  it('shows item labels inside bars', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Event A');
    expect(text).toContain('Event B');
  });

  it('emits itemSelected on bar click', () => {
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();

    let emittedId: string | undefined;
    fixture.componentInstance.itemSelected.subscribe((id: string) => (emittedId = id));

    const bar = fixture.nativeElement.querySelector('.timeline-bar') as HTMLElement;
    bar.click();

    expect(emittedId).toBe('e1');
  });

  it('renders empty lane when no items', () => {
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();
    const bars = fixture.nativeElement.querySelectorAll('.timeline-bar');
    expect(bars.length).toBe(0);
  });

  it('enforces minimum bar width of 4px', () => {
    const tinyItems: TimelineItem[] = [
      { id: 'e1', label: 'Tiny', startMs: 0, endMs: 1, lifecycle: 'scheduled', kind: 'event', lane: 0 },
    ];
    fixture.componentRef.setInput('items', tinyItems);
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('.timeline-bar') as HTMLElement;
    expect(parseFloat(bar.style.width)).toBeGreaterThanOrEqual(4);
  });
});
