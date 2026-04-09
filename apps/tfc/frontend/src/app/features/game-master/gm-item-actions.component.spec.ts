import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GmItemActionsComponent } from './gm-item-actions.component';
import type { InjectSnapshot, DefectSnapshot } from '../../core/engine-api.service';

describe('GmItemActionsComponent', () => {
  let fixture: ComponentFixture<GmItemActionsComponent>;

  const stubInjects: InjectSnapshot[] = [
    {
      id: 'e1', title: 'Alert', description: '', inject_type: 'operational',
      scheduled_pt_ms: 0, duration_ms: 10_000, dependencies: [],
      lifecycle: 'scheduled', started_at_pt_ms: null, completed_at_pt_ms: null,
    },
    {
      id: 'e2', title: 'Alarm', description: '', inject_type: 'operational',
      scheduled_pt_ms: 5000, duration_ms: null, dependencies: [],
      lifecycle: 'running', started_at_pt_ms: 5000, completed_at_pt_ms: null,
    },
  ];

  const stubDefects: DefectSnapshot[] = [
    {
      id: 'i1', title: 'Blocked', description: '', trigger_mode: 'manual',
      auto_resolve_pt_ms: 0, lifecycle: 'inactive',
      activated_at_pt_ms: null, resolved_at_pt_ms: null, released: false,
    },
    {
      id: 'i2', title: 'Fire', description: '', trigger_mode: 'auto',
      auto_resolve_pt_ms: 30_000, lifecycle: 'active',
      activated_at_pt_ms: 1000, resolved_at_pt_ms: null, released: true,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GmItemActionsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GmItemActionsComponent);
    fixture.componentRef.setInput('injects', stubInjects);
    fixture.componentRef.setInput('defects', stubDefects);
    fixture.detectChanges();
  });

  it('renders inject titles', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alert');
    expect(text).toContain('Alarm');
  });

  it('renders defect titles', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Blocked');
    expect(text).toContain('Fire');
  });

  it('shows Trigger button for scheduled injects', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const triggerBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Trigger',
    );
    expect(triggerBtns.length).toBeGreaterThan(0);
  });

  it('shows Complete button for running injects', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const completeBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Complete',
    );
    expect(completeBtns.length).toBe(1);
  });

  it('shows Activate button for inactive defects', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const activateBtns = Array.from(buttons).filter(
      (b) => (b as Element).textContent?.trim() === 'Activate',
    );
    expect(activateBtns.length).toBe(1);
  });

  it('shows Mitigate and Resolve buttons for active defects', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const texts = Array.from(buttons).map((b) => (b as Element).textContent?.trim());
    expect(texts).toContain('Mitigate');
    expect(texts).toContain('Resolve');
  });

  it('emits triggerInject when Trigger is clicked', () => {
    let emittedId: string | undefined;
    fixture.componentInstance.triggerInject.subscribe((id: string) => (emittedId = id));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const triggerBtn = Array.from(buttons).find(
      (b) => (b as Element).textContent?.trim() === 'Trigger',
    ) as HTMLButtonElement;
    triggerBtn.click();

    expect(emittedId).toBe('e1');
  });

  it('emits activateDefect when Activate is clicked', () => {
    let emittedId: string | undefined;
    fixture.componentInstance.activateDefect.subscribe((id: string) => (emittedId = id));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const btn = Array.from(buttons).find(
      (b) => (b as Element).textContent?.trim() === 'Activate',
    ) as HTMLButtonElement;
    btn.click();

    expect(emittedId).toBe('i1');
  });

  it('uses hardcoded card titles Injects and Defects', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Injects');
    expect(text).toContain('Defects');
  });

  it('shows empty messages when no injects or defects', () => {
    fixture.componentRef.setInput('injects', []);
    fixture.componentRef.setInput('defects', []);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No injects loaded');
    expect(text).toContain('No defects loaded');
  });
});
