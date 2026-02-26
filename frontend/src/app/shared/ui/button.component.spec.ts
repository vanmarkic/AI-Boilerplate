import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ButtonComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should apply default variant classes', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.className).toContain('bg-primary');
  });

  it('should apply destructive variant classes', () => {
    fixture.componentRef.setInput('variant', 'destructive');
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.className).toContain('bg-destructive');
  });

  it('should be disabled when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('disabled')).not.toBeNull();
  });
});
