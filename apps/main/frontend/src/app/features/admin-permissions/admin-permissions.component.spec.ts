import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { AdminPermissionsComponent } from './admin-permissions.component';

describe('AdminPermissionsComponent', () => {
  let fixture: ComponentFixture<AdminPermissionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPermissionsComponent, RouterModule.forRoot([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminPermissionsComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the page header title', () => {
    const header = fixture.nativeElement.querySelector('.page-header-title') as HTMLElement;
    expect(header.textContent).toContain('Administration');
  });

  it('should render Permissions and Users tab links', () => {
    const links = fixture.nativeElement.querySelectorAll(
      'a[uitablink]',
    ) as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(2);
    expect(links[0].textContent).toContain('Permissions');
    expect(links[1].textContent).toContain('Users');
  });
});
