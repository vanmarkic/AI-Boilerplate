import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { FormErrorComponent } from './form-error.component';

describe('FormErrorComponent', () => {
  let fixture: ComponentFixture<FormErrorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormErrorComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FormErrorComponent);
  });

  it('shows nothing when control is valid', () => {
    const control = new FormControl('valid@email.com', [Validators.required, Validators.email]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('shows required error when touched and empty', () => {
    const control = new FormControl('', [Validators.required]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('required');
  });

  it('shows email error for invalid email format', () => {
    const control = new FormControl('not-email', [Validators.email]);
    control.markAsTouched();
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('valid email');
  });

  it('shows nothing when control is untouched', () => {
    const control = new FormControl('', [Validators.required]);
    fixture.componentRef.setInput('control', control);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });
});
