import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminPermissionsComponent } from './admin-permissions.component';

describe('AdminPermissionsComponent', () => {
  let fixture: ComponentFixture<AdminPermissionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPermissionsComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminPermissionsComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the heading', () => {
    const heading =
      fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;
    expect(heading.textContent).toContain('Permissions Management');
  });
});
