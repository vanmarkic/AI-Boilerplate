import { ComponentFixture, TestBed } from "@angular/core/testing";
import { of } from "rxjs";
import { ScenarioBuilderView } from "./scenario-builder-view";
import { ScenarioApiService } from "../../core/scenario-api.service";
import { DomainService } from "../../core/domain.service";

describe("ScenarioBuilderView", () => {
  let fixture: ComponentFixture<ScenarioBuilderView>;
  let component: ScenarioBuilderView;

  const mockApi = {
    list: vi.fn().mockReturnValue(of([])),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    clone: vi.fn(),
  };

  const mockDomain = {
    term: vi.fn().mockReturnValue("Decision"),
    activeDomain: vi.fn().mockReturnValue({
      terminology: { decision: "Decision" },
    }),
    availableDomains: vi.fn().mockReturnValue([]),
    loading: vi.fn().mockReturnValue(false),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApi.list.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ScenarioBuilderView],
    })
      .overrideProvider(ScenarioApiService, { useValue: mockApi })
      .overrideProvider(DomainService, { useValue: mockDomain })
      .compileComponents();

    fixture = TestBed.createComponent(ScenarioBuilderView);
    component = fixture.componentInstance;
  });

  it("creates successfully", () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it("calls API list on init", () => {
    fixture.detectChanges();
    expect(mockApi.list).toHaveBeenCalled();
  });

  it("shows sidebar navigation", () => {
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector(
      "tfc-scenario-sidebar-nav",
    );
    expect(sidebar).toBeTruthy();
  });

  it("shows global view by default with all sections", () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector("#section-roles")).toBeTruthy();
    expect(el.querySelector("#section-events")).toBeTruthy();
    expect(el.querySelector("#section-issues")).toBeTruthy();
    expect(el.querySelector("#section-decisions")).toBeTruthy();
    expect(el.querySelector("#section-turns")).toBeTruthy();
    expect(el.querySelector("#section-settings")).toBeTruthy();
  });

  it("shows No scenarios found when list is empty", () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("No scenarios found");
  });
});
