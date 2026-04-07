import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GridComponent, CellDirective } from './grid.component';

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

  it('should not set --grid-cols when cols is undefined', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.style.getPropertyValue('--grid-cols')).toBe('');
  });

  it('should set --grid-cols when cols is a number', () => {
    fixture.componentRef.setInput('cols', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.style.getPropertyValue('--grid-cols')).toBe('3');
  });

  it('should set grid-template-columns when cols is a string', () => {
    fixture.componentRef.setInput('cols', '1fr 2fr 1fr');
    fixture.detectChanges();
    expect(fixture.nativeElement.style.gridTemplateColumns).toBe('1fr 2fr 1fr');
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

  it('should support 2xl gap', () => {
    fixture.componentRef.setInput('gap', '2xl');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-gap')).toBe('2xl');
  });

  it('should not apply fill styles by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.style.flex).toBe('');
  });

  it('should apply flex: 1 and min-height: 0 when fill is true', () => {
    fixture.componentRef.setInput('fill', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.style.flex).toContain('1');
    expect(fixture.nativeElement.style.minHeight).toBe('0px');
  });
});

describe('CellDirective', () => {
  @Component({
    imports: [CellDirective],
    template: `<div uiCell [span]="span" [start]="start" [rowSpan]="rowSpan"></div>`,
  })
  class TestHost {
    span: number | 'full' | undefined;
    start: number | undefined;
    rowSpan: number | undefined;
  }

  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
  });

  it('should not set grid-column when span is undefined', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[uiCell]') as HTMLElement;
    expect(el.style.gridColumn).toBe('');
  });

  it('should set grid-column to span N when span is a number', () => {
    fixture.componentInstance.span = 2;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[uiCell]') as HTMLElement;
    expect(el.style.gridColumn).toBe('span 2');
  });

  it('should set grid-column to 1 / -1 when span is "full"', () => {
    fixture.componentInstance.span = 'full';
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[uiCell]') as HTMLElement;
    expect(el.style.gridColumn).toBe('1 / -1');
  });

  it('should set grid-column-start when start is provided', () => {
    fixture.componentInstance.start = 2;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[uiCell]') as HTMLElement;
    expect(el.style.gridColumnStart).toBe('2');
  });

  it('should set grid-row to span N when rowSpan is provided', () => {
    fixture.componentInstance.rowSpan = 3;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[uiCell]') as HTMLElement;
    expect(el.style.gridRow).toBe('span 3');
  });
});
