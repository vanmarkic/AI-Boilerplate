import { Component, signal } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import {
  ScenarioSidebarNavComponent,
  SidebarSection,
} from "./scenario-sidebar-nav";

@Component({
  imports: [ScenarioSidebarNavComponent],
  template: `<tfc-scenario-sidebar-nav
    [sections]="sections()"
    [activeSection]="active()"
    (sectionClick)="clicked = $event"
  />`,
})
class TestHost {
  sections = signal<SidebarSection[]>([
    { id: "events", label: "Events", count: 3 },
    { id: "issues", label: "Issues", count: 1 },
    { id: "roles", label: "Roles", count: 2 },
  ]);
  active = signal("");
  clicked = "";
}

describe("ScenarioSidebarNavComponent", () => {
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

  it("renders section labels", () => {
    const links = fixture.nativeElement.querySelectorAll("a");
    const texts = Array.from(links).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(texts.some((t) => t?.includes("Events"))).toBe(true);
    expect(texts.some((t) => t?.includes("Issues"))).toBe(true);
    expect(texts.some((t) => t?.includes("Roles"))).toBe(true);
  });

  it("renders section counts as badges", () => {
    const badges = fixture.nativeElement.querySelectorAll("ui-badge");
    const counts = Array.from(badges).map((b) =>
      (b as HTMLElement).textContent?.trim(),
    );
    expect(counts).toEqual(["3", "1", "2"]);
  });

  it("active section gets font-medium class", () => {
    host.active.set("issues");
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll("a");
    const activeLink = Array.from(links).find((a) =>
      (a as HTMLElement).textContent?.includes("Issues"),
    ) as HTMLElement;
    expect(activeLink.classList.contains("font-medium")).toBe(true);

    const inactiveLink = Array.from(links).find((a) =>
      (a as HTMLElement).textContent?.includes("Events"),
    ) as HTMLElement;
    expect(inactiveLink.classList.contains("font-medium")).toBe(false);
  });

  it("clicking a section emits sectionClick event", () => {
    const links = fixture.nativeElement.querySelectorAll("a");
    const issuesLink = Array.from(links).find((a) =>
      (a as HTMLElement).textContent?.includes("Issues"),
    ) as HTMLElement;
    issuesLink.click();
    fixture.detectChanges();

    expect(host.clicked).toBe("issues");
  });
});
