import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SidebarLayoutComponent } from './sidebar-layout.component';

describe('SidebarLayoutComponent', () => {
  let fixture: ComponentFixture<SidebarLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarLayoutComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SidebarLayoutComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have sidebar-layout host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('sidebar-layout')).toBe(true);
  });

  it('should set data-side="left" by default', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-side')).toBe('left');
  });

  it('should set data-side="right" when side input changes', () => {
    fixture.componentRef.setInput('side', 'right');
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('data-side')).toBe('right');
  });

  it('should render an aside element with sidebar-layout-sidebar class', () => {
    fixture.detectChanges();
    const aside = fixture.nativeElement.querySelector('aside.sidebar-layout-sidebar');
    expect(aside).toBeTruthy();
  });

  it('should render a div with sidebar-layout-main class', () => {
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('div.sidebar-layout-main');
    expect(main).toBeTruthy();
  });
});
