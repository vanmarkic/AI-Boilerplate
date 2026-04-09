import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InjectTimelineComponent } from './inject-timeline.component';
import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';

describe('InjectTimelineComponent', () => {
  let fixture: ComponentFixture<InjectTimelineComponent>;

  const stubInjects: InjectSnapshot[] = [
    {
      id: 'e1', title: 'Inject 1', description: '', inject_type: 'operational',
      scheduled_pt_ms: 0, duration_ms: 30_000, dependencies: [],
      lifecycle: 'running', started_at_pt_ms: 0, completed_at_pt_ms: null,
    },
    {
      id: 'e2', title: 'Inject 2', description: '', inject_type: 'operational',
      scheduled_pt_ms: 60_000, duration_ms: 20_000, dependencies: [],
      lifecycle: 'scheduled', started_at_pt_ms: null, completed_at_pt_ms: null,
    },
  ];

  const stubDefects: DefectSnapshot[] = [
    {
      id: 'i1', title: 'Defect 1', description: '', trigger_mode: 'manual',
      auto_resolve_pt_ms: 60_000, lifecycle: 'active',
      activated_at_pt_ms: 10_000, resolved_at_pt_ms: null, released: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InjectTimelineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InjectTimelineComponent);
  });

  it('renders the timeline container', () => {
    fixture.detectChanges();
    const container = fixture.nativeElement.querySelector('.timeline-container');
    expect(container).toBeTruthy();
  });

  it('renders inject and defect lane groups', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('defects', stubDefects);
    fixture.componentRef.setInput('playTimeMs', 15_000);
    fixture.detectChanges();

    const groups = fixture.nativeElement.querySelectorAll('.timeline-lane-group');
    expect(groups.length).toBe(2);
  });

  it('renders lane group labels for Injects and Defects', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('defects', stubDefects);
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll('.timeline-lane-group__label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent).toContain('Inject');
    expect(labels[1].textContent).toContain('Defect');
  });

  it('renders the NOW marker', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('playTimeMs', 15_000);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('.timeline-now-marker');
    expect(marker).toBeTruthy();
  });

  it('positions NOW marker based on playTimeMs', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('playTimeMs', 30_000);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector('.timeline-now-marker') as HTMLElement;
    const leftPx = parseFloat(marker.style.left);
    expect(leftPx).toBeGreaterThan(0);
  });

  it('renders axis ticks', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('playTimeMs', 60_000);
    fixture.detectChanges();

    const ticks = fixture.nativeElement.querySelectorAll('.timeline-tick');
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('renders timeline-lane components for injects and defects', () => {
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('defects', stubDefects);
    fixture.componentRef.setInput('playTimeMs', 15_000);
    fixture.detectChanges();

    const lanes = fixture.nativeElement.querySelectorAll('tfc-timeline-lane');
    expect(lanes.length).toBe(2);
  });

  it('renders with empty injects and defects', () => {
    fixture.componentRef.setInput('injects', []);
    fixture.componentRef.setInput('defects', []);
    fixture.componentRef.setInput('playTimeMs', 0);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.timeline-container');
    expect(container).toBeTruthy();
  });
});
