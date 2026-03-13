import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StackComponent } from './stack.component';

describe('StackComponent', () => {
  let fixture: ComponentFixture<StackComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StackComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StackComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have stack host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('stack')).toBe(true);
  });

  it('should set data-direction="vertical" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-direction')).toBe('vertical');
  });

  it('should set data-direction="horizontal" when input changes', () => {
    fixture.componentRef.setInput('direction', 'horizontal');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-direction')).toBe('horizontal');
  });

  it('should set data-gap="md" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-gap')).toBe('md');
  });

  it('should set data-gap when gap input changes', () => {
    fixture.componentRef.setInput('gap', 'lg');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-gap')).toBe('lg');
  });

  it('should set data-align when align input is provided', () => {
    fixture.componentRef.setInput('align', 'center');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-align')).toBe('center');
  });

  it('should not set data-align attribute when align is null', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-align')).toBeNull();
  });

  it('should set data-justify when justify input is provided', () => {
    fixture.componentRef.setInput('justify', 'between');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-justify')).toBe('between');
  });

  it('should not set data-justify attribute when justify is null', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-justify')).toBeNull();
  });
});
