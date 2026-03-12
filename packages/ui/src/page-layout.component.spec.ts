import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PageLayoutComponent } from './page-layout.component';

describe('PageLayoutComponent', () => {
  let fixture: ComponentFixture<PageLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageLayoutComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(PageLayoutComponent);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should have page-layout host class', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.classList.contains('page-layout')).toBe(true);
  });

  it('should render a header element with page-layout-header class', () => {
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('header.page-layout-header');
    expect(header).toBeTruthy();
  });

  it('should render a main element with page-layout-main class', () => {
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('main.page-layout-main');
    expect(main).toBeTruthy();
  });

  it('should render a footer element with page-layout-footer class', () => {
    fixture.detectChanges();
    const footer = fixture.nativeElement.querySelector('footer.page-layout-footer');
    expect(footer).toBeTruthy();
  });
});
