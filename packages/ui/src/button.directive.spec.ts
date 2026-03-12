import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonDirective, type ButtonSize, type ButtonVariant } from './button.directive';

@Component({
  imports: [ButtonDirective],
  template: `<button uiButton [variant]="variant()" [size]="size()">Click</button>`,
})
class TestHost {
  variant = signal<ButtonVariant>('default');
  size = signal<ButtonSize>('default');
}

describe('ButtonDirective', () => {
  let fixture: ComponentFixture<TestHost>;
  let button: HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    fixture.detectChanges();
    button = fixture.nativeElement.querySelector('button');
  });

  it('should have btn class on host', () => {
    expect(button.classList.contains('btn')).toBe(true);
  });

  it('should set data-variant="default" by default', () => {
    expect(button.getAttribute('data-variant')).toBe('default');
  });

  it('should set data-variant="destructive"', () => {
    fixture.componentInstance.variant.set('destructive');
    fixture.detectChanges();
    expect(button.getAttribute('data-variant')).toBe('destructive');
  });

  it('should set data-variant="outline"', () => {
    fixture.componentInstance.variant.set('outline');
    fixture.detectChanges();
    expect(button.getAttribute('data-variant')).toBe('outline');
  });

  it('should set data-variant="ghost"', () => {
    fixture.componentInstance.variant.set('ghost');
    fixture.detectChanges();
    expect(button.getAttribute('data-variant')).toBe('ghost');
  });

  it('should set data-size="default" by default', () => {
    expect(button.getAttribute('data-size')).toBe('default');
  });

  it('should set data-size="sm"', () => {
    fixture.componentInstance.size.set('sm');
    fixture.detectChanges();
    expect(button.getAttribute('data-size')).toBe('sm');
  });

  it('should set data-size="lg"', () => {
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();
    expect(button.getAttribute('data-size')).toBe('lg');
  });
});
