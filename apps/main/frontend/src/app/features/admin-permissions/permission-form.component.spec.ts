import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PermissionFormComponent } from './permission-form.component';

describe('PermissionFormComponent', () => {
  let fixture: ComponentFixture<PermissionFormComponent>;
  let component: PermissionFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionFormComponent, ReactiveFormsModule],
    }).compileComponents();
    fixture = TestBed.createComponent(PermissionFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form by default', () => {
    expect(component.form.valid).toBe(false);
  });

  it('should become valid with required fields', () => {
    component.form.patchValue({
      role: 'admin',
      route_pattern: '/api/test',
      method: 'GET',
    });
    expect(component.form.valid).toBe(true);
  });

  it('should emit submitted on valid submit', () => {
    const spy = vi.fn();
    component.submitted.subscribe(spy);
    component.form.patchValue({
      role: 'admin',
      route_pattern: '/api/test',
      method: 'GET',
    });
    component.form.markAllAsTouched();
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]');
    submitBtn?.click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'admin',
        route_pattern: '/api/test',
        method: 'GET',
        frontend_route: null,
      }),
    );
  });

  it('should not emit on invalid submit', () => {
    const spy = vi.fn();
    component.submitted.subscribe(spy);
    const submitBtn = fixture.nativeElement.querySelector('button[type="submit"]');
    submitBtn?.click();
    expect(spy).not.toHaveBeenCalled();
  });
});
