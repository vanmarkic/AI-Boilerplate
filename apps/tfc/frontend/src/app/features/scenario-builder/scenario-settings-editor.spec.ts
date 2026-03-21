import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ScenarioSettingsEditorComponent } from "./scenario-settings-editor";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import type { ScenarioContent } from "../../core/scenario-api.service";

const baseContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 2.5,
  briefing: "Initial briefing text",
  objectives: [],
  rules: [],
  roles: [],
  game_mode: "classic",
  turns: [],
  initial_system_states: [],
};

describe("ScenarioSettingsEditorComponent", () => {
  let fixture: ComponentFixture<ScenarioSettingsEditorComponent>;
  let el: HTMLElement;

  const mockStore = {
    content: signal(baseContent),
    setTimeFactor: vi.fn(),
    setBriefing: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.content = signal({ ...baseContent });

    await TestBed.configureTestingModule({
      imports: [ScenarioSettingsEditorComponent],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioSettingsEditorComponent);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it("should create", () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it("should display current time factor value", () => {
    const input = el.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    expect(input.value).toBe("2.5");
  });

  it("should display current briefing value", () => {
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Initial briefing text");
  });

  it("should call store.setTimeFactor on time factor change", () => {
    const input = el.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement;
    input.value = "3";
    input.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(mockStore.setTimeFactor).toHaveBeenCalledWith(3);
  });

  it("should call store.setBriefing on briefing change", () => {
    const textarea = el.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Updated briefing";
    textarea.dispatchEvent(new Event("input"));
    fixture.detectChanges();

    expect(mockStore.setBriefing).toHaveBeenCalledWith("Updated briefing");
  });
});
