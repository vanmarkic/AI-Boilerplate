import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonDirective, type ButtonSize, type ButtonVariant } from './button.directive';

@Component({
  imports: [ButtonDirective],
  template: `<button appButton [variant]="variant()" [size]="size()">Click</button>`,
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

  it('should apply base classes', () => {
    expect(button.className).toContain('inline-flex');
    expect(button.className).toContain('items-center');
    expect(button.className).toContain('cursor-pointer');
  });

  it('should apply default variant classes', () => {
    expect(button.className).toContain('bg-primary');
    expect(button.className).toContain('text-primary-foreground');
  });

  it('should apply destructive variant classes', () => {
    fixture.componentInstance.variant.set('destructive');
    fixture.detectChanges();
    expect(button.className).toContain('bg-destructive');
    expect(button.className).toContain('text-destructive-foreground');
  });

  it('should apply outline variant classes', () => {
    fixture.componentInstance.variant.set('outline');
    fixture.detectChanges();
    expect(button.className).toContain('border');
    expect(button.className).toContain('bg-background');
  });

  it('should apply ghost variant classes', () => {
    fixture.componentInstance.variant.set('ghost');
    fixture.detectChanges();
    expect(button.className).not.toContain('bg-primary');
    expect(button.className).not.toContain('border');
  });

  it('should apply default size classes', () => {
    expect(button.className).toContain('h-control-md');
    expect(button.className).toContain('px-md');
    expect(button.className).toContain('text-sm');
  });

  it('should apply sm size classes', () => {
    fixture.componentInstance.size.set('sm');
    fixture.detectChanges();
    expect(button.className).toContain('h-control-sm');
    expect(button.className).toContain('px-sm');
    expect(button.className).toContain('text-xs');
  });

  it('should apply lg size classes', () => {
    fixture.componentInstance.size.set('lg');
    fixture.detectChanges();
    expect(button.className).toContain('h-control-lg');
    expect(button.className).toContain('px-lg');
    expect(button.className).toContain('text-base');
  });
});
