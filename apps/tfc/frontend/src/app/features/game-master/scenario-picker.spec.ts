import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ScenarioPickerComponent } from './scenario-picker';
import { environment } from '../../core/environment';
import type { ScenarioResponse } from '../../core/scenario-api.service';
import type { ScenarioSelection } from './scenario-picker';

describe('ScenarioPickerComponent', () => {
  let fixture: ComponentFixture<ScenarioPickerComponent>;
  let component: ScenarioPickerComponent;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  const stubScenarios: ScenarioResponse[] = [
    {
      id: 1,
      title: 'Fire Drill',
      description: 'Basic fire scenario',
      domain_id: null,
      content: {
        phases: [],
        events: [
          { id: 'e1', title: 'Alarm', description: '', event_type: 'operational', scheduled_pt_ms: 0, duration_ms: null, dependencies: [], triggered_issues: [] },
          { id: 'e2', title: 'Evacuation', description: '', event_type: 'operational', scheduled_pt_ms: 5000, duration_ms: null, dependencies: [], triggered_issues: [] },
        ],
        issues: [
          { id: 'i1', title: 'Blocked Exit', description: '', trigger_mode: 'manual', trigger_time_pt_ms: null, trigger_event_id: null, auto_resolve_ms: 0 },
        ],
        decision_templates: [],
        default_time_factor: 2.0,
      },
      version: 3,
      created_at: '2026-03-17T00:00:00Z',
      updated_at: '2026-03-17T00:00:00Z',
    },
    {
      id: 2,
      title: 'Flood Response',
      description: '',
      domain_id: null,
      content: null,
      version: 1,
      created_at: '2026-03-17T00:00:00Z',
      updated_at: '2026-03-17T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScenarioPickerComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ScenarioPickerComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
    httpTesting.verify();
  });

  function flushScenarios(list: ScenarioResponse[] = stubScenarios): void {
    const req = httpTesting.expectOne(`${base}/api/scenarios`);
    expect(req.request.method).toBe('GET');
    req.flush(list);
    fixture.detectChanges();
  }

  it('fetches scenarios on init', () => {
    fixture.detectChanges(); // triggers ngOnInit
    flushScenarios();
    const cards = fixture.nativeElement.querySelectorAll('ui-card');
    expect(cards.length).toBe(2);
  });

  it('displays scenario titles', () => {
    fixture.detectChanges();
    flushScenarios();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fire Drill');
    expect(text).toContain('Flood Response');
  });

  it('shows event and issue counts from content', () => {
    fixture.detectChanges();
    flushScenarios();
    const badges = fixture.nativeElement.querySelectorAll('ui-badge');
    const badgeTexts = Array.from(badges).map((b) => (b as Element).textContent?.trim());
    expect(badgeTexts).toContain('2 Events');
    expect(badgeTexts).toContain('1 Issues');
  });

  it('shows 0 events/issues when content is null', () => {
    fixture.detectChanges();
    flushScenarios();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('0 Events');
    expect(text).toContain('0 Issues');
  });

  it('shows version badge', () => {
    fixture.detectChanges();
    flushScenarios();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('v3');
    expect(text).toContain('v1');
  });

  it('shows description or fallback text', () => {
    fixture.detectChanges();
    flushScenarios();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Basic fire scenario');
    expect(text).toContain('No description');
  });

  it('emits scenarioSelected when Select button is clicked', () => {
    fixture.detectChanges();
    flushScenarios();

    let emitted: ScenarioSelection | undefined;
    component.scenarioSelected.subscribe((s: ScenarioSelection) => (emitted = s));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const selectBtn = Array.from(buttons).find(
      (b) => (b as Element).textContent?.trim() === 'Select',
    ) as HTMLButtonElement;
    expect(selectBtn).toBeTruthy();
    selectBtn.click();

    expect(emitted).toBeDefined();
    expect(emitted!.scenario.id).toBe(1);
    expect(emitted!.scenario.title).toBe('Fire Drill');
  });

  it('shows empty state when no scenarios exist', () => {
    fixture.detectChanges();
    flushScenarios([]);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No scenarios found');
    expect(text).toContain('Scenario Builder');
  });

  it('shows error state on API failure', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/scenarios`);
    req.error(new ProgressEvent('error'));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Failed to load scenarios');
  });

  it('retries fetch when Retry button is clicked after error', () => {
    fixture.detectChanges();
    const req1 = httpTesting.expectOne(`${base}/api/scenarios`);
    req1.error(new ProgressEvent('error'));
    fixture.detectChanges();

    const retryBtn = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) => (b as Element).textContent?.trim() === 'Retry') as HTMLButtonElement;
    expect(retryBtn).toBeTruthy();
    retryBtn.click();
    fixture.detectChanges();

    flushScenarios();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Fire Drill');
    expect(text).not.toContain('Failed to load');
  });

  it('shows loading state before scenarios are fetched', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Loading scenarios');
    // Flush to prevent afterEach verify failure
    const req = httpTesting.expectOne(`${base}/api/scenarios`);
    req.flush([]);
  });
});
