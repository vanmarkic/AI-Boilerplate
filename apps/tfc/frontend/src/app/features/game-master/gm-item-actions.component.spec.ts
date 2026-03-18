import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GmItemActionsComponent } from './gm-item-actions.component';
import type { EventSnapshot, IssueSnapshot } from '../../core/engine-api.service';
import { environment } from '../../core/environment';

describe('GmItemActionsComponent', () => {
  let fixture: ComponentFixture<GmItemActionsComponent>;

  const stubEvents: EventSnapshot[] = [
    {
      id: 'e1', title: 'Alert', description: '', event_type: 'operational',
      scheduled_pt_ms: 0, duration_ms: 10_000, dependencies: [],
      lifecycle: 'scheduled', started_at_pt_ms: null, completed_at_pt_ms: null,
    },
    {
      id: 'e2', title: 'Alarm', description: '', event_type: 'operational',
      scheduled_pt_ms: 5000, duration_ms: null, dependencies: [],
      lifecycle: 'running', started_at_pt_ms: 5000, completed_at_pt_ms: null,
    },
  ];

  const stubIssues: IssueSnapshot[] = [
    {
      id: 'i1', title: 'Blocked', description: '', trigger_mode: 'manual',
      auto_resolve_ms: 0, lifecycle: 'inactive',
      activated_at_pt_ms: null, resolved_at_pt_ms: null, released: false,
    },
    {
      id: 'i2', title: 'Fire', description: '', trigger_mode: 'auto',
      auto_resolve_ms: 30_000, lifecycle: 'active',
      activated_at_pt_ms: 1000, resolved_at_pt_ms: null, released: true,
    },
  ];

  const base = environment.apiBaseUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmItemActionsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GmItemActionsComponent);
    fixture.componentRef.setInput('events', stubEvents);
    fixture.componentRef.setInput('issues', stubIssues);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
  });

  it('renders event titles', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alert');
    expect(text).toContain('Alarm');
  });

  it('renders issue titles', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Blocked');
    expect(text).toContain('Fire');
  });

  it('shows Trigger button for scheduled events', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const triggerBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Trigger',
    );
    expect(triggerBtns.length).toBeGreaterThan(0);
  });

  it('shows Complete button for running events', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const completeBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Complete',
    );
    expect(completeBtns.length).toBe(1);
  });

  it('shows Activate button for inactive issues', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const activateBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Activate',
    );
    expect(activateBtns.length).toBe(1);
  });

  it('shows Mitigate and Resolve buttons for active issues', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(buttons).map((b) => (b as Element).textContent?.trim());
    expect(texts).toContain('Mitigate');
    expect(texts).toContain('Resolve');
  });

  it('emits triggerEvent when Trigger is clicked', () => {
    let emittedId: string | undefined;
    fixture.componentInstance.triggerEvent.subscribe((id: string) => (emittedId = id));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const triggerBtn = Array.from(buttons).find(
      (b) => (b as Element).textContent?.trim() === 'Trigger',
    ) as HTMLButtonElement;
    triggerBtn.click();

    expect(emittedId).toBe('e1');
  });

  it('emits activateIssue when Activate is clicked', () => {
    let emittedId: string | undefined;
    fixture.componentInstance.activateIssue.subscribe((id: string) => (emittedId = id));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const btn = Array.from(buttons).find(
      (b) => (b as Element).textContent?.trim() === 'Activate',
    ) as HTMLButtonElement;
    btn.click();

    expect(emittedId).toBe('i1');
  });

  it('uses domain terminology for card titles', () => {
    const text = fixture.nativeElement.textContent;
    // Default domain: "Event" and "Issue"
    expect(text).toContain('Event');
    expect(text).toContain('Issue');
  });

  it('shows empty messages when no events or issues', () => {
    fixture.componentRef.setInput('events', []);
    fixture.componentRef.setInput('issues', []);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No events loaded');
    expect(text).toContain('No issues loaded');
  });
});
