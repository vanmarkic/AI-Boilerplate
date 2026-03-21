import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { LogsDrawerComponent } from "./logs-drawer.component";
import type { ActiveDecision } from "../core/decision-api.service";
import type { RoleDef } from "../core/scenario-api.service";

@Component({
  selector: "test-host",
  imports: [LogsDrawerComponent],
  template: `<tfc-logs-drawer [(open)]="open" [decisions]="decisions()" [roles]="roles()" />`,
})
class TestHost {
  open = signal(true);
  decisions = signal<ActiveDecision[]>([]);
  roles = signal<RoleDef[]>([]);
}

function makeDecision(overrides: Partial<ActiveDecision> = {}): ActiveDecision {
  return {
    id: "d1",
    event_id: null,
    issue_id: null,
    title: "Test Decision",
    description: "A test decision",
    question_type: "single",
    options: [
      { id: "o1", label: "Option A" },
      { id: "o2", label: "Option B" },
    ],
    completion_mode: "all_respond",
    target_roles: [],
    timeout_ms: 30000,
    max_selections: 1,
    status: "open",
    opened_at_pt_ms: 0,
    closed_at_pt_ms: null,
    recommendations: {},
    selected_option_ids: [],
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

  it("should show drawer title as Decision Log", () => {
    expect(fixture.nativeElement.textContent).toContain("Decision Log");
  });

  it("should show empty message when no decisions", () => {
    expect(fixture.nativeElement.textContent).toContain("No decisions yet.");
  });

  it("should render decision entries with turn numbers", () => {
    host.decisions.set([
      makeDecision({ id: "d1", title: "First Decision", opened_at_pt_ms: 0 }),
      makeDecision({ id: "d2", title: "Second Decision", opened_at_pt_ms: 5000 }),
    ]);
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('[data-testid="decision-entry"]');
    expect(entries.length).toBe(2);
    expect(entries[0].textContent).toContain("Turn 1");
    expect(entries[0].textContent).toContain("First Decision");
    expect(entries[1].textContent).toContain("Turn 2");
    expect(entries[1].textContent).toContain("Second Decision");
  });

  it("should sort decisions by opened_at_pt_ms", () => {
    host.decisions.set([
      makeDecision({ id: "d2", title: "Later", opened_at_pt_ms: 5000 }),
      makeDecision({ id: "d1", title: "Earlier", opened_at_pt_ms: 1000 }),
    ]);
    fixture.detectChanges();
    const entries = fixture.nativeElement.querySelectorAll('[data-testid="decision-entry"]');
    expect(entries[0].textContent).toContain("Earlier");
    expect(entries[1].textContent).toContain("Later");
  });

  it("should display role recommendations with labels", () => {
    host.roles.set([
      { id: "eng", label: "Engineer", player_type: "advisor" },
      { id: "ops", label: "Ops Lead", player_type: "advisor" },
    ]);
    host.decisions.set([
      makeDecision({
        recommendations: { "p1:eng": "o1", "p1:ops": "o2" },
      }),
    ]);
    fixture.detectChanges();
    const recs = fixture.nativeElement.querySelectorAll('[data-testid="recommendation"]');
    expect(recs.length).toBe(2);
    expect(recs[0].textContent).toContain("Engineer");
    expect(recs[0].textContent).toContain("Option A");
    expect(recs[1].textContent).toContain("Ops Lead");
    expect(recs[1].textContent).toContain("Option B");
  });

  it("should display final decision for closed decisions", () => {
    host.decisions.set([
      makeDecision({
        status: "closed",
        closed_at_pt_ms: 10000,
        selected_option_ids: ["o1"],
      }),
    ]);
    fixture.detectChanges();
    const final = fixture.nativeElement.querySelector('[data-testid="final-decision"]');
    expect(final).toBeTruthy();
    expect(final.textContent).toContain("Final");
    expect(final.textContent).toContain("Option A");
  });

  it("should show pending message for open decisions", () => {
    host.decisions.set([makeDecision({ status: "open" })]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("Awaiting decision...");
  });

  it("should fall back to role ID when no role label found", () => {
    host.decisions.set([
      makeDecision({ recommendations: { "unknown-role": "o1" } }),
    ]);
    fixture.detectChanges();
    const rec = fixture.nativeElement.querySelector('[data-testid="recommendation"]');
    expect(rec.textContent).toContain("unknown-role");
  });
});
