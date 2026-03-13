import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridComponent } from './grid.component';

describe('GridComponent', () => {
  let fixture: ComponentFixture<GridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GridComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(GridComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have layout-grid host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('layout-grid')).toBe(true);
  });

  it('should set --grid-cols CSS custom property to 1 by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.style.getPropertyValue('--grid-cols')).toBe('1');
  });

  it('should set --grid-cols when cols input changes', () => {
    fixture.componentRef.setInput('cols', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.style.getPropertyValue('--grid-cols')).toBe('3');
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
});
