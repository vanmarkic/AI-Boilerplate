import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EventsComponent } from './events.component';

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display header with title', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Technical Events Timeline');
  });

  it('should display event bars', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Events over time');
  });

  it('should display recent events', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Recent Events');
  });

  it('should display deployment and alert categories', () => {
    const compiled = fixture.nativeElement;
    expect(compiled.textContent).toContain('Deployments');
    expect(compiled.textContent).toContain('Alerts & Incidents');
  });
});
