import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { SystemStatusBoardComponent } from "./system-status-board.component";
import type { SystemSnapshot } from "../core/generated/state-changes.types";

@Component({
  selector: "test-host",
  imports: [SystemStatusBoardComponent],
  template: `<tfc-system-status-board [systems]="systems()" />`,
})
class TestHost {
  systems = signal<SystemSnapshot[]>([]);
}

function makeSys(overrides: Partial<SystemSnapshot> = {}): SystemSnapshot {
  return {
    system_id: "nav",
    label: "NAV",
    category: "sensor",
    power: true,
    operational: "green",
    ...overrides,
  };
}

describe("SystemStatusBoardComponent", () => {
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
    return el.querySelectorAll('[data-testid="system-row"]');
  }

  // ── Rendering ──

  it("should render nothing when systems is empty", () => {
    host.systems.set([]);
    fixture.detectChanges();
    expect(rows().length).toBe(0);
    expect(el.querySelector(".system-board")).toBeNull();
  });

  it("should render one row per system", () => {
    host.systems.set([
      makeSys({ system_id: "nav", label: "NAV" }),
      makeSys({ system_id: "comms", label: "COMMS" }),
      makeSys({ system_id: "aaw", label: "AAW" }),
    ]);
    fixture.detectChanges();
    expect(rows().length).toBe(3);
  });

  it("should display each system label", () => {
    host.systems.set([
      makeSys({ label: "NAV RADAR" }),
      makeSys({ system_id: "comms", label: "COMMS" }),
    ]);
    fixture.detectChanges();
    expect(el.textContent).toContain("NAV RADAR");
    expect(el.textContent).toContain("COMMS");
  });

  // ── Power attribute ──

  it("should set data-power=true when powered on", () => {
    host.systems.set([makeSys({ power: true })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-power")).toBe("true");
  });

  it("should set data-power=false when powered off", () => {
    host.systems.set([makeSys({ power: false })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-power")).toBe("false");
  });

  // ── Power text ──

  it("should display ON when powered", () => {
    host.systems.set([makeSys({ power: true })]);
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain("ON");
  });

  it("should display OFF when unpowered", () => {
    host.systems.set([makeSys({ power: false })]);
    fixture.detectChanges();
    expect(rows()[0].textContent).toContain("OFF");
  });

  // ── Traffic light ──

  it("should render three traffic light dots per system", () => {
    host.systems.set([makeSys()]);
    fixture.detectChanges();
    const lights = rows()[0].querySelectorAll(".system-chip__light");
    expect(lights.length).toBe(3);
    expect(lights[0].getAttribute("data-color")).toBe("red");
    expect(lights[1].getAttribute("data-color")).toBe("yellow");
    expect(lights[2].getAttribute("data-color")).toBe("green");
  });

  // ── Operational attribute ──

  it("should set data-operational=green", () => {
    host.systems.set([makeSys({ operational: "green" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-operational")).toBe("green");
  });

  it("should set data-operational=yellow", () => {
    host.systems.set([makeSys({ operational: "yellow" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-operational")).toBe("yellow");
  });

  it("should set data-operational=red", () => {
    host.systems.set([makeSys({ operational: "red" })]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-operational")).toBe("red");
  });

  // ── Reactivity ──

  it("should update when systems signal changes", () => {
    host.systems.set([
      makeSys({ system_id: "nav", power: true, operational: "green" }),
    ]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-power")).toBe("true");
    expect(rows()[0].getAttribute("data-operational")).toBe("green");

    host.systems.set([
      makeSys({ system_id: "nav", power: false, operational: "red" }),
    ]);
    fixture.detectChanges();
    expect(rows()[0].getAttribute("data-power")).toBe("false");
    expect(rows()[0].getAttribute("data-operational")).toBe("red");
  });

  it("should show board title", () => {
    host.systems.set([makeSys()]);
    fixture.detectChanges();
    expect(el.textContent).toContain("Systems");
  });
});
