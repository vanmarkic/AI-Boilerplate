import { Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { ScenarioBuilderActionsComponent } from "./scenario-builder-view-actions";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import type { ScenarioContent } from "../../core/scenario-api.service";

const minimalContent: ScenarioContent = {
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
  initial_warfare_domains: [],
};

@Component({
  imports: [ScenarioBuilderActionsComponent],
  template: `<tfc-scenario-builder-actions
    [viewMode]="mode()"
    [isDirty]="dirty()"
    (onSave)="saved = true"
    (onSaveAsCopy)="copied = true"
    (onToggleView)="toggled = true"
  />`,
})
class TestHost {
  mode = signal<"setup" | "turns">("setup");
  dirty = signal(false);
  saved = false;
  copied = false;
  toggled = false;
}

describe("ScenarioBuilderActionsComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  const mockStore = {
    scenarioId: signal<number | null>(1),
    title: signal("Test"),
    description: signal(""),
    content: signal(minimalContent),
    setTitle: vi.fn(),
    setDescription: vi.fn(),
    reset: vi.fn(),
    revert: vi.fn(),
    setError: vi.fn(),
    loadImport: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .compileComponents();

    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("shows Update button when scenarioId exists", () => {
    mockStore.scenarioId.set(1);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const saveBtn = buttons.find((b) => b.textContent?.trim() === "Update");
    expect(saveBtn).toBeTruthy();
  });

  it("shows Create button when scenarioId is null", () => {
    mockStore.scenarioId.set(null);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const createBtn = buttons.find((b) => b.textContent?.trim() === "Create");
    expect(createBtn).toBeTruthy();
  });

  it("shows Save as Copy button when scenarioId exists", () => {
    mockStore.scenarioId.set(1);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const copyBtn = buttons.find(
      (b) => b.textContent?.trim() === "Save as Copy",
    );
    expect(copyBtn).toBeTruthy();
  });

  it("hides Revert button when not dirty", () => {
    host.dirty.set(false);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const revertBtn = buttons.find((b) => b.textContent?.trim() === "Revert");
    expect(revertBtn).toBeUndefined();
  });

  it("shows Revert button when dirty", () => {
    host.dirty.set(true);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const revertBtn = buttons.find((b) => b.textContent?.trim() === "Revert");
    expect(revertBtn).toBeTruthy();
  });

  it("shows Turns text when viewMode is setup", () => {
    host.mode.set("setup");
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const toggleBtn = buttons.find((b) => b.textContent?.trim() === "Turns");
    expect(toggleBtn).toBeTruthy();
  });

  it("save button click emits onSave", () => {
    mockStore.scenarioId.set(1);
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const saveBtn = buttons.find((b) => b.textContent?.trim() === "Update");
    saveBtn!.click();
    expect(host.saved).toBe(true);
  });

  it("view toggle button click emits onToggleView", () => {
    host.mode.set("setup");
    fixture.detectChanges();
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button"),
    );
    const toggleBtn = buttons.find((b) => b.textContent?.trim() === "Turns");
    toggleBtn!.click();
    expect(host.toggled).toBe(true);
  });
});
