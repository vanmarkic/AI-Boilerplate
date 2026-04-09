import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PresenceIndicatorComponent } from './presence-indicator.component';
import type { ParticipantPresence } from '../core/exercise.store';

describe('PresenceIndicatorComponent', () => {
  let fixture: ComponentFixture<PresenceIndicatorComponent>;

  const participants: ParticipantPresence[] = [
    { id: 'p1', display_name: 'Alice', role: 'player', connected: true },
    { id: 'p2', display_name: 'Bob', role: 'observer', connected: false },
    { id: 'p3', display_name: 'Charlie', role: 'player', connected: true },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PresenceIndicatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PresenceIndicatorComponent);
  });

  it('shows empty message when no participants', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('No participants');
  });

  it('renders one presence-item per participant', () => {
    fixture.componentRef.setInput('participants', participants);
    fixture.detectChanges();
    const items = fixture.nativeElement.querySelectorAll('.presence-item');
    expect(items.length).toBe(3);
  });

  it('shows display names', () => {
    fixture.componentRef.setInput('participants', participants);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Alice');
    expect(text).toContain('Bob');
    expect(text).toContain('Charlie');
  });

  it('applies connected class to connected participants', () => {
    fixture.componentRef.setInput('participants', participants);
    fixture.detectChanges();
    const connectedDots = fixture.nativeElement.querySelectorAll('.presence-dot--connected');
    expect(connectedDots.length).toBe(2);
  });

  it('applies disconnected class to disconnected participants', () => {
    fixture.componentRef.setInput('participants', participants);
    fixture.detectChanges();
    const disconnected = fixture.nativeElement.querySelectorAll('.presence-dot--disconnected');
    expect(disconnected.length).toBe(1);
  });

  it('shows role badges', () => {
    fixture.componentRef.setInput('participants', participants);
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('ui-badge');
    const texts = Array.from(badges).map((b) => (b as Element).textContent?.trim());
    expect(texts).toContain('player');
    expect(texts).toContain('observer');
  });
});
