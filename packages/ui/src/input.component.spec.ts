import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputComponent } from './input.component';

@Component({
  template: `<app-input [formControl]="control" />`,
  imports: [InputComponent, ReactiveFormsModule],
})
class TestHostComponent {
  control = new FormControl('', { nonNullable: true });
}

describe('InputComponent — ControlValueAccessor', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('writes value from FormControl to the input element', () => {
    host.control.setValue('hello');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('hello');
  });

  it('propagates typed value back to FormControl', () => {
    const input = fixture.nativeElement.querySelector('input');
    input.value = 'world';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(host.control.value).toBe('world');
  });

  it('disables the input when FormControl is disabled', () => {
    host.control.disable();
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input');
    expect(input.disabled).toBe(true);
  });
});
