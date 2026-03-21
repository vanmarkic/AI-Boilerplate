import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { LogsDrawerComponent } from "./logs-drawer.component";
import type { AuditEntry } from "../core/audit-api.service";

@Component({
  selector: "test-host",
  imports: [LogsDrawerComponent],
  template: `<tfc-logs-drawer [(open)]="open" [logs]="logs()" />`,
})
class TestHost {
  open = signal(true);
  logs = signal<AuditEntry[]>([]);
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 1,
    exercise_id: 1,
    entry_type: "phase_change",
    action: "started",
    actor_id: null,
    actor_name: null,
    target_type: null,
    target_id: null,
    play_time_ms: 0,
    real_time_ms: 0,
    details: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("LogsDrawerComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should render log entries", () => {
    host.logs.set([
      makeEntry({ id: 1, entry_type: "phase_change", action: "started", play_time_ms: 0 }),
      makeEntry({ id: 2, entry_type: "event_change", action: "triggered", play_time_ms: 5000, target_id: "evt-1" }),
    ]);
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('[data-testid="log-entry"]');
    expect(entries.length).toBe(2);
  });

  it("should show drawer title as Logs", () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Logs");
  });

  it("should show empty message when no logs", () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("No events yet.");
  });

  it("should sort entries by play_time_ms", () => {
    host.logs.set([
      makeEntry({ id: 2, action: "second", play_time_ms: 5000 }),
      makeEntry({ id: 1, action: "first", play_time_ms: 1000 }),
    ]);
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('[data-testid="log-entry"]');
    expect(entries[0].textContent).toContain("first");
    expect(entries[1].textContent).toContain("second");
  });

  it("should format play time as m:ss", () => {
    host.logs.set([
      makeEntry({ id: 1, play_time_ms: 65000 }),
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("1:05");
  });
});
