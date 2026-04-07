import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabLinkDirective } from './tab-link.directive';

@Component({
  imports: [TabLinkDirective],
  template: `<a uiTabLink [active]="active" href="/test">Tab</a>`,
})
class TestHost {
  active = false;
}

describe('TabLinkDirective', () => {
  let fixture: ComponentFixture<TestHost>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
  });

  it('should add tab-link class', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.classList.contains('tab-link')).toBe(true);
  });

  it('should set role="tab"', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.getAttribute('role')).toBe('tab');
  });

  it('should not set aria-selected when inactive', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.getAttribute('aria-selected')).toBeNull();
  });

  it('should set aria-selected when active', () => {
    fixture.componentInstance.active = true;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.getAttribute('aria-selected')).toBe('true');
  });

  it('should set data-active when active', () => {
    fixture.componentInstance.active = true;
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.getAttribute('data-active')).toBe('true');
  });

  it('should not set data-active when inactive', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('a');
    expect(el.getAttribute('data-active')).toBeNull();
  });
});
