import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import {
  CoDecisionBarComponent,
  type CoDecisionConfirmation,
} from "./co-decision-bar.component";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { RoleDef } from "../../core/scenario-api.service";
import type { SystemSnapshot } from "../../core/generated/state-changes.types";

function makeDecision(
  overrides: Partial<ActiveDecision> = {},
): ActiveDecision {
  return {
    id: "d1",
    event_id: "e1",
    issue_id: null,
    title: "Respond to threat",
    description: "",
    question_type: "single_choice",
    options: [
      { id: "opt1", label: "Option A" },
      { id: "opt2", label: "Option B" },
      { id: "opt3", label: "Option C" },
    ],
    completion_mode: "any",
    target_roles: ["co", "ops", "nav", "pwo"],
    timeout_ms: 30_000,
    max_selections: null,
    status: "open",
    opened_at_pt_ms: 0,
    closed_at_pt_ms: null,
    recommendations: {},
    selected_option_ids: [],
    ...overrides,
  };
}

const ROLES: RoleDef[] = [
  { id: "ops", label: "Operations", player_type: "advisor" },
  { id: "nav", label: "Navigator", player_type: "advisor" },
  { id: "pwo", label: "Weapons", player_type: "advisor" },
];

@Component({
  imports: [CoDecisionBarComponent],
  template: `
    <tfc-co-decision-bar
      [decision]="decision()"
      [advisorRoles]="advisorRoles()"
      [systems]="systems()"
      (confirmed)="onConfirm($event)"
    />
  `,
})
class TestHost {
  readonly decision = signal<ActiveDecision | null>(makeDecision());
  readonly advisorRoles = signal<RoleDef[]>(ROLES);
  readonly systems = signal<SystemSnapshot[]>([]);
  lastConfirm: CoDecisionConfirmation | null = null;
  onConfirm(e: CoDecisionConfirmation): void {
    this.lastConfirm = e;
  }
}

describe("CoDecisionBarComponent", () => {
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

  it("renders all decision options", () => {
    const options = fixture.nativeElement.querySelectorAll(
      ".co-decision-bar__option",
    );
    expect(options.length).toBe(3);
  });

  it("shows empty state when no decision", () => {
    host.decision.set(null);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector(
      ".co-decision-bar__empty",
    );
    expect(empty).toBeTruthy();
    expect(empty.textContent).toContain("Waiting for next decision...");
  });

  it("shows recommendation badges", () => {
    host.decision.set(
      makeDecision({
        recommendations: { "p1:ops": "opt2", "p2:pwo": "opt2" },
      }),
    );
    fixture.detectChanges();

    const badges = fixture.nativeElement.querySelectorAll(
      ".co-decision-bar__rec-badge",
    );
    expect(badges.length).toBeGreaterThan(0);

    // Find opt2 card (second option)
    const options = fixture.nativeElement.querySelectorAll(
      ".co-decision-bar__option",
    );
    const opt2Text = options[1].textContent;
    expect(opt2Text).toContain("Operations");
    expect(opt2Text).toContain("Weapons");
  });

  it("enables confirm after selecting an option", () => {
    const firstOption = fixture.nativeElement.querySelector(
      ".co-decision-bar__option",
    ) as HTMLElement;
    firstOption.click();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      ".co-decision-bar__confirm",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("disables confirm with no selection", () => {
    const btn = fixture.nativeElement.querySelector(
      ".co-decision-bar__confirm",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("emits confirmed with selected option ids", () => {
    const firstOption = fixture.nativeElement.querySelector(
      ".co-decision-bar__option",
    ) as HTMLElement;
    firstOption.click();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      ".co-decision-bar__confirm",
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(host.lastConfirm).toBeTruthy();
    expect(host.lastConfirm!.selectedOptionIds).toEqual(["opt1"]);
  });

  it("supports multi-choice toggle (select and deselect)", () => {
    host.decision.set(
      makeDecision({ question_type: "multi_choice" }),
    );
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll(
      ".co-decision-bar__option",
    ) as NodeListOf<HTMLElement>;
    // Select first two
    options[0].click();
    options[1].click();
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      ".co-decision-bar__confirm",
    ) as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(host.lastConfirm!.selectedOptionIds).toEqual(["opt1", "opt2"]);

    // Deselect first
    host.lastConfirm = null;
    options[0].click();
    fixture.detectChanges();
    btn.click();
    fixture.detectChanges();

    expect(host.lastConfirm!.selectedOptionIds).toEqual(["opt2"]);
  });

  it("resets selection when decision changes", () => {
    const firstOption = fixture.nativeElement.querySelector(
      ".co-decision-bar__option",
    ) as HTMLElement;
    firstOption.click();
    fixture.detectChanges();

    // Change the decision
    host.decision.set(
      makeDecision({ id: "d2", title: "New decision" }),
    );
    fixture.detectChanges();

    const btn = fixture.nativeElement.querySelector(
      ".co-decision-bar__confirm",
    ) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
