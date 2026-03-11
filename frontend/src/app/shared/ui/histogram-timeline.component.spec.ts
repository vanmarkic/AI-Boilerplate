import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  HistogramTimelineComponent,
  type HistogramBar,
  type HistogramLabel,
  type HistogramVariant,
} from './histogram-timeline.component';

@Component({
  imports: [HistogramTimelineComponent],
  template: `
    <app-histogram-timeline
      [bars]="bars()"
      [labels]="labels()"
      [ariaLabel]="ariaLabel()"
      [variant]="variant()"
    />
  `,
})
class TestHost {
  bars = signal<HistogramBar[]>([{ value: 5 }, { value: 10 }, { value: 3 }]);
  labels = signal<HistogramLabel[]>([{ index: 0, text: '8:00' }, { index: 2, text: '10:00' }]);
  ariaLabel = signal('Test histogram');
  variant = signal<HistogramVariant>('default');
}

describe('HistogramTimelineComponent', () => {
  let fixture: ComponentFixture<TestHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    host = fixture.nativeElement.querySelector('app-histogram-timeline');
  });

  it('should have histogram-timeline class on host', () => {
    expect(host.classList.contains('histogram-timeline')).toBe(true);
  });

  it('should set role="img" on host', () => {
    expect(host.getAttribute('role')).toBe('img');
  });

  it('should set aria-label on host', () => {
    expect(host.getAttribute('aria-label')).toBe('Test histogram');
  });

  it('should render correct number of bars', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars.length).toBe(3);
  });

  it('should normalize bar heights to 0–1 ratio based on max value', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(getComputedBarValue(bars[0])).toBe('0.5');
    expect(getComputedBarValue(bars[1])).toBe('1');
    expect(getComputedBarValue(bars[2])).toBe('0.3');
  });

  it('should set data-count on each bar', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars[0].getAttribute('data-count')).toBe('5');
    expect(bars[1].getAttribute('data-count')).toBe('10');
    expect(bars[2].getAttribute('data-count')).toBe('3');
  });

  it('should render labels at correct positions', () => {
    const labels = host.querySelectorAll('.histogram-label');
    expect(labels.length).toBe(2);
    expect(labels[0].textContent.trim()).toBe('8:00');
    expect(labels[1].textContent.trim()).toBe('10:00');
  });

  it('should set --label-position and --bar-count on labels', () => {
    const labels = host.querySelectorAll<HTMLElement>('.histogram-label');
    expect(labels[0].style.getPropertyValue('--label-position')).toBe('0');
    expect(labels[1].style.getPropertyValue('--label-position')).toBe('2');
  });

  it('should set --bar-count on the labels container', () => {
    const labelsContainer = host.querySelectorAll<HTMLElement>('.histogram-labels');
    expect(labelsContainer.length).toBeGreaterThan(0);
    expect(labelsContainer[0].style.getPropertyValue('--bar-count')).toBe('3');
  });

  it('should set data-variant="default" by default', () => {
    expect(host.getAttribute('data-variant')).toBe('default');
  });

  it('should set data-variant="destructive"', () => {
    fixture.componentInstance.variant.set('destructive');
    fixture.detectChanges();
    expect(host.getAttribute('data-variant')).toBe('destructive');
  });

  it('should handle empty bars array', () => {
    fixture.componentInstance.bars.set([]);
    fixture.detectChanges();
    const bars = host.querySelectorAll('.histogram-bar');
    expect(bars.length).toBe(0);
  });

  it('should handle all-zero values without division by zero', () => {
    fixture.componentInstance.bars.set([{ value: 0 }, { value: 0 }]);
    fixture.detectChanges();
    const bars = host.querySelectorAll('.histogram-bar');
    expect(getComputedBarValue(bars[0])).toBe('0');
    expect(getComputedBarValue(bars[1])).toBe('0');
  });
});

function getComputedBarValue(el: Element): string {
  return (el as HTMLElement).style.getPropertyValue('--bar-value');
}
