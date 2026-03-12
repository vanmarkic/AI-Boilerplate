import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CollapsiblePanelComponent } from './collapsible-panel.component';

describe('CollapsiblePanelComponent', () => {
  let fixture: ComponentFixture<CollapsiblePanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollapsiblePanelComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CollapsiblePanelComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have collapsible-panel host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('collapsible-panel')).toBe(true);
  });

  it('should set data-variant="default" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-variant')).toBe('default');
  });

  it('should set data-variant when variant input changes', () => {
    fixture.componentRef.setInput('variant', 'ghost');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-variant')).toBe('ghost');
  });

  it('should set data-size="default" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-size')).toBe('default');
  });

  it('should set data-size when size input changes', () => {
    fixture.componentRef.setInput('size', 'lg');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-size')).toBe('lg');
  });

  it('should render a details element', () => {
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details');
    expect(details).toBeTruthy();
  });

  it('should render a summary element with trigger class', () => {
    fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('summary.collapsible-panel-trigger');
    expect(summary).toBeTruthy();
  });

  it('should be closed by default', () => {
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details');
    expect(details.open).toBe(false);
  });

  it('should be open when open input is true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details');
    expect(details.open).toBe(true);
  });

  it('should render a chevron SVG', () => {
    fixture.detectChanges();
    const svg = fixture.nativeElement.querySelector('svg.collapsible-panel-chevron');
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render content area', () => {
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('.collapsible-panel-content');
    expect(content).toBeTruthy();
  });
});
