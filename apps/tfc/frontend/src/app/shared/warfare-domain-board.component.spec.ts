import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { WarfareDomainBoardComponent } from "./warfare-domain-board.component";
import type { WarfareDomainSnapshot } from "../core/generated/state-changes.types";

@Component({
  selector: "test-host",
  imports: [WarfareDomainBoardComponent],
  template: `<tfc-warfare-domain-board [domains]="domains()" />`,
})
class TestHost {
  domains = signal<WarfareDomainSnapshot[]>([]);
}

function makeDomain(
  overrides: Partial<WarfareDomainSnapshot> = {},
): WarfareDomainSnapshot {
  return {
    domain_id: "air",
    label: "AIR",
    threat_level: "green",
    ...overrides,
  };
}

describe("WarfareDomainBoardComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  function rows(): NodeListOf<HTMLElement> {
    return el.querySelectorAll('[data-testid="domain-row"]');
  }

  // -- Rendering --

  it("should render nothing when domains is empty", () => {
    host.domains.set([]);
    fixture.detectChanges();
    expect(rows().length).toBe(0);
    expect(el.querySelector(".warfare-board")).toBeNull();
  });

  it("should render one row per domain", () => {
    host.domains.set([
      makeDomain({ domain_id: "air", label: "AIR" }),
      makeDomain({ domain_id: "surface", label: "SURFACE" }),
      makeDomain({ domain_id: "subsurface", label: "SUBSURFACE" }),
    ]);
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  it("should display each domain label", () => {
    host.domains.set([
      makeDomain({ label: "AIR" }),
      makeDomain({ domain_id: "surface", label: "SURFACE" }),
    ]);
    fixture.detectChanges();
    expect(el.textContent).toContain("AIR");
    expect(el.textContent).toContain("SURFACE");
  });

  // -- Threat attribute --

  it("should set data-threat=green", () => {
    host.domains.set([makeDomain({ threat_level: "green" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-threat")).toBe("green");
  });

  it("should set data-threat=yellow", () => {
    host.domains.set([makeDomain({ threat_level: "yellow" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-threat")).toBe("yellow");
  });

  it("should set data-threat=red", () => {
    host.domains.set([makeDomain({ threat_level: "red" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-threat")).toBe("red");
  });

  // -- Traffic light --

  it("should render three traffic light dots per domain", () => {
    host.domains.set([makeDomain()]);
    fixture.detectChanges();
    const lights = rows()[0].querySelectorAll(".warfare-chip__light");
    expect(lights.length).toBe(3);
    expect(lights[0].getAttribute("data-color")).toBe("red");
    expect(lights[1].getAttribute("data-color")).toBe("yellow");
    expect(lights[2].getAttribute("data-color")).toBe("green");
  });

  // -- Reactivity --

  it("should update when domains signal changes", () => {
    host.domains.set([makeDomain({ domain_id: "air", threat_level: "green" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-threat")).toBe("green");

    host.domains.set([makeDomain({ domain_id: "air", threat_level: "red" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-threat")).toBe("red");
  });

  it("should show board title", () => {
    host.domains.set([makeDomain()]);
    fixture.detectChanges();
    expect(el.textContent).toContain("Warfare");
  });
});
