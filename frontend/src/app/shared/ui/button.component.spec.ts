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

  it('should render a native button element', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button).toBeTruthy();
  });

  it('should set data-variant="default" on inner button by default', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('data-variant')).toBe('default');
  });

  it('should set data-variant="destructive" on inner button', () => {
    fixture.componentRef.setInput('variant', 'destructive');
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('data-variant')).toBe('destructive');
  });

  it('should be disabled when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button');
    expect(button.disabled).toBe(true);
  });

  it('should emit clicked on button click', () => {
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.clicked.subscribe(spy);
    fixture.nativeElement.querySelector('button').click();
    expect(spy).toHaveBeenCalled();
  });
});
