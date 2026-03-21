import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ScenarioDecisionEditorComponent } from "./scenario-decision-editor";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { DomainService } from "../../core/domain.service";
import type { ScenarioContent } from "../../core/scenario-api.service";

const emptyContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  briefing: "",
  objectives: [],
  rules: [],
  roles: [],
  game_mode: "classic",
  turns: [],
  initial_system_states: [],
};

const contentWithTemplates: ScenarioContent = {
  ...emptyContent,
  decision_templates: [
    {
      id: "dt-1",
      title: "Evacuate Building",
      description: "Should we evacuate?",
      issue_id: "iss-1",
      question_type: "single_choice",
      options: [],
      completion_mode: "first_response",
    },
    {
      id: "dt-2",
      title: "Call Backup",
      description: "Request additional units",
      issue_id: "iss-2",
      question_type: "multi_choice",
      options: [],
      completion_mode: "first_response",
    },
  ],
};

describe("ScenarioDecisionEditorComponent", () => {
  let fixture: ComponentFixture<ScenarioDecisionEditorComponent>;
  let el: HTMLElement;

  const mockStore = {
    content: signal(emptyContent),
    addDecisionTemplate: vi.fn(),
    removeDecisionTemplate: vi.fn(),
    updateDecisionTemplate: vi.fn(),
  };

  const mockDomain = {
    term: vi.fn().mockReturnValue("Decision"),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.content = signal(emptyContent);

    await TestBed.configureTestingModule({
      imports: [ScenarioDecisionEditorComponent],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .overrideProvider(DomainService, { useValue: mockDomain })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioDecisionEditorComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it("should create", () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("should show empty message when no decision templates", () => {
    expect(el.textContent).toContain("No decision templates yet.");
  });

  it("should display decision template titles when present", () => {
    mockStore.content.set(contentWithTemplates);
    fixture.detectChanges();

    expect(el.textContent).toContain("Evacuate Building");
    expect(el.textContent).toContain("Call Backup");
  });

  it("should call store.addDecisionTemplate with correct shape when add is clicked", () => {
    const inputs = el.querySelectorAll("ui-input");
    // The add section has two inputs: title (placeholder "Decision title") and issue ID
    const titleInput = inputs[inputs.length - 2];

    titleInput.dispatchEvent(
      new CustomEvent("valueChange", { detail: "New Decision" }),
    );
    // ui-input uses (valueChange) output — dispatch via the component's signal
    // Instead, interact through the component instance
    const comp = fixture.componentInstance as unknown as {
      newTitle: ReturnType<typeof signal<string>>;
      newIssueId: ReturnType<typeof signal<string>>;
    };
    comp.newTitle.set("New Decision");
    comp.newIssueId.set("iss-5");
    fixture.detectChanges();

    const addBtn = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Add",
    );
    addBtn!.click();
    fixture.detectChanges();

    expect(mockStore.addDecisionTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New Decision",
        issue_id: "iss-5",
        question_type: "single_choice",
        options: [],
        completion_mode: "first_response",
      }),
    );
  });

  it("should call store.removeDecisionTemplate when remove is clicked", () => {
    mockStore.content.set(contentWithTemplates);
    fixture.detectChanges();

    const removeBtn = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Remove",
    );
    removeBtn!.click();
    fixture.detectChanges();

    expect(mockStore.removeDecisionTemplate).toHaveBeenCalledWith("dt-1");
  });
});
