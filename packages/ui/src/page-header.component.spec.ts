import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PageHeaderComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have page-header host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('page-header')).toBe(true);
  });

  it('should render the title', () => {
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.page-header-title');
    expect(title.textContent.trim()).toBe('Dashboard');
  });

  it('should not render subtitle element when subtitle is empty', () => {
    fixture.detectChanges();
    const subtitle = fixture.nativeElement.querySelector('.page-header-subtitle');
    expect(subtitle).toBeNull();
  });

  it('should render the subtitle when provided', () => {
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.componentRef.setInput('subtitle', 'Overview of your activity');
    fixture.detectChanges();
    const subtitle = fixture.nativeElement.querySelector('.page-header-subtitle');
    expect(subtitle).toBeTruthy();
    expect(subtitle.textContent.trim()).toBe('Overview of your activity');
  });

  it('should render actions slot container', () => {
    fixture.detectChanges();
    const actions = fixture.nativeElement.querySelector('.page-header-actions');
    expect(actions).toBeTruthy();
  });
});
