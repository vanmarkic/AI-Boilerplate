import { ComponentFixture, TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import { ScenarioWalkthroughComponent } from "./scenario-walkthrough";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import type {
  ScenarioContent,
  ScenarioEventDef,
} from "../../core/scenario-api.service";

const emptyContent: ScenarioContent = {
  phases: [],
  events: [],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
};

const stubEvents: ScenarioEventDef[] = [
  {
    id: "e2",
    title: "Second Event",
    description: "Happens later",
    event_type: "operational",
    scheduled_pt_ms: 120_000,
    duration_ms: null,
    dependencies: [],
    triggered_issues: [],
    target_roles: [],
    role_descriptions: {},
  },
  {
    id: "e1",
    title: "First Event",
    description: "Happens first",
    event_type: "informational",
    scheduled_pt_ms: 60_000,
    duration_ms: 30_000,
    dependencies: [],
    triggered_issues: [],
    target_roles: ["CO"],
    role_descriptions: {},
  },
];

const contentWithEvents: ScenarioContent = {
  ...emptyContent,
  events: stubEvents,
};

describe("ScenarioWalkthroughComponent", () => {
  let fixture: ComponentFixture<ScenarioWalkthroughComponent>;
  const mockStore = {
    content: signal<ScenarioContent>(emptyContent),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockStore.content = signal<ScenarioContent>(emptyContent);

    await TestBed.configureTestingModule({
      imports: [ScenarioWalkthroughComponent],
    })
      .overrideProvider(ScenarioBuilderStore, { useValue: mockStore })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioWalkthroughComponent);
    fixture.detectChanges();
  });

  it("shows 'No events to walk through' when events empty", () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("No events to walk through");
  });

  it("displays first event when events present (sorted by scheduled_pt_ms)", () => {
    mockStore.content.set(contentWithEvents);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    // First Event (60_000ms) should be shown first, not Second Event (120_000ms)
    expect(text).toContain("First Event");
  });

  it("shows 'Event 1 of N' indicator", () => {
    mockStore.content.set(contentWithEvents);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Event 1 of 2");
  });

  it("previous button is disabled on first event", () => {
    mockStore.content.set(contentWithEvents);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll("button");
    const prevButton = Array.from(buttons).find((b) =>
      (b as HTMLElement).textContent?.includes("Previous"),
    ) as HTMLButtonElement;
    expect(prevButton.disabled).toBe(true);
  });

  it("next button advances to next event", () => {
    mockStore.content.set(contentWithEvents);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll("button");
    const nextButton = Array.from(buttons).find((b) =>
      (b as HTMLElement).textContent?.includes("Next"),
    ) as HTMLButtonElement;
    nextButton.click();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Event 2 of 2");
    expect(text).toContain("Second Event");
  });
});
