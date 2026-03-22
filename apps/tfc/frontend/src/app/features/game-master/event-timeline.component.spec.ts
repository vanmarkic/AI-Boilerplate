import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { EventTimelineComponent } from "./event-timeline.component";
import type {
  EventSnapshot,
  IssueSnapshot,
} from "../../core/engine-api.service";
import { environment } from "../../core/environment";

describe("EventTimelineComponent", () => {
  let fixture: ComponentFixture<EventTimelineComponent>;

  const stubEvents: EventSnapshot[] = [
    {
      id: "e1",
      title: "Event 1",
      description: "",
      event_type: "operational",
      scheduled_pt_ms: 0,
      duration_ms: 30_000,
      dependencies: [],
      triggered_issues: [],
      lifecycle: "running",
      started_at_pt_ms: 0,
      completed_at_pt_ms: null,
      target_roles: [],
      role_descriptions: {},
      system_effects: [],
    },
    {
      id: "e2",
      title: "Event 2",
      description: "",
      event_type: "operational",
      scheduled_pt_ms: 60_000,
      duration_ms: 20_000,
      dependencies: [],
      triggered_issues: [],
      lifecycle: "scheduled",
      started_at_pt_ms: null,
      completed_at_pt_ms: null,
      target_roles: [],
      role_descriptions: {},
      system_effects: [],
    },
  ];

  const stubIssues: IssueSnapshot[] = [
    {
      id: "i1",
      title: "Issue 1",
      description: "",
      trigger_mode: "manual",
      auto_resolve_ms: 60_000,
      lifecycle: "active",
      activated_at_pt_ms: 10_000,
      resolved_at_pt_ms: null,
      released: true,
    },
  ];

  const base = environment.apiBaseUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EventTimelineComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EventTimelineComponent);
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
  });

  it("renders the timeline container", () => {
    fixture.detectChanges();
    const container = fixture.nativeElement.querySelector(
      ".timeline-container",
    );
    expect(container).toBeTruthy();
  });

  it("renders event and issue lane groups", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("issues", stubIssues);
    fixture.componentRef.setInput("playTimeMs", 15_000);
    fixture.detectChanges();

    const groups = fixture.nativeElement.querySelectorAll(
      ".timeline-lane-group",
    );
    expect(groups.length).toBe(2);
  });

  it("renders lane group labels using DomainService terms", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("issues", stubIssues);
    fixture.detectChanges();

    const labels = fixture.nativeElement.querySelectorAll(
      ".timeline-lane-group__label",
    );
    expect(labels.length).toBe(2);
    // Default domain: "Event" and "Issue"
    expect(labels[0].textContent).toContain("Event");
    expect(labels[1].textContent).toContain("Issue");
  });

  it("renders the NOW marker", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("playTimeMs", 15_000);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector(".timeline-now-marker");
    expect(marker).toBeTruthy();
  });

  it("positions NOW marker based on playTimeMs", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("playTimeMs", 30_000);
    fixture.detectChanges();

    const marker = fixture.nativeElement.querySelector(
      ".timeline-now-marker",
    ) as HTMLElement;
    const leftPx = parseFloat(marker.style.left);
    expect(leftPx).toBeGreaterThan(0);
  });

  it("renders axis ticks", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("playTimeMs", 60_000);
    fixture.detectChanges();

    const ticks = fixture.nativeElement.querySelectorAll(".timeline-tick");
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("renders timeline-lane components for events and issues", () => {
    fixture.componentRef.setInput("events", stubEvents);
    fixture.componentRef.setInput("issues", stubIssues);
    fixture.componentRef.setInput("playTimeMs", 15_000);
    fixture.detectChanges();

    const lanes = fixture.nativeElement.querySelectorAll("tfc-timeline-lane");
    expect(lanes.length).toBe(2);
  });

  it("renders with empty events and issues", () => {
    fixture.componentRef.setInput("events", []);
    fixture.componentRef.setInput("issues", []);
    fixture.componentRef.setInput("playTimeMs", 0);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector(
      ".timeline-container",
    );
    expect(container).toBeTruthy();
  });
});
