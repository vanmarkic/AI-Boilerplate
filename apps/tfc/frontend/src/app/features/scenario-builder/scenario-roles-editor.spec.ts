import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ScenarioRolesEditorComponent } from "./scenario-roles-editor";
import { ScenarioBuilderStore } from "./scenario-builder.store";
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

const contentWithRoles: ScenarioContent = {
  ...emptyContent,
  roles: [
    { id: "role-1", label: "Commander", player_type: "decision_maker" },
    { id: "role-2", label: "Analyst", player_type: "advisor" },
  ],
};

describe("ScenarioRolesEditorComponent", () => {
  let fixture: ComponentFixture<ScenarioRolesEditorComponent>;
  let el: HTMLElement;

  const mockStore = {
    content: signal(emptyContent),
    addRole: vi.fn(),
    removeRole: vi.fn(),
    updateRole: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.content = signal(emptyContent);

    await TestBed.configureTestingModule({
      imports: [ScenarioRolesEditorComponent],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioRolesEditorComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it("should create", () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("should show empty message when no roles", () => {
    expect(el.textContent).toContain("No roles yet.");
  });

  it("should display role labels and player_type badges when present", () => {
    mockStore.content.set(contentWithRoles);
    fixture.detectChanges();

    expect(el.textContent).toContain("Commander");
    expect(el.textContent).toContain("decision_maker");
    expect(el.textContent).toContain("Analyst");
    expect(el.textContent).toContain("advisor");
  });

  it("should call store.addRole when add is clicked", () => {
    const comp = fixture.componentInstance as unknown as {
      newId: ReturnType<typeof signal<string>>;
      newLabel: ReturnType<typeof signal<string>>;
    };
    comp.newId.set("role-3");
    comp.newLabel.set("Observer");
    fixture.detectChanges();

    const addBtn = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Add",
    );
    addBtn!.click();
    fixture.detectChanges();

    expect(mockStore.addRole).toHaveBeenCalledWith({
      id: "role-3",
      label: "Observer",
      player_type: "advisor",
    });
  });

  it("should call store.removeRole when remove is clicked", () => {
    mockStore.content.set(contentWithRoles);
    fixture.detectChanges();

    const removeBtn = Array.from(el.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Remove",
    );
    removeBtn!.click();
    fixture.detectChanges();

    expect(mockStore.removeRole).toHaveBeenCalledWith("role-1");
  });
});
