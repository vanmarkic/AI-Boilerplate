import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { of } from "rxjs";
import { ScenarioBuilderView } from "./scenario-builder-view";
import { ScenarioApiService } from "../../core/scenario-api.service";
import { DomainConfigApiService } from "../../core/domain-config-api.service";
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

  const mockDomainConfigApi = {
    getBySlug: vi.fn().mockReturnValue(
      of({
        id: 1,
        slug: "silent-wake",
        name: "Silent Wake",
        description: "",
        terminology: {},
        theme: {},
        roles: [],
        severity_levels: [],
        systems: [],
        warfare_domains: [],
        blue_card_catalog: [],
        created_at: "",
        updated_at: "",
      }),
    ),
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
      providers: [provideRouter([])],
    })
      .overrideProvider(ScenarioApiService, { useValue: mockApi })
      .overrideProvider(DomainConfigApiService, {
        useValue: mockDomainConfigApi,
      })
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

  it("shows setup tab by default with foundation, metadata, and initial states sections", () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector("#section-foundation")).toBeTruthy();
    expect(el.querySelector("#section-metadata")).toBeTruthy();
    expect(el.querySelector("#section-initial-states")).toBeTruthy();
  });

  it("shows No scenarios found when list is empty", () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain("No scenarios found");
  });
});
