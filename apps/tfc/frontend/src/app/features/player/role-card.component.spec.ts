import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { RoleCardComponent, type RoleCardSubmission } from "./role-card.component";
import type { RoleCard } from "./role-card.types";
import type { SystemSnapshot } from "../../core/generated/state-changes.types";

function makeCard(overrides: Partial<RoleCard> = {}): RoleCard {
  return {
    roleId: "co",
    roleLabel: "Commanding Officer",
    playerType: "decision_maker",
    intel: null,
    decision: {
      id: "d1",
      event_id: "e1",
      issue_id: null,
      title: "Decision",
      description: "",
      question_type: "single_choice",
      options: [
        { id: "opt1", label: "Option A" },
        { id: "opt2", label: "Option B" },
      ],
      completion_mode: "any",
      target_roles: ["co"],
      timeout_ms: 30_000,
      max_selections: null,
      status: "open",
      opened_at_pt_ms: 0,
      closed_at_pt_ms: null,
      recommendations: {},
      selected_option_ids: [],
    },
    status: "active",
    advisorRecs: [],
    ...overrides,
  };
}

function makeSystems(): SystemSnapshot[] {
  return [
    {
      system_id: "radar",
      label: "RADAR",
      category: "sensor",
      power: true,
      operational: "operational",
    },
    {
      system_id: "sonar",
      label: "SONAR",
      category: "sensor",
      power: true,
      operational: "operational",
    },
  ];
}

@Component({
  imports: [RoleCardComponent],
  template: `
    <tfc-role-card
      [card]="card()"
      [systems]="systems()"
      [readonly]="readonly()"
      (submitted)="onSubmit($event)"
    />
  `,
})
class TestHost {
  readonly card = signal(makeCard());
  readonly systems = signal<SystemSnapshot[]>([]);
  readonly readonly = signal(false);
  lastSubmission: RoleCardSubmission | null = null;
  onSubmit(s: RoleCardSubmission): void {
    this.lastSubmission = s;
  }
}

describe("RoleCardComponent", () => {
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

  it("should create", () => {
    expect(fixture.nativeElement.querySelector(".role-card")).toBeTruthy();
  });

  describe("canSubmit", () => {
    it("disables submit when no option is selected", () => {
      const btn = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("enables submit after selecting a regular option", () => {
      const label = fixture.nativeElement.querySelector(".role-card__option") as HTMLElement;
      label.querySelector("input")!.click();
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it("disables submit when targets_system option selected without system", () => {
      host.card.set(
        makeCard({
          decision: {
            ...makeCard().decision!,
            options: [
              { id: "opt1", label: "Target System", targets_system: true },
            ],
          },
        }),
      );
      host.systems.set(makeSystems());
      fixture.detectChanges();

      const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
      input.click();
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it("enables submit when targets_system option has a system selected", () => {
      host.card.set(
        makeCard({
          decision: {
            ...makeCard().decision!,
            options: [
              { id: "opt1", label: "Target System", targets_system: true },
            ],
          },
        }),
      );
      host.systems.set(makeSystems());
      fixture.detectChanges();

      // Select the option
      const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
      input.click();
      fixture.detectChanges();

      // Select a system
      const select = fixture.nativeElement.querySelector("select") as HTMLSelectElement;
      select.value = "radar";
      select.dispatchEvent(new Event("change"));
      fixture.detectChanges();

      const btn = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  describe("onSystemSelect", () => {
    it("updates targetSystemSelections when system is picked", () => {
      host.card.set(
        makeCard({
          decision: {
            ...makeCard().decision!,
            options: [
              { id: "opt1", label: "Target System", targets_system: true },
            ],
          },
        }),
      );
      host.systems.set(makeSystems());
      fixture.detectChanges();

      // Select the option first
      const input = fixture.nativeElement.querySelector("input") as HTMLInputElement;
      input.click();
      fixture.detectChanges();

      // Pick a system
      const select = fixture.nativeElement.querySelector("select") as HTMLSelectElement;
      select.value = "sonar";
      select.dispatchEvent(new Event("change"));
      fixture.detectChanges();

      // Submit
      const btn = fixture.nativeElement.querySelector("button") as HTMLButtonElement;
      btn.click();
      fixture.detectChanges();

      expect(host.lastSubmission).toBeTruthy();
      expect(host.lastSubmission!.targetSystemSelections).toEqual({
        opt1: "sonar",
      });
    });
  });

  describe("system picker visibility", () => {
    it("shows system picker only for selected targets_system options", () => {
      host.card.set(
        makeCard({
          decision: {
            ...makeCard().decision!,
            options: [
              { id: "opt1", label: "Regular" },
              { id: "opt2", label: "Target System", targets_system: true },
            ],
          },
        }),
      );
      host.systems.set(makeSystems());
      fixture.detectChanges();

      // No select visible before selection
      expect(fixture.nativeElement.querySelector("select")).toBeNull();

      // Select the targets_system option (second label)
      const labels = fixture.nativeElement.querySelectorAll(".role-card__option");
      labels[1].querySelector("input")!.click();
      fixture.detectChanges();

      // Select should now be visible
      expect(fixture.nativeElement.querySelector("select")).toBeTruthy();
    });
  });

  describe("readonly mode (CO mirror)", () => {
    it("hides submit button when readonly is true", () => {
      host.readonly.set(true);
      host.card.set(makeCard({ status: "active" }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("button")).toBeNull();
    });

    it("shows options as plain text without radio inputs when readonly", () => {
      host.readonly.set(true);
      host.card.set(makeCard({ status: "active" }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector("input[type='radio']")).toBeNull();
      const options = fixture.nativeElement.querySelectorAll(".role-card__option");
      expect(options.length).toBeGreaterThan(0);
    });

    it("highlights the recommended option with selected class", () => {
      host.readonly.set(true);
      host.card.set(
        makeCard({
          status: "active",
          decision: {
            ...makeCard().decision!,
            recommendations: { "p1:ops": "opt1" },
          },
        }),
      );
      fixture.detectChanges();

      const selected = fixture.nativeElement.querySelectorAll(
        ".role-card__option--selected",
      );
      expect(selected.length).toBe(1);
    });

    it("shows pending label when no recommendation for this role", () => {
      host.readonly.set(true);
      host.card.set(
        makeCard({
          roleId: "co",
          status: "active",
          decision: {
            ...makeCard().decision!,
            recommendations: {},
          },
        }),
      );
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain("pending...");
    });

    it("hides pending label when recommendation exists for this role", () => {
      host.readonly.set(true);
      host.card.set(
        makeCard({
          roleId: "co",
          status: "active",
          decision: {
            ...makeCard().decision!,
            recommendations: { "p1:co": "opt1" },
          },
        }),
      );
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).not.toContain("pending...");
    });
  });
});
