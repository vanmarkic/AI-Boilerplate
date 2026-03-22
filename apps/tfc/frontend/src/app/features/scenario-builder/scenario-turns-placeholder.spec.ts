import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ScenarioTurnsPlaceholderComponent } from "./scenario-turns-placeholder";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import type { ScenarioContent } from "../../core/scenario-api.service";

const emptyContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  turns: [],
};

const contentWithTurns: ScenarioContent = {
  ...emptyContent,
  turns: [
    {
      turn_index: 1,
      title: "Initial Response",
      facilitator_prompt: null,
      has_decisions: false,
      duration_ms: null,
      inject_ids: ["inj-1"],
      decision_template_id: null,
      injects: [],
      available_cards: [],
      max_selections: 1,
      base_stress_delta: 5,
      system_effects_on_start: [],
      domain_effects_on_start: [],
      best_path: null,
      acceptable_path: null,
      design_notes: "",
    },
    {
      turn_index: 2,
      title: "Escalation",
      facilitator_prompt: null,
      has_decisions: true,
      duration_ms: null,
      inject_ids: [],
      decision_template_id: null,
      injects: [],
      available_cards: [],
      max_selections: 1,
      base_stress_delta: 0,
      system_effects_on_start: [],
      domain_effects_on_start: [],
      best_path: null,
      acceptable_path: null,
      design_notes: "",
    },
  ],
};

describe("ScenarioTurnsPlaceholderComponent", () => {
  let fixture: ComponentFixture<ScenarioTurnsPlaceholderComponent>;
  const mockStore = {
    content: signal<ScenarioContent>(emptyContent),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.content = signal<ScenarioContent>(emptyContent);

    await TestBed.configureTestingModule({
      imports: [ScenarioTurnsPlaceholderComponent],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioTurnsPlaceholderComponent);
    fixture.detectChanges();
  });

  it("creates successfully", () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("shows 'No turns defined' message when turns empty", () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("No turns defined");
  });

  it("displays turn titles when turns present", () => {
    mockStore.content.set(contentWithTurns);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Initial Response");
    expect(text).toContain("Escalation");
  });

  it("shows stress delta when non-zero", () => {
    mockStore.content.set(contentWithTurns);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("+5");
  });
});
