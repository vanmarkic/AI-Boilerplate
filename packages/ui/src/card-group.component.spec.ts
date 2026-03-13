import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CardGroupComponent } from './card-group.component';

describe('CardGroupComponent', () => {
  let fixture: ComponentFixture<CardGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardGroupComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CardGroupComponent);
    fixture.componentRef.setInput('title', 'Test Group');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have card-group host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('card-group')).toBe(true);
  });

  it('should set data-mode="aggregated" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-mode')).toBe('aggregated');
  });

  it('should set data-mode when mode input changes', () => {
    fixture.componentRef.setInput('mode', 'disaggregated');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-mode')).toBe('disaggregated');
  });

  it('should render toggle button with title', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.card-group-toggle');
    expect(btn).toBeTruthy();
    const title = btn.querySelector('.card-group-title');
    expect(title.textContent).toContain('Test Group');
  });

  it('should render count badge', () => {
    fixture.componentRef.setInput('count', 4);
    fixture.detectChanges();
    const count = fixture.nativeElement.querySelector('.card-group-count');
    expect(count.textContent).toContain('4');
  });

  it('should render chevron SVG', () => {
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg.card-group-chevron');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('should show summary slot when aggregated', () => {
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('.card-group-summary');
    expect(summary).toBeTruthy();
    const items = fixture.nativeElement.querySelector('.card-group-items');
    expect(items).toBeFalsy();
  });

  it('should show items slot when disaggregated', () => {
    fixture.componentRef.setInput('mode', 'disaggregated');
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelector('.card-group-items');
    expect(items).toBeTruthy();
    const summary = fixture.nativeElement.querySelector('.card-group-summary');
    expect(summary).toBeFalsy();
  });

  it('should toggle mode on button click', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.mode()).toBe('aggregated');

    const btn = fixture.nativeElement.querySelector('.card-group-toggle');
    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.mode()).toBe('disaggregated');

    btn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.mode()).toBe('aggregated');
  });

  it('should set aria-expanded on toggle button', () => {
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('.card-group-toggle');
    expect(btn.getAttribute('aria-expanded')).toBe('false');

    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });
});
