import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogPanelComponent } from './dialog-panel.component';

describe('DialogPanelComponent', () => {
  let fixture: ComponentFixture<DialogPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DialogPanelComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogPanelComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render a panel with role="dialog" and aria-modal="true"', () => {
    const panel = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-modal')).toBe('true');
  });

  it('should render a backdrop with aria-hidden="true"', () => {
    const backdrop = fixture.nativeElement.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
  });

  it('should emit closed when Escape key is pressed', () => {
    let emitted = false;
    fixture.componentInstance.closed.subscribe(() => (emitted = true));

    fixture.nativeElement.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );

    expect(emitted).toBe(true);
  });

  it('should emit closed when backdrop is clicked', () => {
    let emitted = false;
    fixture.componentInstance.closed.subscribe(() => (emitted = true));

    fixture.nativeElement.querySelector('[aria-hidden="true"]').click();

    expect(emitted).toBe(true);
  });

  it('should apply default variant border class', () => {
    const panel = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(panel.className).toContain('border-border');
  });

  it('should apply destructive variant border class', () => {
    fixture.componentRef.setInput('variant', 'destructive');
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(panel.className).toContain('border-destructive');
  });
});
